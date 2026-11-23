"""Spain reservoir detail from MITECO's weekly hydrological bulletin (the
public ArcGIS services behind MITECO's bulletin dashboard), for the Hydro
page's Reserves map: basins, reservoirs, rainfall and river flows.

Writes:
  data/es/basins.csv        weekly per basin since 1988: date, basin, key,
                            water_hm3, cap_hm3, hydro_water_hm3, hydro_cap_hm3,
                            energy, energy_cap (GWh), reservoirs
  data/es/rain.csv          weekly rainfall per station since 1995 (mm):
                            date, station_id, station, zone, mm
  data/es/river_flows.csv   weekly flow per gauging station since 2001
                            (m3/s): date, station_id, station, river, basin, flow
  data/es/map/basins.json   basin outlines, simplified GeoJSON (key, name);
                            fetched when missing or with --outlines
  data/es/map/reservoirs.json   latest bulletin, every reservoir: location,
                            basin, capacity, water, energy, weekly change, use
  data/es/map/rain_stations.json, data/es/map/flow_stations.json
                            station locations and latest values
Usage:
  python scripts/es_basins.py              the last 10 weeks and latest map
  python scripts/es_basins.py --from 1988  full history from that year
Basins are matched across MITECO's tables by key(): the name lower-cased
without accents, spaces or punctuation.
Code note: no asterisks, double underscores or format codes inside
f-strings (chat formatting strips them).
"""
import argparse
import csv
import json
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

BASE = "https://services-eu1.arcgis.com/RvnYk1PBUJ9rrAuT/arcgis/rest/services/"
ES = Path("data") / "es"
MAP = ES / "map"
UTC = timezone.utc
BASIN_FIELDS = ["date", "basin", "key", "water_hm3", "cap_hm3", "hydro_water_hm3", "hydro_cap_hm3", "energy", "energy_cap", "reservoirs"]
RAIN_FIELDS = ["date", "station_id", "station", "zone", "mm"]
FLOW_FIELDS = ["date", "station_id", "station", "river", "basin", "flow"]


def key(name):
    text = unicodedata.normalize("NFD", str(name or ""))
    return "".join(c for c in text.lower() if "a" <= c <= "z")


def get(url, params):
    req = urllib.request.Request(url + "?" + urllib.parse.urlencode(params), headers={"User-Agent": "euro-power-intel"})
    for attempt in range(1, 5):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                body = json.loads(r.read().decode("utf-8", "replace"))
            if "error" in body:
                raise RuntimeError(json.dumps(body.get("error"))[0:300])
            return body
        except (urllib.error.URLError, TimeoutError, RuntimeError) as error:
            if attempt == 4:
                raise
            print("  retry " + str(attempt) + ": " + str(error)[0:200])
            time.sleep(15 + 15 + attempt)
    return {}


def day_of(ms):
    # Dates are stored as midnight in Spain (late the evening before in UTC).
    return datetime.fromtimestamp(ms / 1000 + 43200, UTC).date().isoformat()


def where(field, a, b):
    return field + " >= timestamp '" + a.isoformat() + " 00:00:00' AND " + field + " < timestamp '" + (b + timedelta(days=1)).isoformat() + " 00:00:00'"


def query_all(layer, params):
    """Every row of a query, page by page."""
    url = BASE + layer + "/FeatureServer/0/query"
    out = []
    offset = 0
    while True:
        page = dict(params)
        page.update({"resultOffset": offset, "resultRecordCount": 2000, "f": "json", "returnGeometry": "false"})
        body = get(url, page)
        feats = body.get("features") or list()
        out.extend(f.get("attributes") or {} for f in feats)
        if not body.get("exceededTransferLimit") or not feats:
            return out
        offset += len(feats)


def merge(path, fields, new_rows, start, end, id_field):
    """Replace rows dated start..end with new_rows; keep the rest."""
    rows = {}
    if path.exists():
        with path.open(newline="", encoding="utf-8") as h:
            for r in csv.DictReader(h):
                d = r.get("date")
                if not (start.isoformat() <= d <= end.isoformat()):
                    rows[(d, r.get(id_field))] = r
    for r in new_rows:
        rows[(r.get("date"), str(r.get(id_field)))] = r
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as h:
        w = csv.DictWriter(h, fieldnames=fields, lineterminator="\n")
        w.writeheader()
        for k in sorted(rows):
            w.writerow({f: rows.get(k).get(f, "") for f in fields})
    return len(new_rows)


def num(v, digits=0):
    if v is None:
        return ""
    return round(v, digits) if digits else int(round(v))


def stat(kind, field, name):
    return {"statisticType": kind, "onStatisticField": field, "outStatisticFieldName": name}


def basins(a, b):
    stats = json.dumps([stat("sum", "agua_actual", "water"), stat("sum", "agua_total", "cap"), stat("sum", "energia_actual", "energy"),
                        stat("sum", "energia_total", "energy_cap"), stat("count", "EMBALSE_ID", "n")])
    rows = {}
    for hydro in (False, True):
        w = where("fecha", a, b) + (" AND electrico_flag = 1" if hydro else "")
        for r in query_all("Embalses_Total", {"where": w, "groupByFieldsForStatistics": "fecha,ambito_nombre", "outStatistics": stats}):
            if r.get("fecha") is None:
                continue
            d = day_of(r.get("fecha"))
            name = r.get("ambito_nombre")
            row = rows.setdefault((d, key(name)), {"date": d, "basin": name, "key": key(name)})
            if hydro:
                row.update({"hydro_water_hm3": num(r.get("water")), "hydro_cap_hm3": num(r.get("cap"))})
            else:
                row.update({"water_hm3": num(r.get("water")), "cap_hm3": num(r.get("cap")), "energy": num(r.get("energy")),
                            "energy_cap": num(r.get("energy_cap")), "reservoirs": num(r.get("n"))})
    return list(rows.values())


def rain(a, b):
    out = []
    for r in query_all("Pluviometros_Total", {"where": where("Fecha", a, b), "outFields": "zona_nombre,pluviometro_id,pluviometro_nombre,Precipitacion,Fecha", "orderByFields": "OBJECTID"}):
        if r.get("Fecha") is None or r.get("Precipitacion") is None:
            continue
        out.append({"date": day_of(r.get("Fecha")), "station_id": int(r.get("pluviometro_id")), "station": r.get("pluviometro_nombre"),
                    "zone": r.get("zona_nombre"), "mm": num(r.get("Precipitacion"), 1)})
    return out


def flows(a, b):
    out = []
    for r in query_all("Caudales_Total", {"where": where("fecha", a, b), "outFields": "estacion_id,estacion_nombre,Rio,ambito_nombre,caudal,fecha", "orderByFields": "OBJECTID_12_13"}):
        if r.get("fecha") is None or r.get("caudal") is None:
            continue
        out.append({"date": day_of(r.get("fecha")), "station_id": r.get("estacion_id"), "station": r.get("estacion_nombre"),
                    "river": r.get("Rio") or "", "basin": r.get("ambito_nombre"), "flow": num(r.get("caudal"), 2)})
    return out


def geojson(layer, fields, extra=None):
    params = {"where": "1=1", "outFields": fields, "returnGeometry": "true", "outSR": "4326", "f": "geojson"}
    params.update(extra or {})
    return get(BASE + layer + "/FeatureServer/0/query", params).get("features") or list()


def write_json(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def latest_map(outlines):
    if outlines or not (MAP / "basins.json").exists():
        feats = geojson("DDHH", "NOM_DEMAR", {"maxAllowableOffset": "0.03", "geometryPrecision": "3"})
        for f in feats:
            name = (f.get("properties") or {}).get("NOM_DEMAR")
            f["properties"] = {"key": key(name), "name": name}
        write_json(MAP / "basins.json", {"type": "FeatureCollection", "features": feats})
        print("Basin outlines: " + str(len(feats)))
    res = []
    for f in geojson("Embalses_Mapa", "EMBALSE_ID,embalse_nombre,ambito_nombre,agua_total,agua_actual,energia_total,energia_actual,electrico_flag,Uso,Variacion_Reserva,Variacion_Energia,fecha"):
        p = f.get("properties") or {}
        lon, lat = (f.get("geometry") or {}).get("coordinates") or (None, None)
        res.append({"id": p.get("EMBALSE_ID"), "name": p.get("embalse_nombre"), "basin": p.get("ambito_nombre"), "key": key(p.get("ambito_nombre")),
                    "lon": lon, "lat": lat, "cap": p.get("agua_total"), "water": p.get("agua_actual"), "energy_cap": p.get("energia_total"),
                    "energy": p.get("energia_actual"), "hydro": p.get("electrico_flag") == 1, "use": p.get("Uso"),
                    "dw": p.get("Variacion_Reserva"), "de": p.get("Variacion_Energia"), "date": day_of(p.get("fecha")) if p.get("fecha") else ""})
    write_json(MAP / "reservoirs.json", res)
    for layer, name_field, out in (("Pluviometros_Mapa", "pluviometro_nombre", "rain_stations.json"), ("Caudales_Mapa", "estacion_nombre", "flow_stations.json")):
        fields = "pluviometro_id,pluviometro_nombre,zona_nombre" if layer.startswith("Pluv") else "estacion_id,estacion_nombre,Rio,ambito_nombre"
        pts = []
        for f in geojson(layer, fields):
            p = f.get("properties") or {}
            lon, lat = (f.get("geometry") or {}).get("coordinates") or (None, None)
            sid = p.get("pluviometro_id") if layer.startswith("Pluv") else p.get("estacion_id")
            pts.append({"id": int(sid) if sid is not None else None, "name": p.get(name_field), "zone": p.get("zona_nombre") or p.get("ambito_nombre"),
                        "river": p.get("Rio") or "", "lon": lon, "lat": lat})
        write_json(MAP / out, pts)
    print("Map points: " + str(len(res)) + " reservoirs")


def run(first_year, outlines):
    today = datetime.now(UTC).date()
    jobs = (("basins", basins, ES / "basins.csv", BASIN_FIELDS, "key", 1988),
            ("rain", rain, ES / "rain.csv", RAIN_FIELDS, "station_id", 1995),
            ("river flows", flows, ES / "river_flows.csv", FLOW_FIELDS, "station_id", 2001))
    for name, fn, path, fields, id_field, earliest in jobs:
        start = date(max(first_year, earliest), 1, 1) if first_year else today - timedelta(days=70)
        total = 0
        y = start
        while y <= today:
            end = min(date(y.year, 12, 31), today)
            rows = fn(y, end)
            total += merge(path, fields, rows, y, end, id_field)
            if first_year:
                print("  " + name + " " + str(y.year) + ": " + str(len(rows)) + " rows")
            y = date(y.year + 1, 1, 1)
            time.sleep(1)
        print("Spain " + name + ": " + str(total) + " rows from " + start.isoformat())
    latest_map(outlines)
    with (ES / "basins.csv").open(newline="", encoding="utf-8") as h:
        keys = {r.get("key") for r in csv.DictReader(h)}
    shapes = {f.get("properties", {}).get("key") for f in json.loads((MAP / "basins.json").read_text(encoding="utf-8")).get("features")}
    print("Basins without an outline: " + (", ".join(sorted(keys - shapes)) or "none"))
    print("Outlines without data: " + (", ".join(sorted(shapes - keys)) or "none"))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--from", dest="first", type=int, default=0)
    parser.add_argument("--outlines", action="store_true")
    args = parser.parse_args()
    run(args.first, args.outlines)


main()
