"""Spain hydro summaries by type for the Hydro page, built from the stored
data (no downloads): REE net hydro and Spanish prices from the hourly files
(data/es/hourly/YYYY.csv, es_market.py) and ENTSO-E hydro by type from
data/es/hydro_split (es_hydro_split.py).

Types:
  total   REE real-time hydro, net of pumping (every year)
  gen     ENTSO-E run-of-river + reservoir + pumped-storage output
  res     reservoir (includes pumped-storage output before about 2021)
  ror     run-of-river
  ps      pumped-storage output
  pump    pumping consumption (positive)

Writes:
  data/es/hydro/monthly_types.csv  one row per year, month and type, with
      sums so the site can add up any run of months:
        hours            hours with a value
        psum, pn         sum and count of Spanish prices in those hours
        mwh              sum of the series (total can be negative)
        q, qp            positive output (MWh) and output times price
        qneg             output in hours at or below zero price
        cfq, cfqp        the same type 364 days earlier, on this year's
                         prices (splits capture-price changes)
        topq, allq       output in each day's top-quarter price hours, and
                         in all hours of days with 20 or more prices
        corr_sum, corr_n daily correlation of the series with price
        wv               median price when the series is in its top quarter
                         for the month (the implied water value)
  data/es/hydro/profile_types.csv  average MW and price by year, month and
      local hour: price, total, gen, res, ror, ps, pump, n
Code note: no asterisks or double underscores (chat formatting strips them).
"""
from collections import defaultdict
from datetime import datetime, timedelta
from operator import mul

from es_hydro import corr, median
from es_store import ES_DIR, read_rows, write_rows
from store import PARIS, parse_ts

HOURLY_DIR = ES_DIR / "hourly"
SPLIT_DIR = ES_DIR / "hydro_split"
OUT_DIR = ES_DIR / "hydro"
TYPES = ("total", "gen", "res", "ror", "ps", "pump")
SHIFT = timedelta(days=364)
SUMS = ["hours", "psum", "pn", "mwh", "q", "qp", "qneg", "cfq", "cfqp", "topq", "allq", "corr_sum", "corr_n"]
MONTHLY_FIELDS = ["year", "month", "type"] + SUMS + ["wv"]
PROFILE_FIELDS = ["year", "month", "hour", "price"] + list(TYPES) + ["n"]


def num(v):
    return None if v in (None, "") else float(v)


def load_year(year):
    """Hourly price and value of every type, keyed by UTC hour start."""
    out = defaultdict(dict)
    path = HOURLY_DIR / (str(year) + ".csv")
    if path.exists():
        for r in read_rows(path):
            rec = out[parse_ts(r.get("t"))]
            rec["price"] = num(r.get("es"))
            rec["total"] = num(r.get("hydro"))
    ydir = SPLIT_DIR / str(year)
    if ydir.exists():
        for path in sorted(p for p in ydir.iterdir() if p.suffix == ".csv"):
            for r in read_rows(path):
                rec = out[parse_ts(r.get("t"))]
                ror, res, ps = num(r.get("ror")), num(r.get("res")), num(r.get("ps"))
                rec.update({"ror": ror, "res": res, "ps": ps, "pump": num(r.get("pump"))})
                if ror is not None and res is not None:
                    rec["gen"] = ror + res + (ps or 0.0)
    return out


def build_year(year):
    cur = load_year(year)
    if not cur:
        return [], []
    prev = load_year(year - 1)
    acc = defaultdict(lambda: defaultdict(float))
    prof = defaultdict(lambda: defaultdict(float))
    days = defaultdict(list)
    for t in sorted(cur):
        lt = t.astimezone(PARIS)
        if lt.year != year:
            continue
        rec = cur.get(t)
        p = rec.get("price")
        pr = prof[(lt.month, lt.hour)]
        pr["n"] += 1
        if p is not None:
            pr["price"] += p
            pr["price#"] += 1
        before = prev.get(t - SHIFT) or cur.get(t - SHIFT) or {}
        for ty in TYPES:
            v = rec.get(ty)
            if v is None:
                continue
            pr[ty] += v
            pr[ty + "#"] += 1
            a = acc[(lt.month, ty)]
            a["hours"] += 1
            a["mwh"] += v
            q = max(0.0, v)
            a["q"] += q
            if p is None:
                continue
            a["psum"] += p
            a["pn"] += 1
            a["qp"] += mul(q, p)
            if p <= 0:
                a["qneg"] += q
            b = before.get(ty)
            if b is not None:
                a["cfq"] += max(0.0, b)
                a["cfqp"] += mul(max(0.0, b), p)
            days[(lt.date(), ty)].append((p, v))

    for (d, ty), hours in days.items():
        if len(hours) < 20:
            continue
        a = acc[(d.month, ty)]
        ranked = sorted(hours, key=lambda x: x[0], reverse=True)
        a["topq"] += sum(max(0.0, h[1]) for h in ranked[0:max(1, len(ranked) // 4)])
        a["allq"] += sum(max(0.0, h[1]) for h in hours)
        c = corr([h[1] for h in hours], [h[0] for h in hours])
        if c is not None:
            a["corr_sum"] += c
            a["corr_n"] += 1

    monthly = []
    for (month, ty) in sorted(acc, key=lambda k: (k[0], TYPES.index(k[1]))):
        a = acc[(month, ty)]
        row = {"year": year, "month": month, "type": ty}
        for k in SUMS:
            row[k] = round(a.get(k, 0.0), 1)
        pairs = [h for (d, t2), hs in days.items() if d.month == month and t2 == ty for h in hs]
        if len(pairs) >= 100:
            vals = sorted(v for p, v in pairs)
            cut = vals[int(len(vals) / 4 + len(vals) / 2)]
            row["wv"] = round(median([p for p, v in pairs if v >= cut]), 2)
        monthly.append(row)
    profile = []
    for (month, hour) in sorted(prof):
        a = prof[(month, hour)]
        row = {"year": year, "month": month, "hour": hour, "n": int(a["n"])}
        for k in ("price",) + TYPES:
            row[k] = round(a[k] / a[k + "#"], 1) if a.get(k + "#") else ""
        profile.append(row)
    print("  hydro types " + str(year) + ": " + str(len(monthly)) + " month-type rows")
    return monthly, profile


def build(first_year=None):
    years = sorted(int(p.stem) for p in HOURLY_DIR.iterdir() if p.suffix == ".csv" and p.stem.isdigit()) if HOURLY_DIR.exists() else []
    if not years:
        print("Spain hydro types: no hourly files yet")
        return 0
    first = first_year or years[0]
    keep_m, keep_p = [], []
    if first_year:
        for name, keep in (("monthly_types.csv", keep_m), ("profile_types.csv", keep_p)):
            path = OUT_DIR / name
            if path.exists():
                keep.extend(r for r in read_rows(path) if int(r.get("year")) < first)
    for year in years:
        if year >= first:
            mo, pr = build_year(year)
            keep_m.extend(mo)
            keep_p.extend(pr)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    write_rows(OUT_DIR / "monthly_types.csv", MONTHLY_FIELDS, keep_m)
    write_rows(OUT_DIR / "profile_types.csv", PROFILE_FIELDS, keep_p)
    print("Spain hydro types: " + str(len(keep_m)) + " month-type rows from " + str(first))
    return len(keep_m)


def build_recent():
    today = datetime.now(PARIS).date()
    return build((today - timedelta(days=10)).year)
