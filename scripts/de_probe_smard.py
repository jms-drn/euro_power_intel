"""SMARD half of the Germany probe (read-only). Called by de_probe.py.

SMARD (Bundesnetzagentur) serves each series as weekly JSON chunks:
  chart_data/FILTER/REGION/index_RES.json        list of chunk start times
  chart_data/FILTER/REGION/FILTER_REGION_RES_TS.json  pairs of time, value
Values are MWh per interval. No key. Filter numbers below are candidates;
the report shows which ones answered. Prices are not probed (their SMARD
licence is under review), so prices stay on ENTSO-E.
Code note: no asterisks, double underscores or format codes inside
f-strings (chat formatting strips them).
"""
import json
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

BASE = "https://www.smard.de/app/chart_data"
UTC = timezone.utc
FILTERS = {
    "410": "Grid load",
    "4359": "Residual load",
    "1223": "Lignite",
    "4069": "Hard coal",
    "4071": "Gas",
    "1224": "Nuclear",
    "4067": "Wind onshore",
    "1225": "Wind offshore",
    "4068": "Solar",
    "4066": "Biomass",
    "1226": "Hydro",
    "4070": "Pumped storage output",
    "4387": "Pumped storage consumption",
    "1227": "Other conventional",
    "1228": "Other renewables",
}
TSO_REGIONS = ("50Hertz", "Amprion", "TenneT", "TransnetBW")
TSO_FILTERS = ("410", "4068", "4067")


def get(path):
    url = BASE + "/" + path
    for attempt in range(1, 4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "euro-power-intel-probe"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            if error.code == 404:
                return None
        except (urllib.error.URLError, TimeoutError, ValueError):
            pass
        time.sleep(3 + attempt)
    return None


def when(ms):
    return datetime.fromtimestamp(ms / 1000, UTC).strftime("%Y-%m-%d %H:%M UTC")


def index(filt, region, res):
    data = get(filt + "/" + region + "/index_" + res + ".json")
    if not data:
        return []
    return sorted(data.get("timestamps") or [])


def chunk(filt, region, res, ts):
    name = filt + "_" + region + "_" + res + "_" + str(ts) + ".json"
    data = get(filt + "/" + region + "/" + name)
    if not data:
        return []
    pairs = data.get("series") or []
    return [p for p in pairs if len(p) == 2]


def latest(filt, region, res):
    stamps = index(filt, region, res)
    if not stamps:
        return None
    first = stamps[0]
    count = len(stamps)
    pts = chunk(filt, region, res, stamps.pop())
    filled = [p for p in pts if p[1] is not None]
    last = filled.pop() if filled else None
    return {"first": when(first), "chunks": count, "points": len(pts),
            "last_time": when(last[0]) if last else "none",
            "last_value": format(last[1], ".1f") if last else "none"}


def day_total(filt, region, a_ms, b_ms):
    """Sum of hourly MWh inside one Berlin day, and the number of hours."""
    stamps = [s for s in index(filt, region, "hour") if s <= a_ms]
    if not stamps:
        return None
    pts = chunk(filt, region, "hour", max(stamps))
    vals = [p[1] for p in pts if a_ms <= p[0] < b_ms and p[1] is not None]
    return sum(vals), len(vals)


def section(add):
    add("## 6. SMARD series (region DE)")
    add("")
    add("| Filter | Series | Hourly history from | Weekly chunks | Latest value (MWh) at | Quarter-hour index |")
    add("|---|---|---|---|---|---|")
    for filt, label in FILTERS.items():
        info = latest(filt, "DE", "hour")
        qh = "yes" if index(filt, "DE", "quarterhour") else "no"
        if info is None:
            add("| " + filt + " | " + label + " | no answer | | | " + qh + " |")
            continue
        add("| " + filt + " | " + label + " | " + info.get("first") + " | " + str(info.get("chunks"))
            + " | " + info.get("last_value") + " at " + info.get("last_time") + " | " + qh + " |")
    add("")
    add("## 7. SMARD by TSO area")
    add("")
    add("| Filter | Area | Hourly history from | Latest value (MWh) at |")
    add("|---|---|---|---|")
    for filt in TSO_FILTERS:
        for region in TSO_REGIONS:
            info = latest(filt, region, "hour")
            if info is None:
                add("| " + filt + " | " + region + " | no answer | |")
                continue
            add("| " + filt + " | " + region + " | " + info.get("first") + " | "
                + info.get("last_value") + " at " + info.get("last_time") + " |")
