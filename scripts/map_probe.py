"""Map probe: checks the MITECO bulletin data needed for the Spain reserves
map (basin outlines, reservoir points), rainfall and river flows, so the
download script can use the exact field names. Read-only: never touches
data/. Writes probe/out/map_probe_report.md.

Run by .github/workflows/probe-map.yml (start by hand from the Actions tab).
Code note: no asterisks, double underscores or format codes inside
f-strings (chat formatting strips them), so the ArcGIS wildcard is chr(42).
"""
import json
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE = "https://services-eu1.arcgis.com/RvnYk1PBUJ9rrAuT/arcgis/rest/services/"
LAYERS = ["Pluviometros_Total", "Pluviometros_Mapa", "DDHH", "Embalses_Mapa", "Caudales_Mapa"]
OUT = Path("probe") / "out"
ALL = chr(42)
report = []


def say(line=""):
    print(line)
    report.append(line)


def get_text(url, params):
    url = url + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "euro-power-intel-probe"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read().decode("utf-8", "replace")
        except (urllib.error.URLError, TimeoutError) as error:
            if attempt == 2:
                raise RuntimeError(str(error)) from error
            time.sleep(10)
    return ""


def get(url, params):
    return json.loads(get_text(url, params) or "{}")


def ms_to_date(v):
    try:
        return datetime.fromtimestamp(v / 1000, timezone.utc).strftime("%Y-%m-%d")
    except (TypeError, ValueError, OverflowError):
        return str(v)


def probe(name):
    url = BASE + name + "/FeatureServer/0"
    say("## " + name)
    say()
    info = get(url, {"f": "json"})
    if "error" in info:
        say("Error: " + json.dumps(info.get("error"))[0:300])
        say()
        return
    fields = info.get("fields") or []
    dates = [f.get("name") for f in fields if f.get("type") == "esriFieldTypeDate"]
    say("Type: " + str(info.get("type")) + " · geometry: " + str(info.get("geometryType")))
    say("Fields: " + ", ".join(f.get("name") + " (" + f.get("type", "").replace("esriFieldType", "") + ")" for f in fields))
    q = url + "/query"
    say("Rows: " + str(get(q, {"where": "1=1", "returnCountOnly": "true", "f": "json"}).get("count")))
    for d in dates:
        st = get(q, {"where": "1=1", "outStatistics": json.dumps([
            {"statisticType": "min", "onStatisticField": d, "outStatisticFieldName": "lo"},
            {"statisticType": "max", "onStatisticField": d, "outStatisticFieldName": "hi"}]), "f": "json"})
        feats = st.get("features") or [{}]
        a = feats[0].get("attributes", {}) if feats else {}
        say("Date field " + d + ": " + ms_to_date(a.get("lo")) + " to " + ms_to_date(a.get("hi")))
    order = (dates[0] + " DESC") if dates else ""
    sample = get(q, {"where": "1=1", "outFields": ALL, "orderByFields": order, "resultRecordCount": 3, "returnGeometry": "false", "f": "json"})
    say()
    say("Latest rows:")
    feats = sample.get("features") or list()
    for feat in feats:
        attrs = feat.get("attributes", {})
        for d in dates:
            if attrs.get(d) is not None:
                attrs[d] = ms_to_date(attrs.get(d))
        say("    " + json.dumps(attrs, ensure_ascii=False)[0:900])
    if info.get("geometryType"):
        geo = get_text(q, {"where": "1=1", "outFields": "OBJECTID", "returnGeometry": "true", "outSR": "4326",
                           "maxAllowableOffset": "0.02", "geometryPrecision": "3", "f": "geojson"})
        say()
        say("GeoJSON with simplified geometry: " + str(len(geo)) + " characters. Start: " + geo[0:200])
    say()


def main():
    say("# Map probe report")
    say()
    say("Run at " + datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M") + " UTC.")
    say()
    for name in LAYERS:
        try:
            probe(name)
        except Exception:  # noqa: BLE001
            say("Failed " + name + ":")
            for line in traceback.format_exc().splitlines():
                say("    " + line)
            say()
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "map_probe_report.md").write_text("\n".join(report) + "\n", encoding="utf-8")
    print("Report written to " + str(OUT / "map_probe_report.md"))


main()
