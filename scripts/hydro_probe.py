"""Hydro probe (second version): finds the data behind MITECO's ArcGIS
dashboard of the weekly Boletin Hidrologico. Read-only: never touches data/.

Run by .github/workflows/probe-hydro.yml (start by hand from the Actions tab).
Writes probe/out/hydro_probe_report.md and probe/out/dashboard.json (the
dashboard's raw definition, for reference).

The first version found no data sources in the dashboard definition, so
this one looks three ways:
  1. every 32-character item ID and every FeatureServer/MapServer address
     anywhere in the dashboard's raw definition;
  2. every public item owned by the dashboard's owner (BolHidro_miteco);
  3. a public search for MITECO hydrological bulletin feature services.
For each feature service found it reports the layers, fields, row count,
date range and the latest rows, and flags fields that look like energy.
Code note: no asterisks, double underscores or format codes inside
f-strings (chat formatting strips them), so the ArcGIS wildcard is chr(42).
"""
import json
import re
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

DASHBOARD = "912dfee767264e3884f7aea8eb1e0673"
ROOT = "https://www.arcgis.com/sharing/rest/"
ITEMS = ROOT + "content/items/"
OUT = Path("probe") / "out"
ALL = chr(42)
ENERGY_WORDS = ("energ", "gwh", "hidroel", "electr", "produc", "reserva")
MAX_SERVICES = 25
report = []
seen_layers = set()


def say(line=""):
    print(line)
    report.append(line)


def get_text(url, params=None):
    if params:
        url += ("&" if "?" in url else "?") + urllib.parse.urlencode(params)
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


def get(url, params=None):
    return json.loads(get_text(url, params) or "{}")


def ms_to_date(v):
    try:
        return datetime.fromtimestamp(v / 1000, timezone.utc).strftime("%Y-%m-%d")
    except (TypeError, ValueError, OverflowError):
        return str(v)


def probe_layer(url):
    if url in seen_layers:
        return
    seen_layers.add(url)
    info = get(url, {"f": "json"})
    if "error" in info:
        say("#### " + url)
        say("Error: " + json.dumps(info["error"])[:300])
        say()
        return
    if "layers" in info or "tables" in info:
        subs = (info.get("layers") or []) + (info.get("tables") or [])
        say("### Service " + url)
        say("Layers: " + ", ".join(str(l.get("id")) + " " + str(l.get("name")) for l in subs))
        say()
        for l in subs:
            probe_layer(url.rstrip("/") + "/" + str(l.get("id")))
        return
    say("#### " + str(info.get("name")) + " (" + str(info.get("type")) + ")")
    say(url)
    fields = info.get("fields") or []
    dates = [f["name"] for f in fields if f.get("type") == "esriFieldTypeDate"]
    say()
    say("| Field | Alias | Type | Looks relevant |")
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
        sample = get(q, {"where": "1=1", "outFields": ALL, "orderByFields": order, "resultRecordCount": 3, "returnGeometry": "false", "f": "json"})
        say()
        say("Latest rows:")
        for feat in sample.get("features", []):
            attrs = feat.get("attributes", {})
            for d in dates:
                if attrs.get(d) is not None:
                    attrs[d] = ms_to_date(attrs[d])
            say("    " + json.dumps(attrs, ensure_ascii=False)[:700])
    except Exception as error:  # noqa: BLE001
        say("Query failed: " + str(error)[:300])
    say()


def item_url(item_id):
    """Service address of an item (via its web map for Web Map items)."""
    sub = get(ITEMS + item_id, {"f": "json"})
    if "error" in sub:
        return [], "not found or private"
    label = str(sub.get("title")) + " (" + str(sub.get("type")) + ", " + str(sub.get("access")) + ")"
    if sub.get("url"):
        return [sub["url"]], label
    if sub.get("type") == "Web Map":
        wm = get(ITEMS + item_id + "/data", {"f": "json"})
        layers = (wm.get("operationalLayers") or []) + (wm.get("tables") or [])
        return [l["url"] for l in layers if l.get("url")], label
    return [], label


def main():
    say("# Hydro probe report (second version)")
    say()
    say("Run at " + datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M") + " UTC.")
    say()
    urls = set()
    try:
        say("## 1. The dashboard's own definition")
        say()
        raw = get_text(ITEMS + DASHBOARD + "/data", {"f": "json"})
        OUT.mkdir(parents=True, exist_ok=True)
        (OUT / "dashboard.json").write_text(raw, encoding="utf-8")
        say("Definition: " + str(len(raw)) + " characters, saved to probe/out/dashboard.json. Start: " + raw[:300].replace("\n", " "))
        say()
        ids = sorted(set(re.findall(r"[0-9a-f]{32}", raw)) - {DASHBOARD})
        addrs = sorted(set(m.group(0) for m in re.finditer(r"https?://[^\"' ]+?/(FeatureServer|MapServer)(/[0-9]+)?", raw)))
        say("Item IDs found: " + (", ".join(ids) or "none"))
        say("Service addresses found: " + (", ".join(addrs) or "none"))
        say()
        urls.update(addrs)
        for i in ids:
            found, label = item_url(i)
            say("- " + i + ": " + label)
            urls.update(found)
        say()

        say("## 2. Public items of the owner (BolHidro_miteco)")
        say()
        res = get(ROOT + "search", {"q": "owner:BolHidro_miteco", "num": 100, "sortField": "modified", "sortOrder": "desc", "f": "json"})
        for it in res.get("results", []):
            say("- " + str(it.get("title")) + " · " + str(it.get("type")) + " · " + str(it.get("id")) + " · modified " + ms_to_date(it.get("modified")) + (" · " + it["url"] if it.get("url") else ""))
            if it.get("type") in ("Feature Service", "Map Service") and it.get("url"):
                urls.add(it["url"])
        say()
        say("Total public items: " + str(res.get("total")))
        say()

        say("## 3. Public search for bulletin services")
        say()
        res = get(ROOT + "search", {"q": "(boletin hidrologico OR embalses OR reserva hidrica) AND type:\"Feature Service\" AND miteco", "num": 30, "f": "json"})
        for it in res.get("results", []):
            say("- " + str(it.get("title")) + " · owner " + str(it.get("owner")) + " · " + str(it.get("id")) + (" · " + it["url"] if it.get("url") else ""))
            if it.get("url") and str(it.get("owner", "")).lower().startswith("bolhidro"):
                urls.add(it["url"])
        say()

        say("## Services probed (" + str(min(len(urls), MAX_SERVICES)) + " of " + str(len(urls)) + ")")
        say()
        todo = sorted(urls)[slice(0, MAX_SERVICES)]
        for u in todo:
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
