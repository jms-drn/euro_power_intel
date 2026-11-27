"""Second read-only probe for the Germany section (v6).

Checks only the gaps left by de_probe.py:
  1. Generation per unit (A73): asked by DE-LU, the Germany control area
     and each TSO area, on days 7 and 30 back.
  2. 2015 physical flows on CH, DK1, DK2 and SE4: asked with the DE-AT-LU
     code and each TSO area instead of the control area.
  3. Polish day-ahead price coverage: one day a year, 2015 to 2020.
Reuses the request and parsing code in de_probe.py. Writes
probe/out/de_probe2_report.md only. Never touches data/.
Usage: python scripts/de_probe2.py
Code note: no asterisks, double underscores or format codes inside
f-strings (chat formatting strips them).
"""
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

import de_probe as d

OUT = Path("probe") / "out"
REPORT = []
FLOW_BORDERS = ("CH", "DK1", "DK2", "SE4")


def add(line):
    REPORT.append(line)
    print(line)


def units_section():
    add("## 1. Generation per unit (A73)")
    add("")
    today = datetime.now(d.BERLIN).date()
    days = (("7 days back", today - timedelta(days=7)), ("30 days back", today - timedelta(days=30)))
    areas = [("DE-LU", d.DE_LU), ("Germany control area", d.DE_CTA)]
    areas.extend(d.TSOS.items())
    add("| Day | Asked with | Result |")
    add("|---|---|---|")
    best = None
    for label, day in days:
        for name, code in areas:
            status, note, found = d.ask({"documentType": "A73", "processType": "A16", "in_Domain": code}, day)
            add("| " + label + " " + day.isoformat() + " | " + name + " | " + d.brief(status, note, found) + " |")
            if status == "ok" and found and best is None:
                best = (label, name, found)
    if best is None:
        add("")
        add("No unit data from any area on either day.")
        return
    label, name, found = best
    counts = {}
    for s in found:
        counts[s.get("psr")] = counts.get(s.get("psr"), 0) + 1
    add("")
    add("### First answer: " + name + ", " + label)
    add("")
    add("Units by type: " + ", ".join(d.PSR.get(k, k) + " " + str(v) for k, v in sorted(counts.items())) + ".")
    add("Sum of unit means: " + d.fmt(sum(s.get("mean") for s in found)) + " MW.")
    add("")
 
