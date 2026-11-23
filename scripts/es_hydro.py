"""Spain hydro summaries for the Hydro page, built from the hourly files
written by es_market.py (data/es/hourly/YYYY.csv). No downloads.

Writes:
  data/es/hydro/monthly.csv   one row per year and month (local time), with
      sums so the site can add up any run of months:
        hours, psum, pn          hours; sum and count of Spanish prices
        net_mwh                  REE net hydro output (can be negative)
        q, qp                    positive net hydro output, and output times
                                 price (capture price = qp / q)
        cfq, cfqp                the same for last year's output (same
                                 weekday, 364 days earlier) on this year's
                                 prices: used to split capture-price changes
        gq, gqp                  hydro before pumping (from Dec 2024)
        pump_mwh, pq, pp, pneg   pumping consumption, pumping energy priced,
                                 its cost, and pumping in hours at or below
                                 zero price
        turb_mwh, tq, tp         pumped-storage generation and its revenue
        topq, allq               net output in each day's top-quarter price
                                 hours, and in all hours with a price
        corr_sum, corr_n         daily correlation of hydro output and price
        wv                       implied water value: median price in the
                                 month's hours when net hydro was in its top
                                 quarter (the site's own estimate)
  data/es/hydro/profile.csv   average hydro output and price by year, month
      and local hour: net, gross, pump, turb, price, n.

build() rebuilds every year; build_recent() the current year (and the
previous one in early January).
Code note: no asterisks or double underscores (chat formatting strips them).
"""
import math
from collections import defaultdict
from datetime import datetime, timedelta
from operator import mul

from es_store import ES_DIR, read_rows, write_rows
from store import PARIS, parse_ts

HOURLY_DIR = ES_DIR / "hourly"
OUT_DIR = ES_DIR / "hydro"
YEAR_SHIFT = timedelta(days=364)
SUMS = ["hours", "psum", "pn", "net_mwh", "q", "qp", "cfq", "cfqp", "gq", "gqp", "pump_mwh", "pq", "pp", "pneg",
        "turb_mwh", "tq", "tp", "topq", "allq", "corr_sum", "corr_n"]
MONTHLY_FIELDS = ["year", "month"] + SUMS + ["wv"]
PROFILE_FIELDS = ["year", "month", "hour", "net", "gross", "pump", "turb", "price", "n"]


def num(v):
    return None if v in (None, "") else float(v)


def load_year(year):
    path = HOURLY_DIR / (str(year) + ".csv")
    if not path.exists():
        return {}
    out = {}
    for r in read_rows(path):
        out[parse_ts(r.get("t"))] = {k: num(r.get(k)) for k in ("es", "hydro", "hydro_gross", "pump", "turb")}
    return out


def median(vs):
    vs = sorted(vs)
    n = len(vs)
    if not n:
        return None
    return vs[n // 2] if n % 2 else (vs[n // 2 - 1] + vs[n // 2]) / 2


def corr(xs, ys):
    n = len(xs)
    mx = sum(xs) / n
    my = sum(ys) / n
    sxy = sum(mul(x - mx, y - my) for x, y in zip(xs, ys))
    sxx = sum(mul(x - mx, x - mx) for x in xs)
    syy = sum(mul(y - my, y - my) for y in ys)
    return sxy / math.sqrt(mul(sxx, syy)) if sxx > 0 and syy > 0 else None


def build_year(year):
    cur = load_year(year)
    if not cur:
        return [], []
    prev = load_year(year - 1)
    months = defaultdict(lambda: defaultdict(float))
    prof = defaultdict(lambda: defaultdict(float))
    days = defaultdict(list)
    for t in sorted(cur):
        r = cur.get(t)
        lt = t.astimezone(PARIS)
        if lt.year != year:
            continue
        m = months[lt.month]
        pr = prof[(lt.month, lt.hour)]
        p = r.get("es")
        net = r.get("hydro")
        gross = r.get("hydro_gross")
        pump = r.get("pump")
        turb = r.get("turb")
        m["hours"] += 1
        pr["n"] += 1
        for key, v in (("net", net), ("gross", gross), ("pump", pump), ("turb", turb), ("price", p)):
            if v is not None:
                pr[key] += v
                pr[key + "#"] += 1
        if p is not None:
            m["psum"] += p
            m["pn"] += 1
        if net is not None:
            m["net_mwh"] += net
            q = max(0.0, net)
            if p is not None:
                m["q"] += q
                m["qp"] += mul(q, p)
                days[lt.date()].append((p, net))
        if gross is not None and p is not None:
            g = max(0.0, gross)
            m["gq"] += g
            m["gqp"] += mul(g, p)
        if pump is not None:
            e = -min(0.0, pump)
            m["pump_mwh"] += e
            if p is not None:
                m["pq"] += e
                m["pp"] += mul(e, p)
                if p <= 0:
                    m["pneg"] += e
        if turb is not None:
            e = max(0.0, turb)
            m["turb_mwh"] += e
            if p is not None:
                m["tq"] += e
                m["tp"] += mul(e, p)
        before = prev.get(t - YEAR_SHIFT) or cur.get(t - YEAR_SHIFT)
        if before and before.get("hydro") is not None and p is not None:
            qb = max(0.0, before.get("hydro"))
            m["cfq"] += qb
            m["cfqp"] += mul(qb, p)

    for d, hours in days.items():
        if len(hours) < 20:
            continue
        m = months[d.month]
        ranked = sorted(hours, key=lambda x: x[0], reverse=True)
        top = ranked[0:max(1, len(ranked) // 4)]
        m["topq"] += sum(max(0.0, h[1]) for h in top)
        m["allq"] += sum(max(0.0, h[1]) for h in hours)
        c = corr([h[1] for h in hours], [h[0] for h in hours])
        if c is not None:
            m["corr_sum"] += c
            m["corr_n"] += 1

    monthly = []
    for month in sorted(months):
        m = months[month]
        row = {"year": year, "month": month}
        for k in SUMS:
            row[k] = round(m.get(k, 0.0), 1)
        pairs = [(p, n) for d, hs in days.items() if d.month == month for p, n in hs]
        if len(pairs) >= 100:
            nets = sorted(n for p, n in pairs)
            cut = nets[int(len(nets) / 4 + len(nets) / 2)]
            row["wv"] = round(median([p for p, n in pairs if n >= cut]), 2)
        monthly.append(row)
    profile = []
    for key in sorted(prof):
        a = prof[key]
        row = {"year": year, "month": key[0], "hour": key[1], "n": int(a["n"])}
        for k in ("net", "gross", "pump", "turb", "price"):
            row[k] = round(a[k] / a[k + "#"], 1) if a.get(k + "#") else ""
        profile.append(row)
    print("  hydro " + str(year) + ": " + str(len(monthly)) + " months")
    return monthly, profile


def build(first_year=None):
    years = sorted(int(p.stem) for p in HOURLY_DIR.iterdir() if p.suffix == ".csv" and p.stem.isdigit()) if HOURLY_DIR.exists() else []
    if not years:
        print("Spain hydro summaries: no hourly files yet")
        return 0
    first = first_year or years[0]
    keep_m = []
    keep_p = []
    if first_year:
        for name, keep in (("monthly.csv", keep_m), ("profile.csv", keep_p)):
            path = OUT_DIR / name
            if path.exists():
                keep.extend(r for r in read_rows(path) if int(r.get("year")) < first)
    for year in years:
        if year < first:
            continue
        mo, pr = build_year(year)
        keep_m.extend(mo)
        keep_p.extend(pr)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    write_rows(OUT_DIR / "monthly.csv", MONTHLY_FIELDS, keep_m)
    write_rows(OUT_DIR / "profile.csv", PROFILE_FIELDS, keep_p)
    print("Spain hydro summaries: " + str(len(keep_m)) + " months from " + str(first))
    return len(keep_m)


def build_recent():
    today = datetime.now(PARIS).date()
    return build((today - timedelta(days=10)).year)
