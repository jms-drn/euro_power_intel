"""Read-only probe for the Germany section (v6).

Asks ENTSO-E what it holds for Germany: load and load forecast (DE-LU and
the four TSO areas), generation per type, generation per unit, day-ahead
prices for the spread partners and physical flows on every border. Then
asks SMARD (de_probe_smard.py) for its series and compares one day.
Checks a recent day and an early day (5 Jan 2015) to show where history
starts. Writes probe/out/de_probe_report.md only. Never touches data/.
Zone codes are from ENTSO-E's code lists; a failed row means "check the
code" as much as "no data". The report says which.
Usage: python scripts/de_probe.py
Code note: no asterisks, double underscores or format codes inside
f-strings (chat formatting strips them).
"""
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta, timezone
from operator import mul
from pathlib import Path
from zoneinfo import ZoneInfo

import de_probe_smard as smard

API = "https://web-api.tp.entsoe.eu/api"
TOKEN_NAMES = ("ENTSOE_API_KEY", "ENTSOE_TOKEN")
BERLIN = ZoneInfo("Europe/Berlin")
UTC = timezone.utc
OUT = Path("probe") / "out"
DE_LU = "10Y1001A1001A82H"
DE_AT_LU = "10Y1001A1001A63L"
DE_CTA = "10Y1001A1001A83F"
TSOS = {"50Hertz": "10YDE-VE-------2", "Amprion": "10YDE-RWENET---I",
        "TenneT": "10YDE-EON------1", "TransnetBW": "10YDE-ENBW-----N"}
NEIGHBOURS = {"FR": "10YFR-RTE------C", "NL": "10YNL----------L", "BE": "10YBE----------2",
              "AT": "10YAT-APG------L", "CH": "10YCH-SWISSGRIDZ", "CZ": "10YCZ-CEPS-----N",
              "PL": "10YPL-AREA-----S", "DK1": "10YDK-1--------W", "DK2": "10YDK-2--------M",
              "SE4": "10Y1001A1001A47J", "NO2": "10YNO-2--------T"}
SPREADS = ("FR", "NL", "AT", "CZ", "PL", "DK1", "CH")
PSR = {"B01": "Biomass", "B02": "Lignite", "B03": "Coal-derived gas", "B04": "Gas",
       "B05": "Hard coal", "B06": "Oil", "B09": "Geothermal", "B10": "Pumped storage",
       "B11": "Run-of-river", "B12": "Reservoir", "B14": "Nuclear", "B15": "Other renewable",
       "B16": "Solar", "B17": "Waste", "B18": "Wind offshore", "B19": "Wind onshore",
       "B20": "Other", "B25": "Energy storage"}
REPORT = []
CHECK = {}


def add(line):
    REPORT.append(line)
    print(line)


def fmt(x):
    return format(x, ".1f")


def token():
    for name in TOKEN_NAMES:
        if os.environ.get(name):
            return os.environ.get(name)
    return ""


def tag(el):
    return el.tag.split("}").pop()


def first(el, name):
    for c in el.iter():
        if tag(c) == name:
            return c
    return None


def text(el, name):
    f = first(el, name)
    return f.text.strip() if f is not None and f.text else ""


def reason(body):
    try:
        found = text(ET.fromstring(body), "text")
        if found:
            return found[0:160]
    except ET.ParseError:
        pass
    return body.strip()[0:160]


def fetch(params):
    q = dict(params)
    q["securityToken"] = token()
    url = API + "?" + urllib.parse.urlencode(q)
    last = ""
    for attempt in range(1, 4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "euro-power-intel-probe"})
            with urllib.request.urlopen(req, timeout=120) as r:
                body = r.read().decode("utf-8", "replace")
            if "Acknowledgement_MarketDocument" in body:
                return "no data", reason(body)
            return "ok", body
        except urllib.error.HTTPError as error:
            body = error.read().decode("utf-8", "replace")
            if error.code == 400 or "No matching data" in body:
                return "no data", reason(body)
            last = "HTTP " + str(error.code) + " " + reason(body)
        except (urllib.error.URLError, TimeoutError) as error:
            last = str(error)
        time.sleep(10 + attempt)
    return "error", last


def series(xml):
    root = ET.fromstring(xml)
    found = [e for e in root.iter() if tag(e) == "TimeSeries"]
    out = []
    for ts in found:
        vals = []
        for p in ts.iter():
            if tag(p) == "Point":
                v = text(p, "quantity") or text(p, "price.amount")
                if v:
                    vals.append(float(v))
        out.append({"psr": text(ts, "psrType"), "out": text(ts, "outBiddingZone_Domain.mRID"),
                    "res": text(ts, "resolution"), "unit": text(ts, "name"),
                    "rid": text(ts, "registeredResource.mRID"), "n": len(vals),
                    "sum": sum(vals), "mean": sum(vals) / len(vals) if vals else 0.0})
    return out


def window(d):
    a = datetime(d.year, d.month, d.day, tzinfo=BERLIN)
    return a.astimezone(UTC), (a + timedelta(days=1)).astimezone(UTC)


def ask(params, d):
    a, b = window(d)
    q = dict(params)
    q["periodStart"] = a.strftime("%Y%m%d%H%M")
    q["periodEnd"] = b.strftime("%Y%m%d%H%M")
    status, body = fetch(q)
    time.sleep(1)
    if status != "ok":
        return status, body.replace("|", "/"), []
    try:
        return "ok", "", series(body)
    except ET.ParseError as error:
        return "error", "unreadable XML: " + str(error), []


def avg(found):
    n = sum(s.get("n") for s in found)
    return sum(s.get("sum") for s in found) / n if n else 0.0


def brief(status, note, found):
    if status != "ok":
        return status + ": " + note
    if not found:
        return "ok but no series"
    res = ", ".join(sorted(set(s.get("res") for s in found)))
    pts = sum(s.get("n") for s in found)
    return str(len(found)) + " series; " + res + "; " + str(pts) + " points; mean " + fmt(avg(found)) + " MW"


def load_section(days):
    add("## 1. Load and day-ahead load forecast (A65)")
    add("")
    add("| What | Day | Area | Result |")
    add("|---|---|---|---|")
    areas = [("DE-LU", DE_LU), ("DE-AT-LU", DE_AT_LU), ("Germany control area", DE_CTA)]
    areas.extend(TSOS.items())
    for what, process in (("Actual load", "A16"), ("Load forecast", "A01")):
        for label, d in days:
            for name, code in areas:
                status, note, found = ask({"documentType": "A65", "processType": process,
                                           "outBiddingZone_Domain": code}, d)
                add("| " + what + " | " + label + " | " + name + " | " + brief(status, note, found) + " |")
                if what == "Actual load" and label == "recent" and code == DE_LU:
                    CHECK["load"] = avg(found)


def generation_section(days):
    add("")
    add("## 2. Generation per type (A75)")
    add("")
    add("Type codes from ENTSO-E's list: " + "; ".join(k + " " + v for k, v in PSR.items()) + ".")
    recent = dict(days).get("recent")
    early = dict(days).get("2015")
    for label, d, name, code in (("recent", recent, "DE-LU", DE_LU), ("2015", early, "Germany control area", DE_CTA),
                                 ("2015", early, "DE-AT-LU", DE_AT_LU)):
        status, note, found = ask({"documentType": "A75", "processType": "A16", "in_Domain": code}, d)
        add("")
        add("### " + name + ", " + label + " day")
        if status != "ok" or not found:
            add("Result: " + brief(status, note, found))
            continue
        add("| Code | Type | Direction | Resolution | Points | Mean MW |")
        add("|---|---|---|---|---|---|")
        for s in sorted(found, key=lambda s: s.get("psr")):
            way = "consumption" if s.get("out") else "output"
            add("| " + s.get("psr") + " | " + PSR.get(s.get("psr"), "not in list") + " | " + way + " | "
                + s.get("res") + " | " + str(s.get("n")) + " | " + fmt(s.get("mean")) + " |")
        if label == "recent":
            CHECK["gen"] = {s.get("psr"): s.get("mean") for s in found if not s.get("out")}


def units_section(days):
    recent = dict(days).get("recent")
    add("")
    add("## 3. Generation per unit (A73), recent day")
    add("")
    for name, code in (("DE-LU", DE_LU), ("Germany control area", DE_CTA)):
        status, note, found = ask({"documentType": "A73", "processType": "A16", "in_Domain": code}, recent)
        add("Asked with " + name + ": " + brief(status, note, found))
        if status == "ok" and found:
            break
    if status != "ok" or not found:
        return
    counts = {}
    for s in found:
        counts[s.get("psr")] = counts.get(s.get("psr"), 0) + 1
    add("")
    add("Units by type: " + ", ".join(PSR.get(k, k) + " " + str(v) for k, v in sorted(counts.items())) + ".")
    add("Sum of unit means: " + fmt(sum(s.get("mean") for s in found)) + " MW.")
    add("")
    add("| Unit | Code | Type | Mean MW |")
    add("|---|---|---|---|")
    ranked = sorted(found, key=lambda s: s.get("mean"), reverse=True)
    top = ranked[0:20]
    for s in top:
        add("| " + s.get("unit") + " | " + s.get("rid") + " | " + PSR.get(s.get("psr"), s.get("psr"))
            + " | " + fmt(s.get("mean")) + " |")


def prices_section(days):
    add("")
    add("## 4. Day-ahead prices (A44)")
    add("")
    add("| Zone | Recent day | 2015 day |")
    add("|---|---|---|")
    zones = [("DE-LU", DE_LU, DE_AT_LU)]
    zones.extend((z, NEIGHBOURS.get(z), NEIGHBOURS.get(z)) for z in SPREADS)
    for zone, now_code, old_code in zones:
        cells = []
        for (label, d), code in zip(days, (now_code, old_code)):
            status, note, found = ask({"documentType": "A44", "in_Domain": code, "out_Domain": code,
                                       "contract_MarketAgreement.type": "A01"}, d)
            cells.append(brief(status, note, found).replace(" MW", " EUR/MWh"))
        add("| " + zone + " | " + " | ".join(cells) + " |")


def flows_section(days):
    add("")
    add("## 5. Physical flows (A11), mean MW")
    add("")
    add("Recent day uses DE-LU; 2015 day uses the Germany control area.")
    add("")
    add("| Border | Day | Into Germany | Out of Germany |")
    add("|---|---|---|---|")
    for z, code in NEIGHBOURS.items():
        for (label, d), de in zip(days, (DE_LU, DE_CTA)):
            st_in, note_in, f_in = ask({"documentType": "A11", "in_Domain": de, "out_Domain": code}, d)
            st_out, note_out, f_out = ask({"documentType": "A11", "in_Domain": code, "out_Domain": de}, d)
            a = fmt(avg(f_in)) if st_in == "ok" else st_in + ": " + note_in
            b = fmt(avg(f_out)) if st_out == "ok" else st_out + ": " + note_out
            add("| DE-" + z + " | " + label + " | " + a + " | " + b + " |")


def cross_check(days):
    add("")
    add("## 8. Cross-check, recent day: ENTSO-E against SMARD (GWh)")
    add("")
    add("ENTSO-E energy is mean MW times hours in the day. DE-LU includes Luxembourg.")
    add("")
    add("| Series | ENTSO-E | SMARD | Difference | SMARD hours |")
    add("|---|---|---|---|---|")
    a, b = window(dict(days).get("recent"))
    hours = (b - a).total_seconds() / 3600
    a_ms = int(mul(a.timestamp(), 1000))
    b_ms = int(mul(b.timestamp(), 1000))
    gen = CHECK.get("gen") or {}
    pairs = (("Load", CHECK.get("load"), "410"), ("Solar", gen.get("B16"), "4068"),
             ("Wind onshore", gen.get("B19"), "4067"), ("Wind offshore", gen.get("B18"), "1225"),
             ("Lignite", gen.get("B02"), "1223"), ("Gas", gen.get("B04"), "4071"))
    for label, mean, filt in pairs:
        got = smard.day_total(filt, "DE", a_ms, b_ms)
        e = mul(mean, hours) / 1000 if mean else None
        s = got[0] / 1000 if got else None
        diff = fmt((e - s) / s / 0.01) + "%" if e and s else "n/a"
        add("| " + label + " | " + (fmt(e) if e else "n/a") + " | " + (fmt(s) if s else "n/a") + " | "
            + diff + " | " + (str(got[1]) if got else "n/a") + " |")


def main():
    recent = datetime.now(BERLIN).date() - timedelta(days=2)
    days = (("recent", recent), ("2015", date(2015, 1, 5)))
    add("# Germany probe report")
    add("")
    add("Run " + datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC") + ". Recent day " + recent.isoformat()
        + ", early day 2015-01-05 (Berlin days). Read-only; nothing in data/ was touched.")
    add("")
    parts = [("load", load_section), ("generation", generation_section), ("units", units_section),
             ("prices", prices_section), ("flows", flows_section)]
    if not token():
        add("No ENTSO-E token found, so only SMARD was probed.")
        parts = []
    parts.append(("SMARD", None))
    parts.append(("cross-check", cross_check))
    for name, part in parts:
        try:
            if part is None:
                smard.section(add)
            else:
                part(days)
        except Exception as error:
            add("")
            add("Section " + name + " failed: " + str(error))
        add("")
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "de_probe_report.md").write_text("\n".join(REPORT) + "\n", encoding="utf-8")
    print("Report written to probe/out/de_probe_report.md")


if Path(sys.argv[0]).name == "de_probe.py":
    main()
