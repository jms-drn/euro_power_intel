"""Spanish reservoir levels from MITECO's weekly Boletin Hidrologico.

Source: the public ArcGIS table behind MITECO's bulletin dashboard
(owner BolHidro_miteco), Embalses_Total: one row per reservoir per weekly
bulletin since January 1988, mainland reservoirs over 5 hm3. Rather than
downloading every row, the script asks the service to add them up per
bulletin date, once for all reservoirs and once for hydroelectric ones
(electrico_flag = 1).

Writes data/es/reservoirs.csv, one row per bulletin date:
  date                 bulletin date (the Tuesday the data refers to)
  water_hm3, cap_hm3   water stored and capacity, all reservoirs (hm3)
  hydro_water_hm3, hydro_cap_hm3   the same, hydroelectric reservoirs
  energy, energy_cap   hydroelectric energy stored and maximum, as
                       published (MITECO's theoretical calculation)
  reservoirs, hydro_reservoirs     how many reservoirs reported

Usage:
  python scripts/es_reservoirs.py              last 10 weeks (regular update)
  python scripts/es_reservoirs.py --from 1988  full history from that year
Code note: no asterisks, double underscores or format codes inside
f-strings (chat formatting strips them).
"""
import argparse
import csv
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

URL = "https://services-eu1.arcgis.com/RvnYk1PBUJ9rrAuT/arcgis/rest/services/Embalses_Total/FeatureServer/0/query"
OUT = Path("data") / "es" / "reservoirs.csv"
FIELDS = ["date", "water_hm3", "cap_hm3", "hydro_water_hm3", "hydro_cap_hm3", "energy", "energy_cap", "reservoirs", "hydro_reservoirs"]


def get(params):
    url = URL + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "euro-power-intel"})
    for attempt in range(1, 5):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                body = json.loads(r.read().decode("utf-8", "replace"))
            if "error" in body:
                raise RuntimeError(json.dumps(body.get("error"))[0:300])
            return body
        except (urllib.error.URLError, TimeoutError, RuntimeError) as error:
            if attempt == 4:
                raise
            print("  retry " + str(attempt) + ": " + str(error)[0:200])
            time.sleep(15 + 15 + attempt)
    return {}


def stat(kind, field, name):
    return {"statisticType": kind, "onStatisticField": field, "outStatisticFieldName": name}


def weekly(start, end, hydro_only):
    """Sums per bulletin date between two dates (inclusive)."""
    where = "fecha >= timestamp '" + start.isoformat() + " 00:00:00' AND fecha < timestamp '" + (end + timedelta(days=1)).isoformat() + " 00:00:00'"
    if hydro_only:
        where += " AND electrico_flag = 1"
    body = get({
        "where": where,
        "groupByFieldsForStatistics": "fecha",
        "outStatistics": json.dumps([
            stat("sum", "agua_actual", "water"), stat("sum", "agua_total", "cap"),
            stat("sum", "energia_actual", "energy"), stat("sum", "energia_total", "energy_cap"),
            stat("count", "EMBALSE_ID", "n")]),
        "orderByFields": "fecha",
        "f": "json",
    })
    out = {}
    feats = body.get("features") or []
    for feat in feats:
        a = feat.get("attributes") or {}
        ms = a.get("fecha")
        if ms is None:
            continue
        # Dates are stored as midnight in Spain, i.e. late the evening before
        # in UTC: shift by 12 hours before taking the date.
        d = datetime.fromtimestamp(ms / 1000 + 43200, timezone.utc).date()
        out[d.isoformat()] = a
    return out


def num(v, digits=0):
    if v is None:
        return ""
    return str(round(v, digits)) if digits else str(int(round(v)))


def read_existing():
    if not OUT.exists():
        return {}
    with OUT.open(newline="", encoding="utf-8") as h:
        return {r.get("date"): r for r in csv.DictReader(h)}


def fetch(start, end):
    """Rows for every bulletin date between start and end, a year at a time."""
    rows = {}
    a = start
    while a <= end:
        b = min(date(a.year, 12, 31), end)
        allr = weekly(a, b, False)
        hyd = weekly(a, b, True)
        for d, x in allr.items():
            h = hyd.get(d, {})
            rows[d] = {
                "date": d, "water_hm3": num(x.get("water")), "cap_hm3": num(x.get("cap")),
                "hydro_water_hm3": num(h.get("water")), "hydro_cap_hm3": num(h.get("cap")),
                "energy": num(x.get("energy")), "energy_cap": num(x.get("energy_cap")),
                "reservoirs": num(x.get("n")), "hydro_reservoirs": num(h.get("n")),
            }
        print("  " + str(a.year) + ": " + str(len(allr)) + " bulletins")
        a = date(a.year + 1, 1, 1)
        time.sleep(1)
    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--from", dest="first", type=int, default=0)
    args = parser.parse_args()
    today = datetime.now(timezone.utc).date()
    start = date(args.first, 1, 1) if args.first else today - timedelta(days=70)
    rows = read_existing()
    new = fetch(start, today)
    changed = sum(1 for d, r in new.items() if rows.get(d) != r)
    rows.update(new)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", newline="", encoding="utf-8") as h:
        w = csv.DictWriter(h, fieldnames=FIELDS, lineterminator="\n")
        w.writeheader()
        for d in sorted(rows):
            w.writerow(rows.get(d))
    print("Spain reservoirs: " + str(len(rows)) + " bulletins stored, " + str(changed) + " added or changed")
    dates = sorted(rows)
    if dates:
        last = rows.get(dates[-1])
        print("Latest bulletin " + last.get("date") + ": all reservoirs " + last.get("water_hm3") + " of " + last.get("cap_hm3")
              + " hm3; hydroelectric " + last.get("hydro_water_hm3") + " of " + last.get("hydro_cap_hm3")
              + " hm3; energy " + last.get("energy") + " of " + last.get("energy_cap") + "; reservoirs reporting " + last.get("reservoirs"))


main()
