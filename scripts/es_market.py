"""Spain market summaries for the Prices pages, built from the stored data
(no downloads): day-ahead prices (ES, FR, PT), REE demand and REE
real-time generation.

Writes:
  data/es/daily/market.csv   one row per local day:
      cap_T    output-weighted Spanish price of technology T (capture price)
      gen_T    average output of T (MW)
      res_mean, res_min, res_max   residual demand (demand minus wind and
               solar, MW): daily average, lowest and highest quarter-hour
      par_FR, par_PT   share of quarter-hours (%) when the Spanish price was
               within 0.01 EUR/MWh of the French or Portuguese price
  data/es/hourly/YYYY.csv    one row per hour (start in UTC): prices, hours
      below and at zero, demand, residual demand, output by technology,
      pumping consumption (negative) and net exports.

Technologies: solar (PV plus solar thermal; the solar total before June
2015), wind, nuclear, hydro (REE's real-time hydro plus pumping
consumption, i.e. before pumping, from Dec 2024; REE's figure, net of
pumping, before) and ccgt.

build(first_year) rebuilds every year from first_year: es_update.py
rebuilds the current year (and the previous one in early January);
es_summarise.py rebuilds everything.
Code note: no asterisks or double underscores (chat formatting strips them).
"""
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from operator import mul

from es_store import DAILY_DIR, DEMAND_DIR, ES_DIR, MIX_DIR, read_rows, write_rows
from store import DATA_DIR, PARIS, parse_ts

UTC = timezone.utc
HOURLY_DIR = ES_DIR / "hourly"
QUARTER = timedelta(minutes=15)
ZONES = ("ES", "FR", "PT")
TECHS = ("solar", "wind", "nuclear", "hydro", "ccgt")
MIX_COLS = ("hydro", "nuclear", "wind", "solar", "solar_pv", "solar_thermal", "ccgt", "coal",
            "chp_other", "other", "renewable_thermal", "pump_load", "exchanges")
HOURLY_FIELDS = ["t", "es", "fr", "pt", "es_neg", "es_zero", "fr_neg", "fr_zero", "pt_neg", "pt_zero",
                 "demand", "residual", "nuclear", "wind", "solar", "hydro", "ccgt", "coal", "chp",
                 "ren_th", "pump", "net_exp"]
DAILY_FIELDS = (["date"] + ["cap_" + t for t in TECHS] + ["gen_" + t for t in TECHS]
                + ["res_mean", "res_min", "res_max", "par_FR", "par_PT"])


def num(v):
    return None if v in (None, "") else float(v)


def files_of(base, year):
    """The monthly files of one year (files are split by local month)."""
    ydir = base / str(year)
    return sorted(p for p in ydir.iterdir() if p.suffix == ".csv") if ydir.exists() else []


def tech_values(r):
    """Output by technology (MW) from one stored mix row."""
    solar = r["solar_pv"] + (r["solar_thermal"] or 0) if r["solar_pv"] is not None else r["solar"]
    hydro = r["hydro"]
    if hydro is not None and r["pump_load"] is not None:
        hydro = hydro - r["pump_load"]
    chp = r["chp_other"] if r["chp_other"] is not None else r["other"]
    return {
        "solar": solar, "wind": r["wind"], "nuclear": r["nuclear"], "hydro": hydro, "ccgt": r["ccgt"],
        "coal": r["coal"], "chp": chp, "ren_th": r["renewable_thermal"],
        "pump": r["pump_load"], "net_exp": None if r["exchanges"] is None else -r["exchanges"],
    }


def load(year):
    """Quarter-hours of one local year, keyed by UTC start."""
    start = datetime(year, 1, 1, tzinfo=PARIS).astimezone(UTC)
    end = datetime(year + 1, 1, 1, tzinfo=PARIS).astimezone(UTC)
    q = defaultdict(dict)
    for z in ZONES:
        for path in files_of(DATA_DIR / "prices" / z, year):
            for row in read_rows(path):
                p = num(row.get("eur"))
                if p is None:
                    continue
                t = parse_ts(row["start_utc"])
                for k in range(max(1, int(row.get("min") or 60) // 15)):
                    tk = t + mul(QUARTER, k)
                    if start <= tk < end:
                        q[tk][z] = p
    for path in files_of(DEMAND_DIR, year):
        for row in read_rows(path):
            t = parse_ts(row["start_utc"])
            v = num(row.get("actual"))
            if v is not None and start <= t < end:
                q[t]["demand"] = v
    for path in files_of(MIX_DIR, year):
        for row in read_rows(path):
            t = parse_ts(row["start_utc"])
            if not (start <= t < end):
                continue
            r = {c: num(row.get(c)) for c in MIX_COLS}
            if r["wind"] is not None:
                q[t]["mix"] = tech_values(r)
    return q


def add(acc, key, value):
    if value is not None:
        acc[key] += value
        acc[key + "#"] += 1


def build_year(year):
    """Rebuild one year's hourly file; return its daily rows."""
    q = load(year)
    hours = defaultdict(lambda: defaultdict(float))
    days = defaultdict(lambda: defaultdict(float))
    lows = {}
    highs = {}
    for t in sorted(q):
        rec = q[t]
        mix = rec.get("mix")
        es = rec.get("ES")
        h = hours[t.replace(minute=0)]
        d = days[t.astimezone(PARIS).date()]
        for z in ZONES:
            p = rec.get(z)
            if p is None:
                continue
            add(h, z.lower(), p)
            if p < 0:
                h[z.lower() + "_neg"] += 0.25
            elif p == 0:
                h[z.lower() + "_zero"] += 0.25
            if z != "ES" and es is not None:
                d["par_" + z] += 1 if abs(es - p) < 0.01 else 0
                d["par_" + z + "#"] += 1
        demand = rec.get("demand")
        add(h, "demand", demand)
        if mix:
            for k, v in mix.items():
                add(h, k, v)
            for tech in TECHS:
                v = mix[tech]
                if v is None:
                    continue
                add(d, "gen_" + tech, v)
                if es is not None and v > 0:
                    d["cap_" + tech] += mul(es, v)
                    d["cap_" + tech + "#"] += v
            if demand is not None and mix["solar"] is not None:
                res = demand - mix["wind"] - mix["solar"]
                add(h, "residual", res)
                add(d, "res_mean", res)
                day = t.astimezone(PARIS).date()
                lows[day] = res if day not in lows else min(lows[day], res)
                highs[day] = res if day not in highs else max(highs[day], res)

    def mean(acc, key, digits):
        n = acc.get(key + "#", 0)
        if not n:
            return ""
        v = acc[key] / n
        return round(v, digits) if digits else int(round(v))

    rows = []
    for t in sorted(hours):
        a = hours[t]
        row = {"t": t.strftime("%Y-%m-%dT%H:%MZ")}
        for z in ("es", "fr", "pt"):
            row[z] = mean(a, z, 2)
            if a.get(z + "#"):
                row[z + "_neg"] = round(a.get(z + "_neg", 0), 2)
                row[z + "_zero"] = round(a.get(z + "_zero", 0), 2)
        for k in ("demand", "residual", "nuclear", "wind", "solar", "hydro", "ccgt", "coal", "chp", "ren_th", "pump", "net_exp"):
            row[k] = mean(a, k, 0)
        rows.append(row)
    if rows:
        HOURLY_DIR.mkdir(parents=True, exist_ok=True)
        write_rows(HOURLY_DIR / (str(year) + ".csv"), HOURLY_FIELDS, rows)

    out = []
    for day in sorted(days):
        a = days[day]
        row = {"date": day.isoformat()}
        for tech in TECHS:
            enough = a.get("gen_" + tech + "#", 0) >= 80
            w = a.get("cap_" + tech + "#", 0)
            row["cap_" + tech] = round(a["cap_" + tech] / w, 2) if enough and w >= 1 else ""
            row["gen_" + tech] = mean(a, "gen_" + tech, 0) if enough else ""
        if a.get("res_mean#", 0) >= 80:
            row["res_mean"] = mean(a, "res_mean", 0)
            row["res_min"] = round(lows[day])
            row["res_max"] = round(highs[day])
        for z in ("FR", "PT"):
            n = a.get("par_" + z + "#", 0)
            if n >= 80:
                row["par_" + z] = round(100 / n / (1 / a["par_" + z]), 1) if a["par_" + z] else 0.0
        out.append(row)
    print("  " + str(year) + ": " + str(len(out)) + " days, " + str(len(rows)) + " hours")
    return out


def build(first_year):
    """Rebuild every year from first_year to this one, one year at a time."""
    last = datetime.now(PARIS).year + 1
    new_rows = []
    for year in range(first_year, last + 1):
        new_rows.extend(build_year(year))
    path = DAILY_DIR / "market.csv"
    keep = [r for r in read_rows(path) if int(r["date"][:4]) < first_year] if path.exists() else []
    write_rows(path, DAILY_FIELDS, keep + new_rows)
    print("Spain market summaries rebuilt from " + str(first_year) + ": " + str(len(new_rows)) + " days")
    return len(new_rows)


def build_recent():
    today = datetime.now(PARIS).date()
    return build((today - timedelta(days=10)).year)
