"""Notable events for Spain, shown in the site's bell on the Spain pages.

Reads Spain's daily summaries and writes data/es/alerts.json in the same
form as France's data/alerts.json: a list of {id, date, level, title,
detail, link}, where level is "record" (highest or lowest in the whole
history, at least a year of it), "since" (highest or lowest for at least
7 days for prices, 30 days for demand and generation) or "event"
(negative prices). Links start with "es/" so they open the Spain pages.
Events from the last five days of data are kept.
Code note: no asterisks or double underscores (chat formatting strips them).
"""
import json
from datetime import date, datetime, timedelta, timezone

from es_store import DAILY_DIR, ES_DIR, read_rows
from store import PARIS

UTC = timezone.utc
OUT = ES_DIR / "alerts.json"


def series(rows, get):
    out = []
    for r in rows:
        try:
            v = get(r)
        except (TypeError, ValueError):
            v = None
        if v is not None:
            out.append((date.fromisoformat(r["date"]), v))
    return out


def num(v):
    return None if v in (None, "") else float(v)


def nice(d):
    return d.strftime("%d %b %Y").lstrip("0")


def extreme(points, i, higher, min_days):
    """(level, detail) when point i is the highest/lowest for at least
    min_days, else None."""
    d, v = points[i]
    for j in range(i - 1, -1, -1):
        dj, w = points[j]
        if (w >= v) if higher else (w <= v):
            gap = (d - dj).days
            if gap < min_days:
                return None
            return "since", ("highest" if higher else "lowest") + " since " + nice(dj)
    if points and (d - points[0][0]).days >= 365:
        return "record", ("highest" if higher else "lowest") + " since records began on " + nice(points[0][0])
    return None


def build():
    today = datetime.now(PARIS).date()
    first = today - timedelta(days=4)
    prices = read_rows(DAILY_DIR / "prices.csv") if (DAILY_DIR / "prices.csv").exists() else []
    demand = read_rows(DAILY_DIR / "demand.csv") if (DAILY_DIR / "demand.csv").exists() else []
    mix = read_rows(DAILY_DIR / "mix.csv") if (DAILY_DIR / "mix.csv").exists() else []
    alerts = []

    def scan(points, kind, label, unit, fmt, link, min_days, which=(True, False), last=None):
        for i, (d, v) in enumerate(points):
            if d < first or (last and d > last):
                continue
            for higher in which:
                hit = extreme(points, i, higher, min_days)
                if hit:
                    level, detail = hit
                    alerts.append({
                        "id": "es-" + kind + "-" + ("hi" if higher else "lo") + "-" + d.isoformat(),
                        "date": d.isoformat(), "level": level,
                        "title": label + " " + fmt(v) + " " + unit + (" tomorrow" if d > today else ""),
                        "detail": nice(d) + ": " + detail + ".", "link": link,
                    })

    yesterday = today - timedelta(days=1)
    scan(series(prices, lambda r: num(r["ES_base"])), "base", "Spanish baseload", "€/MWh",
         lambda v: format(v, ".2f"), "es/prices/explorer", 7)
    scan(series(demand, lambda r: num(r["peak"]) if num(r.get("hours")) and num(r["hours"]) >= 23 else None),
         "peak", "Spanish demand peak", "GW", lambda v: format(v / 1000, ".1f"), "es/demand/explorer", 30,
         (True,), yesterday)
    scan(series(mix, lambda r: num(r["wind"])), "wind", "Spanish wind output averaged", "GW",
         lambda v: format(v / 1000, ".1f"), "es/generation/explorer", 30, (True, False), yesterday)

    def solar(r):
        pv = num(r.get("solar_pv"))
        return pv + (num(r.get("solar_thermal")) or 0) if pv is not None else num(r.get("solar"))
    scan(series(mix, solar), "solar", "Spanish solar output averaged", "GW",
         lambda v: format(v / 1000, ".1f"), "es/generation/explorer", 30, (True,), yesterday)

    for r in prices:
        d = date.fromisoformat(r["date"])
        neg = num(r.get("ES_neg"))
        if d >= first and neg:
            when = "tomorrow" if d > today else "today" if d == today else nice(d)
            alerts.append({
                "id": "es-neg-" + d.isoformat(), "date": d.isoformat(), "level": "event",
                "title": "Negative Spanish prices " + when,
                "detail": format(neg, ".2f").rstrip("0").rstrip(".") + " hours below zero, lowest "
                          + format(num(r["ES_min"]), ".2f") + " €/MWh.",
                "link": "es/prices/negative",
            })
    alerts.sort(key=lambda a: a["date"], reverse=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"generated_utc": datetime.now(UTC).strftime("%Y-%m-%dT%H:%MZ"), "alerts": alerts},
                              indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print("Spain alerts: " + str(len(alerts)))
    return len(alerts)
