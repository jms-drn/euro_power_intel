"""Daily day-ahead price summaries for the Spain pages: Spain, France and
Portugal, from the stored ENTSO-E prices (data/prices/ES, FR, PT).

Writes data/es/daily/prices.csv, one row per local day (Madrid and Paris
share the same clock), with for each zone Z:
  Z_base  time-weighted average of the day
  Z_peak  Monday-Friday 08:00-20:00 average (market standard)
  Z_off   every other period
  Z_min, Z_max  lowest and highest period
  Z_std   standard deviation within the day
  Z_neg   hours with a price below zero
  Z_zero  hours at exactly zero
  Z_negd  negative-price depth (EUR/MWh times hours below zero)
A day needs at least 20 hours of prices. Run by es_update.py and
es_summarise.py. No asterisks in this file: chat formatting strips them.
"""
import math
from collections import defaultdict
from operator import mul

from es_store import DAILY_DIR, monthly_files, read_rows, write_rows
from store import DATA_DIR, PARIS, parse_ts

ZONES = ["ES", "FR", "PT"]
MEASURES = ["base", "peak", "off", "min", "max", "std", "neg", "zero", "negd"]


def zone_days(zone):
    acc = defaultdict(lambda: {"h": 0.0, "s": 0.0, "s2": 0.0, "ph": 0.0, "ps": 0.0, "oh": 0.0, "os": 0.0,
                               "lo": None, "hi": None, "neg": 0.0, "zero": 0.0, "negd": 0.0})
    for path in monthly_files(DATA_DIR / "prices" / zone):
        for row in read_rows(path):
            eur = row.get("eur")
            if eur in (None, ""):
                continue
            p = float(eur)
            t = parse_ts(row["start_utc"]).astimezone(PARIS)
            h = int(row.get("min") or 60) / 60
            a = acc[t.date()]
            a["h"] += h
            a["s"] += mul(p, h)
            a["s2"] += mul(mul(p, p), h)
            if t.weekday() < 5 and 8 <= t.hour < 20:
                a["ph"] += h
                a["ps"] += mul(p, h)
            else:
                a["oh"] += h
                a["os"] += mul(p, h)
            a["lo"] = p if a["lo"] is None else min(a["lo"], p)
            a["hi"] = p if a["hi"] is None else max(a["hi"], p)
            if p < 0:
                a["neg"] += h
                a["negd"] += mul(-p, h)
            elif p == 0:
                a["zero"] += h
    out = {}
    for d, a in acc.items():
        if a["h"] < 20:
            continue
        mean = a["s"] / a["h"]
        var = max(0.0, a["s2"] / a["h"] - mul(mean, mean))
        out[d] = {
            "base": round(mean, 2),
            "peak": round(a["ps"] / a["ph"], 2) if a["ph"] else "",
            "off": round(a["os"] / a["oh"], 2) if a["oh"] else "",
            "min": round(a["lo"], 2),
            "max": round(a["hi"], 2),
            "std": round(math.sqrt(var), 2),
            "neg": round(a["neg"], 2),
            "zero": round(a["zero"], 2),
            "negd": round(a["negd"], 1),
        }
    return out


def summarise_prices():
    per_zone = {z: zone_days(z) for z in ZONES}
    dates = sorted({d for v in per_zone.values() for d in v})
    fields = ["date"] + [z + "_" + m for z in ZONES for m in MEASURES]
    rows = []
    for d in dates:
        row = {"date": d.isoformat()}
        for z in ZONES:
            vals = per_zone[z].get(d)
            if vals:
                for m in MEASURES:
                    row[z + "_" + m] = vals[m]
        rows.append(row)
    write_rows(DAILY_DIR / "prices.csv", fields, rows)
    print("Spain price summaries: " + str(len(rows)) + " days (" + ", ".join(z + " " + str(len(per_zone[z])) for z in ZONES) + ")")
    return len(rows)
