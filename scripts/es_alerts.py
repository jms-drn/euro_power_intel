"""Notable events for Spain, shown in the site's bell on the Spain pages.

Reads Spain's daily summaries and MITECO's weekly reservoir levels and
writes data/es/alerts.json in the same form as France's data/alerts.json:
a list of {id, date, level, title, detail, link}, where level is "record"
(highest or lowest in the whole history, at least a year of it), "since"
(highest or lowest for at least 7 days for prices, 30 days for demand and
generation, 5 years for reserves at the same time of year) or "event"
(negative prices, large reservoir moves). Links start with "es/" so they
open the Spain pages. Basin and reservoir events come from es_alerts_hydro.
Code note: no asterisks or double underscores (chat formatting strips them).
"""
import json
from datetime import date, datetime, timedelta, timezone

import es_alerts_hydro
from es_store import DAILY_DIR, ES_DIR, read_rows
from store import PARIS

UTC = timezone.utc
OUT = ES_DIR / "alerts.json"
RESERVOIRS = ES_DIR / "reservoirs.csv"


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


def rows_of(path):
    return read_rows(path) if path.exists() else []


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
    start = points[0] if points else None
    if start and (d - start[0]).days >= 365:
        return "record", ("highest" if higher else "lowest") + " since records began on " + nice(start[0])
    return None


def same_week(points, d, year):
    """Value of the bulletin closest to the same date in another year (within 4 days)."""
    try:
        target = d.replace(year=year)
    except ValueError:
        target = d.replace(year=year, day=28)
    best = None
    for dj, v in points:
        gap = abs((dj - target).days)
        if gap <= 4 and (best is None or gap < best[0]):
            best = (gap, v)
    return best[1] if best else None


def reservoir_alerts(first, alerts):
    """Hydroelectric energy stored: unusual for the time of year, or an
    unusually large weekly change."""
    pts = series(rows_of(RESERVOIRS), lambda r: (num(r["energy"]), num(r["energy_cap"])) if num(r["energy"]) and num(r["energy_cap"]) else None)
    if len(pts) < 60:
        return
    fills = [(d, 100 / e[1] / (1 / e[0])) for d, e in pts]
    dates = [d for d, e in pts]
    energies = [e[0] for d, e in pts]
    first_year = dates[0].year
    for i, (d, fill) in enumerate(fills):
        if d < first:
            continue
        energy = energies[i]
        for higher in (True, False):
            year = d.year - 1
            since = None
            while year >= first_year:
                v = same_week(fills, d, year)
                if v is not None and ((v >= fill) if higher else (v <= fill)):
                    since = year
                    break
                year -= 1
            span = d.year - (since if since else first_year)
            if span < 5:
                continue
            word = "highest" if higher else "lowest"
            detail = (word + " for the time of year since " + str(since)) if since else (word + " for the time of year since records began in " + str(first_year))
            alerts.append({
                "id": "es-res-" + ("hi" if higher else "lo") + "-" + d.isoformat(), "date": d.isoformat(),
                "level": "since" if since else "record",
                "title": "Spanish hydro reserves " + format(fill, ".1f") + "% full (" + format(energy / 1000, ".2f") + " TWh)",
                "detail": "MITECO bulletin of " + nice(d) + ": " + detail + ".", "link": "es/hydro/year",
            })
        if i == 0:
            continue
        change = energy - energies[i - 1]
        changes = [(dates[j], energies[j] - energies[j - 1]) for j in range(1, i + 1)]
        hit = extreme(changes, len(changes) - 1, change > 0, 365)
        if hit:
            level, detail = hit
            word = "rise" if change > 0 else "fall"
            alerts.append({
                "id": "es-resw-" + d.isoformat(), "date": d.isoformat(), "level": level,
                "title": "Spanish hydro reserves " + ("up " if change > 0 else "down ") + format(abs(change), ",.0f") + " GWh in a week",
                "detail": "MITECO bulletin of " + nice(d) + ": largest weekly " + word + detail.replace("highest", "").replace("lowest", "") + ".",
                "link": "es/hydro/year",
            })


def build():
    today = datetime.now(PARIS).date()
    first = today - timedelta(days=4)
    prices = rows_of(DAILY_DIR / "prices.csv")
    demand = rows_of(DAILY_DIR / "demand.csv")
    mix = rows_of(DAILY_DIR / "mix.csv")
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
    # Reservoir bulletins refer to a Tuesday and are published a day or two
    # later, so the last eight days are checked.
    reservoir_alerts(today - timedelta(days=8), alerts)
    es_alerts_hydro.build(today - timedelta(days=8), alerts)
    alerts.sort(key=lambda a: a["date"], reverse=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"generated_utc": datetime.now(UTC).strftime("%Y-%m-%dT%H:%MZ"), "alerts": alerts},
                              indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print("Spain alerts: " + str(len(alerts)))
    return len(alerts)
