"""Hydro probe: finds the data behind MITECO's ArcGIS dashboard of the weekly
Boletin Hidrologico, so reservoir and hydro energy data can be downloaded
automatically. Read-only: it never touches data/.

Run by .github/workflows/probe-hydro.yml (start by hand from the Actions tab).
Writes probe/out/hydro_probe_report.md.

Steps: read the dashboard's definition from ArcGIS Online, list every data
source (feature layer) it uses, then for each layer report its address,
fields, row count, date range and sample rows, and flag fields that look
like hydroelectric energy.
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

DASHBOARD = "912dfee767264e3884f7aea8eb1e0673"
PORTAL = "https://www.arcgis.com/sharing/rest/content/items/"
OUT = Path("probe") / "out"
ALL = chr(42)
ENERGY_WORDS = ("energ", "gwh", "hidroel", "electr", "produc")
report = []


def say(line=""):
    print(line)
    report.append(line)


def get(url, params=None):
    if params:
        url += ("&" if "?" in url else "?") + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "euro-power-intel-probe"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read().decode("utf-8", "replace"))
        except (urllib.error.URLError, TimeoutError) as error:
            if attempt == 2:
                raise RuntimeError(str(error)) from error
            time.sleep(10)
    return None


def find_layers(obj, found):
    """Collect every itemId and url mentioned anywhere in the dashboard JSON."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == "itemId" and isinstance(v, str):
                found.add(("item", v))
            elif k == "url" and isinstance(v, str) and ("FeatureServer" in v or "MapServer" in v):
                found.add(("url", v))
            else:
                find_layers(v, found)
    elif isinstance(obj, list):
        for v in obj:
            find_layers(v, found)


def ms_to_date(v):
    try:
        return datetime.fromtimestamp(v / 1000, timezone.utc).strftime("%Y-%m-%d")
    except (TypeError, ValueError, OverflowError):
        return str(v)


def probe_layer(url):
    say("### " + url)
    say()
    info = get(url, {"f": "json"})
    if "error" in info:
        say("Error: " + json.dumps(info["error"])[:300])
        say()
        return
    if "layers" in info:
        say("Service with layers: " + ", ".join(str(l.get("id")) + " " + str(l.get("name")) for l in info.get("layers", []) + info.get("tables", [])))
        say()
        for l in info.get("layers", []) + info.get("tables", []):
            probe_layer(url.rstrip("/") + "/" + str(l.get("id")))
        return
    say("Name: " + str(info.get("name")) + " · type: " + str(info.get("type")))
    fields = info.get("fields") or []
    dates = [f["name"] for f in fields if f.get("type") == "esriFieldTypeDate"]
    say()
    say("| Field | Alias | Type | Looks like energy |")
    say("|---|---|---|---|")
    for f in fields:
        text = (f.get("name", "") + " " + str(f.get("alias", ""))).lower()
        say("| " + f.get("name", "") + " | " + str(f.get("alias", "")) + " | " + f.get("type", "").replace("esriFieldType", "") + " | " + ("yes" if any(w in text for w in ENERGY_WORDS) else "") + " |")
    say()
    q = url.rstrip("/") + "/query"
    try:
        n = get(q, {"where": "1=1", "returnCountOnly": "true", "f": "json"}).get("count")
        say("Rows: " + str(n))
        for d in dates:
            st = get(q, {"where": "1=1", "outStatistics": json.dumps([
                {"statisticType": "min", "onStatisticField": d, "outStatisticFieldName": "lo"},
                {"statisticType": "max", "onStatisticField": d, "outStatisticFieldName": "hi"}]), "f": "json"})
            a = (st.get("features") or [{}])[0].get("attributes", {})
            say("Date field " + d + ": " + ms_to_date(a.get("lo")) + " to " + ms_to_date(a.get("hi")))
        order = (dates[0] + " DESC") if dates else ""
        sample = get(q, {"where": "1=1", "outFields": ALL, "orderByFields": order, "resultRecordCount": 5, "returnGeometry": "false", "f": "json"})
        say()
        say("Latest 5 rows:")
        say()
        for feat in sample.get("features", []):
            attrs = feat.get("attributes", {})
            for d in dates:
                if attrs.get(d) is not None:
                    attrs[d] = ms_to_date(attrs[d])
            say("    " + json.dumps(attrs, ensure_ascii=False)[:600])
    except Exception as error:  # noqa: BLE001
        say("Query failed: " + str(error)[:300])
    say()


def main():
    say("# Hydro probe report")
    say()
    say("Run at " + datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M") + " UTC. Dashboard " + DASHBOARD + ".")
    say()
    try:
        item = get(PORTAL + DASHBOARD, {"f": "json"})
        say("Dashboard: " + str(item.get("title")) + " · owner " + str(item.get("owner")) + " · access " + str(item.get("access")))
        say()
        data = get(PORTAL + DASHBOARD + "/data", {"f": "json"})
        found = set()
        find_layers(data, found)
        urls = set()
        for kind, value in sorted(found):
            if kind == "url":
                urls.add(value)
                continue
            sub = get(PORTAL + value, {"f": "json"})
            say("- Item " + value + ": " + str(sub.get("title")) + " (" + str(sub.get("type")) + ", access " + str(sub.get("access")) + ")")
            if sub.get("url"):
                urls.add(sub["url"])
            elif sub.get("type") == "Web Map":
                wm = get(PORTAL + value + "/data", {"f": "json"})
                for layer in wm.get("operationalLayers", []) + wm.get("tables", []):
                    if layer.get("url"):
                        urls.add(layer["url"])
        say()
        say("## Data sources (" + str(len(urls)) + ")")
        say()
        for u in sorted(urls):
            try:
                probe_layer(u)
            except Exception as error:  # noqa: BLE001
                say("Failed: " + u + " · " + str(error)[:300])
                say()
    except Exception:  # noqa: BLE001
        say("Error:")
        for line in traceback.format_exc().splitlines():
            say("    " + line)
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "hydro_probe_report.md").write_text("\n".join(report) + "\n", encoding="utf-8")
    print("Report written to " + str(OUT / "hydro_probe_report.md"))


main()
