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
    url = f"{ESIOS_URL}{path}"
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
                time.sleep(15 * attempt)
                continue
            raise RuntimeError(f"HTTP {error.code}: {body}") from error
        except (urllib.error.URLError, TimeoutError) as error:
            if attempt < 3:
                time.sleep(15 * attempt)
                continue
            raise RuntimeError(str(error)) from error
    return None


def esios_values(ind_id, start, end):
    payload = esios_get(f"/indicators/{ind_id}", {
        "start_date": start.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "end_date": end.strftime("%Y-%m-%dT%H:%M:%SZ"),
    })
    return ((payload or {}).get("indicator") or {}).get("values") or []


def esios_time(v):
    raw = v.get("datetime_utc") or v.get("datetime")
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).astimezone(UTC)
    except ValueError:
        return None


def matches(name, rule):
    n = name.lower()
    if not any(w in n for w in rule["any"]):
        return False
    if "and_any" in rule and not any(w in n for w in rule["and_any"]):
        return False
    if "not_any" in rule and any(w in n for w in rule["not_any"]):
        return False
    return True


def probe_esios():
    say("## ESIOS (REE)")
    say()
    catalogue = esios_get("/indicators", {"locale": "es"})
    items = (catalogue or {}).get("indicators") or []
    say(f"Catalogue: {len(items)} indicators.")
    say()
    now = datetime.now(UTC).replace(minute=0, second=0, microsecond=0)
    recent = (now - timedelta(days=3), now + timedelta(days=3))
    early = (datetime(2015, 1, 5, tzinfo=UTC), datetime(2015, 1, 6, tzinfo=UTC))
    for group, rule in GROUPS.items():
        hits = sorted((it for it in items if matches(it.get("name") or "", rule)),
                      key=lambda x: x.get("id") or 0)
        say(f"### {group}")
        say()
        say(f"{len(hits)} catalogue matches.")
        say()
        if not hits:
            continue
        say("| ID | Name | Latest value (UTC) | Hours ahead (+) or behind (−) now | Step (min) | Geo areas | Data on 5 Jan 2015 |")
        say("|---|---|---|---|---|---|---|")
        for it in hits[:MAX_TESTS]:
            iid = it.get("id")
            try:
                vals = esios_values(iid, *recent)
                times = [t for t in (esios_time(v) for v in vals) if t]
                latest = max(times) if times else None
                last_v = next((v.get("value") for v in vals if esios_time(v) == latest), None)
                lag = f"{(latest - now).total_seconds() / 3600:+.0f}" if latest else "–"
                geos = sorted({str(v.get("geo_name") or v.get("geo_id")) for v in vals})
                time.sleep(0.4)
                old = esios_values(iid, *early)
                say(f"| {iid} | {cell(it.get('name'))} | "
                    f"{f'{latest:%Y-%m-%d %H:%M} = {last_v}' if latest else 'none'} | {lag} | "
                    f"{step_minutes(times) or '–'} | {cell(', '.join(geos), 60) or '–'} | {'yes' if old else 'no'} |")
            except Exception as error:  # noqa: BLE001
                say(f"| {iid} | {cell(it.get('name'))} | FAILED: {cell(error, 80)} | | | | |")
            time.sleep(0.4)
        if len(hits) > MAX_TESTS:
            say()
            say("Not fetched: " + "; ".join(f"{it.get('id')} {cell(it.get('name'), 70)}" for it in hits[MAX_TESTS:]))
        say()


# --------------------------------------------------------------------------
# ENTSO-E
# --------------------------------------------------------------------------

def tp(dt):
    return dt.strftime("%Y%m%d%H%M")


def entsoe_raw(params):
    """List of XML documents (zip replies are unpacked). [] when no data."""
    key = os.environ.get("ENTSOE_API_KEY")
    if not key:
        raise RuntimeError("ENTSOE_API_KEY is not set")
    url = ENTSOE_URL + "?" + urllib.parse.urlencode({"securityToken": key, **params})
    for attempt in range(1, 4):
        try:
            with urllib.request.urlopen(url, timeout=180) as response:
                body = response.read()
            break
        except urllib.error.HTTPError as error:
            text = error.read().decode("utf-8", "replace")
            if "No matching data" in text or ("Acknowledgement" in text and error.code == 400):
                reason = text.split("<text>")[-1].split("</text>")[0] if "<text>" in text else text[:150]
                raise LookupError(reason.strip()[:150]) from error
            if (error.code == 429 or error.code >= 500) and attempt < 3:
                time.sleep(20 * attempt)
                continue
            raise RuntimeError(f"HTTP {error.code}: {text[:150]}") from error
        except (urllib.error.URLError, TimeoutError) as error:
            if attempt < 3:
                time.sleep(20 * attempt)
                continue
            raise RuntimeError(str(error)) from error
    if body[:2] == b"PK":
        with zipfile.ZipFile(io.BytesIO(body)) as zf:
            return [zf.read(n) for n in zf.namelist() if n.lower().endswith(".xml")]
    if b"Acknowledgement_MarketDocument" in body[:500]:
        text = body.decode("utf-8", "replace")
        reason = text.split("<text>")[-1].split("</text>")[0] if "<text>" in text else "no data"
        raise LookupError(reason.strip()[:150])
    return [body]


def ns_of(root):
    return root.tag.split("}")[0] + "}" if root.tag.startswith("{") else ""


def read_series(docs):
    """Per TimeSeries: name, psrType, mRID, latest time, latest value, step, points."""
    out = []
    for doc in docs:
        root = ET.fromstring(doc)
        ns = ns_of(root)
        for ts in root.iter(f"{ns}TimeSeries"):
            def txt(path):
                el = ts.find(path)
                return el.text if el is not None else None
            name = txt(f".//{ns}PowerSystemResources/{ns}name") or txt(f".//{ns}registeredResource.name")
            mrid = txt(f".//{ns}PowerSystemResources/{ns}mRID") or txt(f".//{ns}registeredResource.mRID")
            psr = txt(f".//{ns}psrType")
            times, latest = [], None
            step = None
            for period in ts.iter(f"{ns}Period"):
                start = period.find(f"{ns}timeInterval/{ns}start").text
                res = period.find(f"{ns}resolution").text
                step = {"PT15M": 15, "PT30M": 30, "PT60M": 60, "P1D": 1440, "P7D": 10080, "P1Y": 525600}.get(res, 60)
                t0 = datetime.fromisoformat(start.replace("Z", "+00:00"))
                for pt in period.findall(f"{ns}Point"):
                    pos = int(pt.find(f"{ns}position").text)
                    t = t0 + timedelta(minutes=step * (pos - 1))
                    times.append(t)
                    for tag in ("quantity", "price.amount"):
                        el = pt.find(f"{ns}{tag}")
                        if el is not None and (latest is None or t >= latest[0]):
                            latest = (t, el.text)
            out.append({"name": name, "mrid": mrid, "psr": psr, "latest": latest, "step": step, "n": len(times)})
    return out


def entsoe_check(label, params, start, end):
    try:
        docs = entsoe_raw({**params, "periodStart": tp(start), "periodEnd": tp(end)})
        return docs, None
    except LookupError as error:
        return [], f"no data ({error})"
    except Exception as error:  # noqa: BLE001
        return [], f"FAILED: {cell(error, 150)}"


def probe_entsoe():
    say("## ENTSO-E")
    say()
    now = datetime.now(UTC).replace(minute=0, second=0, microsecond=0)
    day = now.replace(hour=0) - timedelta(days=1)

    # 1. Actual output per generating unit (A73) - one day only allowed.
    say("### Output per generating unit (A73/A16), yesterday")
    say()
    docs, err = entsoe_check("A73", {"documentType": "A73", "processType": "A16", "in_Domain": ES}, day, day + timedelta(days=1))
    if err:
        say(err)
    else:
        series = read_series(docs)
        nuclear = [s for s in series if s["psr"] == "B14"]
        say(f"{len(series)} units returned, {len(nuclear)} of them nuclear (B14). Latest point across all: "
            f"{max((s['latest'][0] for s in series if s['latest']), default='none')}.")
        say()
        if nuclear:
            say("| Nuclear unit | Unit code (mRID) | Latest point (UTC) | Last value (MW) | Step (min) |")
            say("|---|---|---|---|---|")
            for s in sorted(nuclear, key=lambda x: x["name"] or ""):
                lt = s["latest"]
                say(f"| {cell(s['name'])} | {s['mrid']} | {lt%Y-%m-%d %H:%M} | {lt[1]} | {s['step']} |" if lt
                    else f"| {cell(s['name'])} | {s['mrid']} | none | – | – |")
        time.sleep(1)
        old, err_old = entsoe_check("A73 2015", {"documentType": "A73", "processType": "A16", "in_Domain": ES},
                                    datetime(2015, 1, 5, tzinfo=UTC), datetime(2015, 1, 6, tzinfo=UTC))
        old_n = len(read_series(old)) if old else 0
        say()
        say(f"Same request for 5 Jan 2015: {old_n} units{'' if not err_old else ' (' + err_old + ')'}.")
    say()
    time.sleep(1)

    # 2. Unavailability of generation and production units (A80 / A77).
    for doc_type, label in (("A80", "generation units"), ("A77", "production units")):
        say(f"### Unavailability of {label} ({doc_type}), notices touching the next 30 days")
        say()
        docs, err = entsoe_check(doc_type, {"documentType": doc_type, "biddingZone_Domain": ES},
                                 now - timedelta(days=1), now + timedelta(days=30))
        if err:
            say(err)
        else:
            rows = []
            for doc in docs:
                root = ET.fromstring(doc)
                ns = ns_of(root)
                ts = root.find(f".//{ns}TimeSeries")
                if ts is None:
                    continue
                def g(path):
                    el = ts.find(path)
                    return el.text if el is not None else ""
                created = root.find(f"{ns}createdDateTime")
                rows.append((
                    g(f".//{ns}production_RegisteredResource.name"),
                    g(f".//{ns}production_RegisteredResource.pSRType.psrType"),
                    g(f".//{ns}businessType"),
                    g(f".//{ns}start_DateAndOrTime.date"),
                    g(f".//{ns}end_DateAndOrTime.date"),
                    g(f".//{ns}production_RegisteredResource.pSRType.powerSystemResources.nominalP"),
                    created.text if created is not None else "",
                ))
            nuclear = [r for r in rows if r[1] == "B14"]
            say(f"{len(rows)} notices returned, {len(nuclear)} of them nuclear (B14). "
                "Business type A53 = planned, A54 = forced.")
            say()
            if rows:
                say("| Unit | Fuel | Type | Start | End | Nominal MW | Notice created |")
                say("|---|---|---|---|---|---|---|")
                for r in (nuclear or rows)[:25]:
                    say("| " + " | ".join(cell(x, 50) for x in r) + " |")
            time.sleep(1)
            old, err_old = entsoe_check(doc_type + " 2015", {"documentType": doc_type, "biddingZone_Domain": ES},
                                        datetime(2015, 1, 5, tzinfo=UTC), datetime(2015, 2, 5, tzinfo=UTC))
            say()
            say(f"Same request for Jan 2015: {len(old)} notices{'' if not err_old else ' (' + err_old + ')'}.")
        say()
        time.sleep(1)

    # 3. Installed capacity per unit (A71) and per type (A68).
    say("### Installed capacity")
    say()
    year = datetime(now.year, 1, 1, tzinfo=UTC)
    for doc_type, label in (("A71", "per unit (A71/A33)"), ("A68", "per type (A68/A33)")):
        docs, err = entsoe_check(doc_type, {"documentType": doc_type, "processType": "A33", "in_Domain": ES},
                                 year, year + timedelta(days=1))
        if err:
            say(f"- {label}: {err}")
            continue
        series = read_series(docs)
        nuclear = [s for s in series if s["psr"] == "B14"]
        detail = "; ".join(f"{cell(s['name'] or s['psr'], 40)} {s['latest'][1] if s['latest'] else '–'} MW" for s in nuclear)
        say(f"- {label}: {len(series)} series, nuclear: {detail or 'none'}")
        time.sleep(1)
    say()

    # 4. Wind and solar forecasts with other settings.
    say("### Wind and solar forecasts (A69), other settings")
    say()
    say("| Settings | Series | Latest point (UTC) | Production types |")
    say("|---|---|---|---|")
    for label, extra in (
        ("Day ahead (A01), no fuel given", {"processType": "A01"}),
        ("Day ahead (A01), solar B16", {"processType": "A01", "psrType": "B16"}),
        ("Day ahead (A01), wind onshore B19", {"processType": "A01", "psrType": "B19"}),
        ("Intraday (A40)", {"processType": "A40"}),
        ("Current (A18)", {"processType": "A18"}),
    ):
        docs, err = entsoe_check(label, {"documentType": "A69", "in_Domain": ES, **extra},
                                 now - timedelta(days=2), now + timedelta(days=2))
        if err:
            say(f"| {label} | {err} | | |")
        else:
            series = read_series(docs)
            latest = max((s["latest"][0] for s in series if s["latest"]), default=None)
            say(f"| {label} | {len(series)} | {latest:%Y-%m-%d %H:%M} | {', '.join(sorted({s['psr'] or '–' for s in series}))} |"
                if latest else f"| {label} | {len(series)} | none | – |")
        time.sleep(1)
    say()

    # 5. Day-ahead price: latest point per series, to explain probe 1's lag.
    say("### Day-ahead price (A44), latest point per series")
    say()
    docs, err = entsoe_check("A44", {"documentType": "A44", "in_Domain": ES, "out_Domain": ES},
                             now - timedelta(days=2), now + timedelta(days=2))
    if err:
        say(err)
    else:
        say("| Series | Points | Latest point (UTC) | Last price | Step (min) |")
        say("|---|---|---|---|---|")
        for i, s in enumerate(read_series(docs), 1):
            lt = s["latest"]
            say(f"| {i} | {s['n']} | {lt%Y-%m-%d %H:%M} | {lt[1]} | {s['step']} |" if lt else f"| {i} | 0 | none | – | – |")
    say()


def main():
    say("# Spain probe 2 report")
    say()
    say(f"Run at {datetime.now(UTC):%Y-%m-%d %H:%M} UTC. Read-only: nothing in data/ was changed.")
    say()
    for step in (probe_esios, probe_entsoe):
        try:
            step()
        except Exception:  # noqa: BLE001
            say("```")
            say(traceback.format_exc())
            say("```")
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "spain_probe2_report.md").write_text("\n".join(report) + "\n", encoding="utf-8")
    print(f"Report written to {OUT / 'spain_probe2_report.md'}")


if __name__ == "__main__":
    main()
