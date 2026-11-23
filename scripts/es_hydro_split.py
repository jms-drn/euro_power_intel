"""Spanish hydro generation by type from the ENTSO-E Transparency Platform
(actual generation per production type, bidding zone ES): run-of-river,
reservoir, pumped-storage output and pumping consumption.

Writes data/es/hydro_split/YYYY/YYYY-MM.csv (split by local month), one row
per hour (start in UTC), average MW:
  t      hour start, UTC
  ror    hydro run-of-river and poundage (B11)
  res    hydro water reservoir (B12)
  ps     hydro pumped storage, output (B10)
  pump   hydro pumped storage, consumption (B10, positive)
Spain reports pumped-storage output separately only from about 2021; before
that it is included in reservoir. Totals match REE's real-time net hydro
within about 2% (probe, Nov 2026).

Usage:
  python scripts/es_hydro_split.py              the last 4 days
  python scripts/es_hydro_split.py --from 2015  every month from that year
es_update.py calls update_recent(). Needs the ENTSO-E token in one of the
environment variables listed in TOKEN_NAMES.
Code note: no asterisks, double underscores or format codes inside
f-strings (chat formatting strips them).
"""
import argparse
import csv
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from operator import mul
from pathlib import Path
from zoneinfo import ZoneInfo

API = "https://web-api.tp.entsoe.eu/api"
ES = "10YES-REE------0"
CODES = {"B11": "ror", "B12": "res", "B10": "ps"}
FIELDS = ["t", "ror", "res", "ps", "pump"]
TOKEN_NAMES = ("ENTSOE_API_KEY", "ENTSOE_TOKEN", "ENTSOE_SECURITY_TOKEN", "ENTSOE_KEY", "ENTSOE_API_TOKEN")
MADRID = ZoneInfo("Europe/Madrid")
UTC = timezone.utc
OUT = Path("data") / "es" / "hydro_split"


def token():
    for name in TOKEN_NAMES:
        if os.environ.get(name):
            return os.environ.get(name)
    raise RuntimeError("no ENTSO-E token: set one of " + ", ".join(TOKEN_NAMES))


def fetch(a, b):
    """Raw XML for a UTC period, or "" when ENTSO-E has no data."""
    params = {"securityToken": token(), "documentType": "A75", "processType": "A16", "in_Domain": ES,
              "periodStart": a.strftime("%Y%m%d%H%M"), "periodEnd": b.strftime("%Y%m%d%H%M")}
    url = API + "?" + urllib.parse.urlencode(params)
    for attempt in range(1, 5):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "euro-power-intel"})
            with urllib.request.urlopen(req, timeout=180) as r:
                body = r.read().decode("utf-8", "replace")
            return "" if "Acknowledgement_MarketDocument" in body else body
        except urllib.error.HTTPError as error:
            body = error.read().decode("utf-8", "replace")
            if "No matching data" in body:
                return ""
            if attempt == 4:
                raise RuntimeError("ENTSO-E HTTP " + str(error.code) + ": " + body[0:300]) from error
        except (urllib.error.URLError, TimeoutError) as error:
            if attempt == 4:
                raise RuntimeError("ENTSO-E: " + str(error)) from error
        time.sleep(15 + 15 + attempt)
    return ""


def tag(el):
    return el.tag.split("}").pop()


def first(el, name):
    for c in el.iter():
        if tag(c) == name:
            return c
    return None


def parse(xml):
    """Hourly average MW per column: dict of hour start to dict of column to value."""
    acc = defaultdict(lambda: defaultdict(float))
    mins = defaultdict(lambda: defaultdict(float))
    if not xml:
        return {}
    root = ET.fromstring(xml)
    series = [e for e in root.iter() if tag(e) == "TimeSeries"]
    for ts in series:
        psr = first(ts, "psrType")
        code = psr.text if psr is not None else ""
        if code not in CODES:
            continue
        col = "pump" if first(ts, "outBiddingZone_Domain.mRID") is not None else CODES.get(code)
        periods = [e for e in ts.iter() if tag(e) == "Period"]
        for period in periods:
            res = first(period, "resolution").text
            step = 60 if res == "PT60M" else 30 if res == "PT30M" else 15
            interval = first(period, "timeInterval")
            start = datetime.fromisoformat(first(interval, "start").text.replace("Z", "+00:00"))
            end = datetime.fromisoformat(first(interval, "end").text.replace("Z", "+00:00"))
            got = {}
            for p in period.iter():
                if tag(p) == "Point":
                    got[int(first(p, "position").text)] = float(first(p, "quantity").text)
            slots = int((end - start).total_seconds() // 60 // step)
            last = None
            for i in range(1, slots + 1):
                last = got.get(i, last)
                if last is None:
                    continue
                t = start + timedelta(minutes=mul(i - 1, step))
                hour = t.replace(minute=0, second=0, microsecond=0)
                a_hour = acc[hour]
                m_hour = mins[hour]
                a_hour[col] += mul(last, step)
                m_hour[col] += step
    out = {}
    for hour, cols in acc.items():
        m_hour = mins.get(hour)
        out[hour] = {c: round(v / m_hour.get(c), 1) for c, v in cols.items() if m_hour.get(c, 0) >= 45}
    return out


def path_for(hour):
    lt = hour.astimezone(MADRID)
    return OUT / str(lt.year) / (lt.strftime("%Y-%m") + ".csv")


def store(hours):
    """Merge hourly values into the monthly files; returns rows changed."""
    by_file = defaultdict(dict)
    for hour, cols in hours.items():
        month = by_file[path_for(hour)]
        month[hour.strftime("%Y-%m-%dT%H:%MZ")] = cols
    changed = 0
    for path, new in by_file.items():
        rows = {}
        if path.exists():
            with path.open(newline="", encoding="utf-8") as h:
                for r in csv.DictReader(h):
                    rows[r.get("t")] = r
        for t, cols in new.items():
            row = {"t": t}
            row.update({c: cols.get(c, "") for c in FIELDS if c != "t"})
            old = rows.get(t)
            if old is None or any(str(old.get(c, "")) != str(row.get(c)) for c in FIELDS):
                changed += 1
            rows[t] = row
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", newline="", encoding="utf-8") as h:
            w = csv.DictWriter(h, fieldnames=FIELDS, lineterminator="\n")
            w.writeheader()
            for t in sorted(rows):
                w.writerow({c: rows.get(t).get(c, "") for c in FIELDS})
    return changed


def local_midnight(d):
    return datetime(d.year, d.month, d.day, tzinfo=MADRID).astimezone(UTC)


def update_recent(days=4):
    today = datetime.now(MADRID).date()
    a = local_midnight(today - timedelta(days=days))
    b = datetime.now(UTC).replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
    return store(parse(fetch(a, b)))


def backfill(first_year):
    today = datetime.now(MADRID).date()
    y, m = first_year, 1
    total = 0
    while (y, m) <= (today.year, today.month):
        ny, nm = (y + 1, 1) if m == 12 else (y, m + 1)
        a = datetime(y, m, 1, tzinfo=MADRID).astimezone(UTC)
        b = datetime(ny, nm, 1, tzinfo=MADRID).astimezone(UTC)
        hours = parse(fetch(a, b))
        n = store(hours)
        total += n
        print("  " + str(y) + "-" + str(m).zfill(2) + ": " + str(len(hours)) + " hours, " + str(n) + " changed")
        y, m = ny, nm
        time.sleep(1)
    return total


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--from", dest="first", type=int, default=0)
    args = parser.parse_args()
    if args.first:
        print("Spain hydro by type, backfill: " + str(backfill(args.first)) + " hours changed")
    else:
        print("Spain hydro by type: " + str(update_recent()) + " hours changed")


if Path(sys.argv[0]).name == "es_hydro_split.py":
    main()
