"""Spain (mainland) data: ESIOS (REE) real-time demand, generation and
cross-border exchanges, plus ENTSO-E day-ahead prices and physical flows
for Portugal. France-Spain prices and flows are already stored by the
France pipeline (data/prices/ES and data/flows/ES) and are reused.

Raw storage (times in UTC; files split by local month; mainland Spain and
France share the same clock, so the Paris time zone is used throughout):
  data/es/demand/YYYY/YYYY-MM.csv     start_utc,min,actual,forecast (MW)
  data/es/mix/YYYY/YYYY-MM.csv        start_utc,min, one column per fuel (MW)
  data/es/exchanges/YYYY/YYYY-MM.csv  start_utc,min, real-time exports and imports by border (MW)
  data/es/flows/PT/YYYY/YYYY-MM.csv   start_utc,export_mw,import_mw,min (ENTSO-E; export = Spain to Portugal)
  data/prices/PT/YYYY/YYYY-MM.csv     start_utc,eur,min (ENTSO-E day-ahead, same layout as other zones)

ESIOS publishes most series every 5 minutes. Values are averaged to
quarter-hours here (series published less often are repeated across their
quarter-hours). Only the Peninsula is kept; the islands are left out.

Daily summaries for the website (one row per local day, mean MW):
  data/es/daily/demand.csv, mix.csv, exchanges.csv, flows.csv

Code note: no asterisks, double underscores or format codes inside
f-strings, because chat formatting strips them when code is pasted.
"""
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from operator import mul

from market_store import (entsoe_get, entsoe_param, month_path, num, parse_series,
                          read_rows, store_prices, upsert, write_rows)
from store import DATA_DIR, PARIS, fmt_utc, parse_ts

UTC = timezone.utc
ES_DIR = DATA_DIR / "es"
DEMAND_DIR = ES_DIR / "demand"
MIX_DIR = ES_DIR / "mix"
EXCH_DIR = ES_DIR / "exchanges"
FLOWS_PT_DIR = ES_DIR / "flows" / "PT"
FLOWS_FR_DIR = DATA_DIR / "flows" / "ES"   # stored by the France pipeline, French point of view
DAILY_DIR = ES_DIR / "daily"
STATE_PATH = ES_DIR / "state.json"
COVERAGE_PATH = ES_DIR / "coverage.json"

ESIOS_URL = "https://api.esios.ree.es"
ES_EIC = "10YES-REE------0"
PT_EIC = "10YPT-REN------W"
PENINSULA = "Península"

# ESIOS indicator IDs, from REE's own catalogue (Spain probes 1 and 2).
DEMAND = {
    1293: "actual",      # Demanda real Peninsular
    544: "forecast",     # Demanda prevista Peninsular
}
MIX = {
    546: "hydro",              # Generación T.Real hidráulica (net of pumping, to be confirmed)
    547: "coal",
    548: "fuel_gas",
    549: "nuclear",
    550: "ccgt",               # combined cycle
    551: "wind",
    552: "solar",
    553: "exchanges",          # net international exchanges
    554: "balearic_link",
    555: "other",              # Resto generación
    1294: "solar_thermal",
    1295: "solar_pv",
    1296: "renewable_thermal",
    1297: "chp_other",         # Cogeneración y resto
    2078: "pump_load",         # Consumo bombeo
    2079: "pump_gen",          # Turbinación bombeo
    2080: "hydro_gen",         # Generación hidráulica
}
EXCH = {
    2068: "exp_ad", 2069: "exp_ma", 2070: "exp_pt", 2071: "exp_fr", 2072: "exp_total",
    2073: "imp_ad", 2074: "imp_ma", 2075: "imp_pt", 2076: "imp_fr", 2077: "imp_total",
}
DATASETS = {
    "demand": (DEMAND_DIR, DEMAND),
    "mix": (MIX_DIR, MIX),
    "exchanges": (EXCH_DIR, EXCH),
}


# --------------------------------------------------------------------------
# ESIOS
# --------------------------------------------------------------------------

def esios_get(path, params, attempts=5):
    key = os.environ.get("ESIOS_API_KEY")
    if not key:
        raise RuntimeError("ESIOS_API_KEY is not set")
    url = ESIOS_URL + path + "?" + urllib.parse.urlencode(params)
    request = urllib.request.Request(url, headers={
        "Accept": "application/json; application/vnd.esios-api-v1+json",
        "Content-Type": "application/json",
        "x-api-key": key,
    })
    for attempt in range(1, attempts + 1):
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                return json.loads(response.read().decode("utf-8", "replace"))
        except urllib.error.HTTPError as error:
            body = error.read().decode("utf-8", "replace")[:200]
            if (error.code == 429 or error.code >= 500) and attempt < attempts:
                time.sleep(mul(15, attempt))
                continue
            raise RuntimeError("ESIOS HTTP " + str(error.code) + ": " + body) from error
        except (urllib.error.URLError, TimeoutError) as error:
            if attempt < attempts:
                time.sleep(mul(15, attempt))
                continue
            raise RuntimeError("ESIOS: " + str(error)) from error
    return None


def esios_time(v):
    raw = v.get("datetime_utc") or v.get("datetime")
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).astimezone(UTC)
    except ValueError:
        return None


def floor_quarter(t):
    return t.replace(minute=t.minute - t.minute % 15, second=0, microsecond=0)


def esios_quarters(ind_id, start, end):
    """Quarter-hour means of an indicator between two UTC datetimes: {t: MW}.
    Keeps the Peninsula when several areas are returned."""
    payload = esios_get("/indicators/" + str(ind_id), {
        "start_date": start.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "end_date": end.strftime("%Y-%m-%dT%H:%M:%SZ"),
    })
    values = ((payload or {}).get("indicator") or {}).get("values") or []
    geos = {str(v.get("geo_name") or "") for v in values}
    if len(geos) > 1:
        if PENINSULA not in geos:
            raise RuntimeError("indicator " + str(ind_id) + " has several areas and no Peninsula: " + ", ".join(sorted(geos)))
        values = [v for v in values if str(v.get("geo_name") or "") == PENINSULA]
    points = []
    for v in values:
        t = esios_time(v)
        if t is None or v.get("value") is None:
            continue
        if start <= t < end:
            points.append((t, float(v["value"])))
    points.sort()
    times = [p[0] for p in points]
    gaps = [(b - a).total_seconds() / 60 for a, b in zip(times, times[1:]) if b > a]
    step = int(min(gaps)) if gaps else 15
    sums = defaultdict(float)
    counts = defaultdict(int)
    for t, value in points:
        if step <= 15:
            keys = [floor_quarter(t)]
        else:
            keys = [t + timedelta(minutes=mul(15, k)) for k in range(step // 15)]
        for q in keys:
            sums[q] += value
            counts[q] += 1
    return {q: sums[q] / counts[q] for q in sums}


def fetch_esios(dataset, start, end, pause=0.3, errors=None):
    """All indicators of a dataset as records ready to store: {t: {min, col: text}}."""
    indicators = DATASETS[dataset][1]
    recs = {}
    for ind_id, col in indicators.items():
        try:
            for t, value in esios_quarters(ind_id, start, end).items():
                recs.setdefault(t, {"min": "15"})[col] = num(value, 0)
        except Exception as error:  # noqa: BLE001
            if errors is None:
                raise
            errors.append(dataset + " " + str(ind_id) + " (" + col + "): " + str(error)[:200])
        time.sleep(pause)
    return recs


def store_esios(dataset, recs):
    base, indicators = DATASETS[dataset]
    return upsert(base, ["start_utc", "min"] + list(indicators.values()), recs)


# --------------------------------------------------------------------------
# ENTSO-E (Portugal)
# --------------------------------------------------------------------------

def fetch_pt_prices(start, end):
    xml = entsoe_get({"documentType": "A44", "in_Domain": PT_EIC, "out_Domain": PT_EIC,
                      "periodStart": entsoe_param(start), "periodEnd": entsoe_param(end)})
    return {t: v for t, v in parse_series(xml, "price.amount").items() if start <= t < end}


def store_pt_prices(points):
    return store_prices("PT", points)


def fetch_pt_flows(start, end):
    """Physical flows Spain to Portugal (export) and Portugal to Spain (import)."""
    exp = parse_series(entsoe_get({"documentType": "A11", "in_Domain": PT_EIC, "out_Domain": ES_EIC,
                                   "periodStart": entsoe_param(start), "periodEnd": entsoe_param(end)}), "quantity")
    time.sleep(0.5)
    imp = parse_series(entsoe_get({"documentType": "A11", "in_Domain": ES_EIC, "out_Domain": PT_EIC,
                                   "periodStart": entsoe_param(start), "periodEnd": entsoe_param(end)}), "quantity")
    out = {}
    for t in sorted(set(exp) | set(imp)):
        if not (start <= t < end):
            continue
        e = exp.get(t)
        i = imp.get(t)
        minutes = (e or i)[1]
        out[t] = (e[0] if e else 0.0, i[0] if i else 0.0, minutes)
    return out


def store_pt_flows(points):
    recs = {t: {"export_mw": num(e, 0), "import_mw": num(i, 0), "min": str(m)} for t, (e, i, m) in points.items()}
    return upsert(FLOWS_PT_DIR, ["start_utc", "export_mw", "import_mw", "min"], recs)


# --------------------------------------------------------------------------
# State and time helpers
# --------------------------------------------------------------------------

def load_state():
    if STATE_PATH.exists():
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    return {}


def save_state(state):
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, indent=1, sort_keys=True) + "\n", encoding="utf-8")


def local_midnight(day):
    return datetime(day.year, day.month, day.day, tzinfo=PARIS)


def month_windows(first, end, months=1):
    """UTC windows of whole local months from the month containing first."""
    out = []
    local = first.astimezone(PARIS)
    y, m = local.year, local.month
    while True:
        a = datetime(y, m, 1, tzinfo=PARIS)
        if a.astimezone(UTC) >= end:
            break
        m2 = m - 1 + months
        y2 = y + m2 // 12
        m2 = m2 % 12 + 1
        b = datetime(y2, m2, 1, tzinfo=PARIS)
        out.append((a.astimezone(UTC), min(b.astimezone(UTC), end)))
        y, m = y2, m2
    return out


# --------------------------------------------------------------------------
# Daily summaries
# --------------------------------------------------------------------------

def monthly_files(base):
    if not base.exists():
        return []
    files = []
    for ydir in sorted(base.iterdir()):
        if ydir.is_dir() and ydir.name.isdigit():
            files.extend(p for p in sorted(ydir.iterdir()) if p.suffix == ".csv")
    return files


def local_date(t):
    return t.astimezone(PARIS).date()


def daily_means(base, cols, extra=None):
    """One row per local day: the time-weighted mean of each column (days with
    at least 20 hours of that column). extra(acc, t, row, h) adds more fields."""
    acc = defaultdict(lambda: defaultdict(float))
    for path in monthly_files(base):
        for row in read_rows(path):
            t = parse_ts(row["start_utc"])
            h = int(row.get("min") or 15) / 60
            d = local_date(t)
            for c in cols:
                v = row.get(c)
                if v in (None, ""):
                    continue
                acc[d][c] += mul(float(v), h)
                acc[d][c + "_h"] += h
            if extra:
                extra(acc[d], t, row, h)
    return acc


def summarise_demand():
    def extra(a, t, row, h):
        v = row.get("actual")
        if v in (None, ""):
            return
        v = float(v)
        a["peak"] = max(a.get("peak", v), v)
        a["low"] = min(a.get("low", v), v)
    acc = daily_means(DEMAND_DIR, ["actual", "forecast"], extra)
    rows = []
    for d in sorted(acc):
        a = acc[d]
        row = {"date": d.isoformat()}
        if a.get("actual_h", 0) >= 20:
            row["mean"] = round(a["actual"] / a["actual_h"])
            row["peak"] = round(a["peak"])
            row["minimum"] = round(a["low"])
            row["energy_gwh"] = round(a["actual"] / 1000, 1)
            row["hours"] = round(a["actual_h"], 2)
        if a.get("forecast_h", 0) >= 20:
            row["forecast_mean"] = round(a["forecast"] / a["forecast_h"])
        if len(row) > 1:
            rows.append(row)
    write_rows(DAILY_DIR / "demand.csv", ["date", "mean", "peak", "minimum", "energy_gwh", "forecast_mean", "hours"], rows)
    return len(rows)


def summarise_simple(base, cols, name):
    acc = daily_means(base, cols)
    rows = []
    for d in sorted(acc):
        a = acc[d]
        row = {"date": d.isoformat()}
        for c in cols:
            if a.get(c + "_h", 0) >= 20:
                row[c] = round(a[c] / a[c + "_h"])
        if len(row) > 1:
            rows.append(row)
    write_rows(DAILY_DIR / name, ["date"] + cols, rows)
    return len(rows)


def summarise_flows():
    """Spain's point of view: export = power leaving Spain."""
    pt = daily_means(FLOWS_PT_DIR, ["export_mw", "import_mw"])
    fr = daily_means(FLOWS_FR_DIR, ["export_mw", "import_mw"])  # French view: export = France to Spain
    rows = []
    for d in sorted(set(pt) | set(fr)):
        row = {"date": d.isoformat()}
        net = 0.0
        complete = True
        a = fr.get(d)
        if a and a.get("export_mw_h", 0) >= 20:
            e = a["import_mw"] / a["import_mw_h"] if a.get("import_mw_h") else 0.0
            i = a["export_mw"] / a["export_mw_h"]
            row.update(fr_exp=round(e), fr_imp=round(i), fr_net=round(e - i))
            net += e - i
        else:
            complete = False
        a = pt.get(d)
        if a and a.get("export_mw_h", 0) >= 20:
            e = a["export_mw"] / a["export_mw_h"]
            i = a["import_mw"] / a["import_mw_h"] if a.get("import_mw_h") else 0.0
            row.update(pt_exp=round(e), pt_imp=round(i), pt_net=round(e - i))
            net += e - i
        else:
            complete = False
        if complete:
            row["net"] = round(net)
        if len(row) > 1:
            rows.append(row)
    write_rows(DAILY_DIR / "flows.csv", ["date", "fr_exp", "fr_imp", "fr_net", "pt_exp", "pt_imp", "pt_net", "net"], rows)
    return len(rows)


def summarise():
    n = summarise_demand()
    m = summarise_simple(MIX_DIR, list(MIX.values()), "mix.csv")
    x = summarise_simple(EXCH_DIR, list(EXCH.values()), "exchanges.csv")
    f = summarise_flows()
    print("Spain daily summaries: demand " + str(n) + ", mix " + str(m) + ", exchanges " + str(x) + ", flows " + str(f) + " days")


def coverage():
    """First and last day with data for every stored column (written to data/es/coverage.json)."""
    out = {}
    for dataset, (base, indicators) in DATASETS.items():
        first = {}
        last = {}
        for path in monthly_files(base):
            for row in read_rows(path):
                for c in indicators.values():
                    if row.get(c) not in (None, ""):
                        first.setdefault(c, row["start_utc"])
                        last[c] = row["start_utc"]
        out[dataset] = {c: {"first": first.get(c, ""), "last": last.get(c, "")} for c in indicators.values()}
    for name, base in (("flows_PT", FLOWS_PT_DIR), ("prices_PT", DATA_DIR / "prices" / "PT")):
        files = monthly_files(base)
        rows_first = read_rows(files[0]) if files else []
        rows_last = read_rows(files[-1]) if files else []
        out[name] = {"first": rows_first[0]["start_utc"] if rows_first else "",
                     "last": rows_last[-1]["start_utc"] if rows_last else ""}
    COVERAGE_PATH.parent.mkdir(parents=True, exist_ok=True)
    COVERAGE_PATH.write_text(json.dumps(out, indent=1) + "\n", encoding="utf-8")
    return out
