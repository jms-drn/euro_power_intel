"""Basin and reservoir events for Spain's bell, from MITECO's weekly
bulletin (data/es/basins.csv and data/es/map/reservoirs.json, written by
es_basins.py). Called by es_alerts.build(); links open the Reserves map.

- A basin's reservoirs are the fullest or emptiest for the time of year in at
  least 5 years (or since records began in 1988).
- A basin's largest weekly rise or fall in percentage points for at least a
  year.
- Reservoirs of 100 hm3 or more whose level moved 10 points or more in a
  week (the three largest moves).
Code note: no asterisks or double underscores (chat formatting strips them).
"""
import csv
import json
from collections import defaultdict
from datetime import date
from operator import mul

from es_store import ES_DIR

BASINS = ES_DIR / "basins.csv"
RESERVOIRS = ES_DIR / "map" / "reservoirs.json"
LINK = "es/hydro/map"


def nice(d):
    return d.strftime("%d %b %Y").lstrip("0")


def num(v):
    return None if v in (None, "") else float(v)


def nearest(points, target):
    best = None
    for d, v in points:
        gap = abs((d - target).days)
        if gap <= 4 and (best is None or gap < best[0]):
            best = (gap, v)
    return best[1] if best else None


def same_week(points, d, year):
    try:
        target = d.replace(year=year)
    except ValueError:
        target = d.replace(year=year, day=28)
    return nearest(points, target)


def basin_series():
    out = defaultdict(list)
    names = {}
    if not BASINS.exists():
        return out, names
    with BASINS.open(newline="", encoding="utf-8") as h:
        for r in csv.DictReader(h):
            water, cap = num(r.get("water_hm3")), num(r.get("cap_hm3"))
            if water is None or not cap:
                continue
            out[r.get("key")].append((date.fromisoformat(r.get("date")), mul(water, 100) / cap))
            names[r.get("key")] = r.get("basin")
    for k in out:
        out[k].sort()
    return out, names


def basin_alerts(first, alerts):
    series, names = basin_series()
    for k, pts in series.items():
        if len(pts) < 60:
            continue
        dates = [p[0] for p in pts]
        fills = [p[1] for p in pts]
        first_year = dates[0].year
        name = names.get(k)
        for i, (d, fill) in enumerate(pts):
            if d < first:
                continue
            for higher in (True, False):
                since = None
                year = d.year - 1
                while year >= first_year:
                    v = same_week(pts, d, year)
                    if v is not None and ((v >= fill) if higher else (v <= fill)):
                        since = year
                        break
                    year -= 1
                if d.year - (since if since else first_year) < 5:
                    continue
                word = "fullest" if higher else "emptiest"
                detail = (word + " for the time of year since " + str(since)) if since else (word + " for the time of year since records began in " + str(first_year))
                alerts.append({"id": "es-basin-" + k + "-" + ("hi" if higher else "lo") + "-" + d.isoformat(), "date": d.isoformat(),
                               "level": "since" if since else "record", "title": name + " reservoirs " + format(fill, ".1f") + "% full",
                               "detail": "MITECO bulletin of " + nice(d) + ": " + detail + ".", "link": LINK})
            if i == 0:
                continue
            change = fill - fills[i - 1]
            steps = [(dates[j], fills[j] - fills[j - 1]) for j in range(1, i)]
            hist = [abs(c) for dj, c in steps if (d - dj).days <= 365 and (c > 0) == (change > 0)]
            if hist and abs(change) >= 1 and abs(change) > max(hist):
                word = "rise" if change > 0 else "fall"
                alerts.append({"id": "es-basinw-" + k + "-" + d.isoformat(), "date": d.isoformat(), "level": "since",
                               "title": name + " reservoirs " + ("up " if change > 0 else "down ") + format(abs(change), ".1f") + " points in a week",
                               "detail": "MITECO bulletin of " + nice(d) + ": largest weekly " + word + " for at least a year, now " + format(fill, ".1f") + "% full.",
                               "link": LINK})


def reservoir_alerts(first, alerts):
    if not RESERVOIRS.exists():
        return
    rows = json.loads(RESERVOIRS.read_text(encoding="utf-8"))
    moves = []
    for r in rows:
        cap, dw = r.get("cap"), r.get("dw")
        if not cap or cap < 100 or dw is None or not r.get("date"):
            continue
        d = date.fromisoformat(r.get("date"))
        pp = mul(dw, 100) / cap
        if d >= first and abs(pp) >= 10:
            moves.append((abs(pp), pp, d, r))
    moves.sort(key=lambda m: m[0], reverse=True)
    top = moves[0:3]
    for size, pp, d, r in top:
        fill = mul(r.get("water") or 0, 100) / r.get("cap")
        alerts.append({"id": "es-res-move-" + str(r.get("id")) + "-" + d.isoformat(), "date": d.isoformat(), "level": "event",
                       "title": str(r.get("name")) + " reservoir " + ("up " if pp > 0 else "down ") + format(size, ".0f") + " points in a week",
                       "detail": "MITECO bulletin of " + nice(d) + ": " + str(r.get("basin")) + ", " + format(r.get("cap"), ",.0f")
                       + " hm³, now " + format(fill, ".0f") + "% full.", "link": LINK})


def build(first, alerts):
    basin_alerts(first, alerts)
    reservoir_alerts(first, alerts)
