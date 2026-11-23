"""Hydro split probe: does ENTSO-E's "actual generation per production type"
for Spain give a usable split of hydro into run-of-river, reservoir and
pumped storage (and pumping consumption), and does it match REE?
Read-only: never touches data/. Writes probe/out/hydro_split_report.md.

Run by .github/workflows/probe-hydro-split.yml (start by hand from Actions).
Needs the ENTSO-E token the site already uses (secret ENTSOE_TOKEN).
Code note: no asterisks, double underscores or format codes inside
f-strings (chat formatting strips them).
"""
import csv
import os
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta, timezone
from operator import mul
from pathlib import Path
from zoneinfo import ZoneInfo

API = "https://web-api.tp.entsoe.eu/api"
ES = "10YES-REE------0"
TYPES = {"B10": "pumped storage", "B11": "run-of-river", "B12": "reservoir"}
DAYS = ["2015-03-10", "2020-06-10", "2025-01-10", "2025-01-28", "2026-11-10", "2026-11-20"]
MADRID = ZoneInfo("Europe/Madrid")
OUT = Path("probe") / "out"
MIX = Path("data") / "es" / "mix"
report = []


def say(line=""):
    print(line)
    report.append(line)


def token():
    for name in ("ENTSOE_TOKEN", "ENTSOE_API_KEY", "ENTSOE_SECURITY_TOKEN"):
        if os.environ.get(name):
            return os.environ.get(name)
    raise RuntimeError("no ENTSO-E token found in the environment")


def local_day(d):
    a = datetime.fromisoformat(d).replace(tzinfo=MADRID).astimezone(timezone.utc)
    b = (datetime.fromisoformat(d) + timedelta(days=1)).replace(tzinfo=MADRID).astimezone(timezone.utc)
    return a, b


def fetch(d):
    a, b = local_day(d)
    params = {"securityToken": token(), "documentType": "A75", "processType": "A16", "in_Domain": ES,
              "periodStart": a.strftime("%Y%m%d%H%M"), "periodEnd": b.strftime("%Y%m%d%H%M")}
    url = API + "?" + urllib.parse.urlencode(params)
    for attempt in range(1, 4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "euro-power-intel-probe"}), timeout=120) as r:
                return r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as error:
            body = error.read().decode("utf-8", "replace")
            if attempt == 3:
                raise RuntimeError("HTTP " + str(error.code) + ": " + body[0:300]) from error
        except (urllib.error.URLError, TimeoutError) as error:
            if attempt == 3:
                raise RuntimeError(str(error)) from error
        time.sleep(10)
    return ""


def strip(tag):
    return tag.split("}").pop()


def child(el, name):
    for c in el.iter():
        if strip(c.tag) == name:
            return c
    return None


def parse(xml):
    """Energy (GWh) per (psr type, direction), with resolution and points."""
    root = ET.fromstring(xml)
    out = {}
    for ts in [e for e in root.iter() if strip(e.tag) == "TimeSeries"]:
        psr = child(ts, "psrType")
        code = psr.text if psr is not None else "?"
        if code not in TYPES:
            continue
        direction = "consumption" if child(ts, "outBiddingZone_Domain.mRID") is not None else "generation"
        for period in [e for e in ts.iter() if strip(e.tag) == "Period"]:
            res = child(period, "resolution").text
            minutes = 60 if res == "PT60M" else 30 if res == "PT30M" else 15
            pts = sorted((int(child(p, "position").text), float(child(p, "quantity").text))
                         for p in period.iter() if strip(p.tag) == "Point")
            interval = child(period, "timeInterval")
            start = datetime.fromisoformat(child(interval, "start").text.replace("Z", "+00:00"))
            end = datetime.fromisoformat(child(interval, "end").text.replace("Z", "+00:00"))
            slots = int((end - start).total_seconds() // 60 // minutes)
            values = {}
            last = None
            got = dict(pts)
            for i in range(1, slots + 1):
                if i in got:
                    last = got.get(i)
                values[i] = last
            mwh = sum(mul(v, minutes) / 60 for v in values.values() if v is not None)
            key = (code, direction)
            rec = out.setdefault(key, {"gwh": 0.0, "res": set(), "points": 0, "slots": 0, "peak": 0.0})
            rec["gwh"] += mwh / 1000
            rec["res"].add(res)
            rec["points"] += len(pts)
            rec["slots"] += slots
            rec["peak"] = max([rec["peak"]] + [v for v in values.values() if v is not None])
    return out


def ree_day(d):
    a, b = local_day(d)
    path = MIX / d[0:4] / (d[0:7] + ".csv")
    if not path.exists():
        return None
    sums = {"hydro": 0.0, "hydro_gen": 0.0, "pump_gen": 0.0, "pump_load": 0.0}
    seen = {k: 0 for k in sums}
    with path.open(newline="", encoding="utf-8") as h:
        for row in csv.DictReader(h):
            t = datetime.fromisoformat(row.get("start_utc").replace("Z", "+00:00"))
            if not (a <= t < b):
                continue
            for k in sums:
                v = row.get(k)
                if v not in (None, ""):
                    sums[k] += float(v) / 4000
                    seen[k] += 1
    return {k: (round(sums.get(k), 1) if seen.get(k) else None) for k in sums}


def fmt(v):
    return "–" if v is None else format(v, ",.1f")


def main():
    say("# Hydro split probe: ENTSO-E generation per production type, Spain")
    say()
    say("Run at " + datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M") + " UTC. GWh per local day (Madrid time).")
    say()
    say("| Day | Run-of-river | Reservoir | Pumped storage | Pumping use | ENTSO-E net | REE net hydro | REE hydro_gen | REE pump_gen | REE pump_load | Resolution |")
    say("|---|---|---|---|---|---|---|---|---|---|---|")
    details = []
    for d in DAYS:
        try:
            parts = parse(fetch(d))
            g = lambda code, direction="generation": parts.get((code, direction), {}).get("gwh")
            ror, res, ps = g("B11"), g("B12"), g("B10")
            use = g("B10", "consumption")
            net = None if ror is None and res is None and ps is None else (ror or 0) + (res or 0) + (ps or 0) - (use or 0)
            ree = ree_day(d) or {}
            resolutions = sorted({r for rec in parts.values() for r in rec.get("res")})
            say("| " + d + " | " + fmt(ror) + " | " + fmt(res) + " | " + fmt(ps) + " | " + fmt(use) + " | " + fmt(net)
                + " | " + fmt(ree.get("hydro")) + " | " + fmt(ree.get("hydro_gen")) + " | " + fmt(ree.get("pump_gen"))
                + " | " + fmt(None if ree.get("pump_load") is None else -ree.get("pump_load")) + " | " + ", ".join(resolutions) + " |")
            for key in sorted(parts):
                rec = parts.get(key)
                details.append("- " + d + " " + TYPES.get(key[0]) + " (" + key[1] + "): " + str(rec.get("points")) + " points for "
                               + str(rec.get("slots")) + " slots, peak " + format(rec.get("peak"), ",.0f") + " MW")
        except Exception as error:  # noqa: BLE001
            say("| " + d + " | error: " + str(error)[0:200] + " | | | | | | | | | |")
            traceback.print_exc()
        time.sleep(2)
    say()
    say("ENTSO-E net = run-of-river + reservoir + pumped storage - pumping use. REE net hydro is the site's stored series.")
    say("REE hydro_gen, pump_gen and pump_load exist only from 30 Dec 2024 (pump_gen from 23 Jan 2025).")
    say()
    say("## Series detail")
    say()
    for line in details:
        say(line)
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "hydro_split_report.md").write_text("\n".join(report) + "\n", encoding="utf-8")
    print("Report written to " + str(OUT / "hydro_split_report.md"))


main()
