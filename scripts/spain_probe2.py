"""Spain probe 2: settles Generation, Nuclear, Hydro reserves and wind/solar
forecasts for Spain. Read-only: it never touches data/.

Run by .github/workflows/probe-spain-2.yml (start by hand from the Actions tab).

Writes probe/out/spain_probe2_report.md.

ESIOS: searches REE's catalogue by name for real-time generation, wind and
solar forecasts, nuclear and reservoir series, and tests every match (no IDs
are hard-coded). ENTSO-E: output per generating unit, unit unavailability
notices, installed capacity per unit and per type, wind/solar forecasts with
other settings, and the latest Spanish day-ahead price per series. ENTSO-E
calls are made directly here because unavailability replies come as zip files.

Dates are written with fmt_time() (strftime), never with format specs inside
f-strings: that syntax gets stripped when code is pasted from chat.
"""
import io
import json
import os
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

UTC = timezone.utc
OUT = Path(__file__).resolve().parent.parent / "probe" / "out"
ESIOS_URL = "https://api.esios.ree.es"
ENTSOE_URL = "https://web-api.tp.entsoe.eu/api"
ES = "10YES-REE------0"

FUELS = ["nuclear", "eólica", "eolica", "solar", "fotovolt", "hidráulica", "hidraulica",
         "ciclo combinado", "carbón", "carbon", "cogeneración", "cogeneracion", "bombeo",
         "residuos", "biomasa", "generación", "generacion"]
GROUPS = {
    "Real-time generation": {
        "any": ["tiempo real", "t.real", "t. real"],
        "and_any": FUELS,
    },
    "Wind and solar forecasts": {
        "any": ["previsión", "prevision", "prevista", "previsto"],
        "and_any": ["eólica", "eolica", "solar", "fotovolt"],
    },
    "Nuclear (not schedules)": {
        "any": ["nuclear"],
        "not_any": ["programada"],
    },
    "Reservoirs and hydro energy": {
        "any": ["reserva", "producible", "hidroeléctric", "hidroelectric", "almacenad"],
    },
}
MAX_TESTS = 25  # per group

report = []


def say(line=""):
    print(line)
    report.append(line)


def fmt_time(dt):
    return dt.strftime("%Y-%m-%d %H:%M")


def step_minutes(times):
    times = sorted(set(times))
    gaps = [(b - a).total_seconds() / 60 for a, b in zip(times, times[1:])]
    return int(min(gaps)) if gaps else None


def cell(text, n=90):
    return str(text).replace("|", "/").replace("\n", " ")[:n]


# --------------------------------------------------------------------------
# ESIOS
# --------------------------------------------------------------------------

def esios_get(path, params=None):
    key = os.environ.get("ESIOS_API_KEY")
    if not key:
        raise RuntimeError("ESIOS_API_KEY is not set")
    url = ESIOS_URL + path
    if params:
        url += "?" + urllib.parse.urlencode(params)
    request = urllib.request.Request(url, headers={
        "Accept": "application/json; application/vnd.esios-api-v1+json",
        "Content-Type": "application/json",
        "x-api-key": key,
    })
    for attempt in range(1, 4):
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                return json.loads(response.read().decode("utf-8", "replace"))
        except urllib.error.HTTPError as error:
            body = error.read().decode("utf-8", "replace")[:200]
            if (error.code == 429 or error.code >= 500) and attempt < 3:
           
