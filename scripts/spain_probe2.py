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
f-strings, and the code avoids asterisks and double underscores:
chat formatting strips them when code is pasted.
"""
import io
from operator import mul
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
OUT = Path("probe") / "out"  # the workflow runs from the repository root
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
                time.sleep(mul(15, attempt))
                continue
            raise RuntimeError("HTTP " + str(error.code) + ": " + body) from error
        except (urllib.error.URLError, TimeoutError) as error:
            if attempt < 3:
                time.sleep(mul(15, attempt))
                continue
            raise RuntimeError(str(error)) from error
    return None


def esios_values(ind_id, start, end):
    payload = esios_get("/indicators/" + str(ind_id), {
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
    say("Catalogue: " + str(len(items)) + " indicators.")
    say()
    now = datetime.now(UTC).replace(minute=0, second=0, microsecond=0)
    recent = (now - timedelta(days=3), now + timedelta(days=3))
    early = (datetime(2015, 1, 5, tzinfo=UTC), datetime(2015, 1, 6, tzinfo=UTC))
    for group, rule in GROUPS.items():
        hits = sorted((it for it in items if matches(it.get("name") or "", rule)),
                      key=lambda x: x.get("id") or 0)
        say("### " + group)
        say()
        say(str(len(hits)) + " catalogue matches.")
        say()
        if not hits:
            continue
        say("| ID | Name | Latest value (UTC) | Hours ahead (+) or behind (-) now | Step (min) | Geo areas | Data on 5 Jan 2015 |")
        say("|---|---|---|---|---|---|---|")
        for it in hits[:MAX_TESTS]:
            iid = it.get("id")
            name = cell(it.get("name"))
            try:
                vals = esios_values(iid, recent[0], recent[1])
                times = [t for t in (esios_time(v) for v in vals) if t]
                latest = max(times) if times else None
                last_v = next((v.get("value") for v in vals if esios_time(v) == latest), None)
                latest_txt = (fmt_time(latest) + " = " + str(last_v)) if latest else "none"
                lag = format((latest - now).total_seconds() / 3600, "+.0f") if latest else "-"
                geos = sorted({str(v.get("geo_name") or v.get("geo_id")) for v in vals})
                geo_txt = cell(", ".join(geos), 60) or "-"
                step = step_minutes(times) or "-"
                time.sleep(0.4)
                old = esios_values(iid, early[0], early[1])
                old_txt = "yes" if old else "no"
                say("| " + " | ".join([str(iid), name, latest_txt, lag, str(step), geo_txt, old_txt]) + " |")
            except Exception as error:  # noqa: BLE001
                say("| " + str(iid) + " | " + name + " | FAILED: " + cell(error, 80) + " | | | | |")
            time.sleep(0.4)
        if len(hits) > MAX_TESTS:
            say()
            say("Not fetched: " + "; ".join(str(it.get("id")) + " " + cell(it.get("name"), 70) for it in hits[MAX_TESTS:]))
        say()


# --------------------------------------------------------------------------
# ENTSO-E
# --------------------------------------------------------------------------

def merged(a, b):
    out = dict(a)
    out.update(b)
    return out


def tp(dt):
    return dt.strftime("%Y%m%d%H%M")


def ack_reason(text):
    if "<text>" in text:
        return text.split("<text>")[-1].split("</text>")[0].strip()[:150]
    return text[:150]


def entsoe_raw(params):
    """List of XML documents (zip replies are unpacked). LookupError when no data."""
    key = os.environ.get("ENTSOE_API_KEY")
    if not key:
        raise RuntimeError("ENTSOE_API_KEY is not set")
    url = ENTSOE_URL + "?" + urllib.parse.urlencode(merged(params, {"securityToken": key}))
    body = b""
    for attempt in range(1, 4):
        try:
            with urllib.request.urlopen(url, timeout=180) as response:
                body = response.read()
            break
        except urllib.error.HTTPError as error:
            text = error.read().decode("utf-8", "replace")
            if "No matching data" in text or ("Acknowledgement" in text and error.code == 400):
                raise LookupError(ack_reason(text)) from error
            if (error.code == 429 or error.code >= 500) and attempt < 3:
                time.sleep(mul(20, attempt))
                continue
            raise RuntimeError("HTTP " + str(error.code) + ": " + text[:150]) from error
        except (urllib.error.URLError, TimeoutError) as error:
            if attempt < 3:
                time.sleep(mul(20, attempt))
                continue
            raise RuntimeError(str(error)) from error
    if body[:2] == b"PK":
        with zipfile.ZipFile(io.BytesIO(body)) as zf:
            return [zf.read(n) for n in zf.namelist() if n.lower().endswith(".xml")]
    if b"Acknowledgement_MarketDocument" in body[:500]:
        raise LookupError(ack_reason(body.decode("utf-8", "replace")))
    return [body]


def ns_of(root):
    return root.tag.split("}")[0] + "}" if root.tag.startswith("{") else ""


def read_series(docs):
    """Per TimeSeries: name, psrType, mRID, latest (time, value), step, points."""
    out = []
    for doc in docs:
        root = ET.fromstring(doc)
        ns = ns_of(root)
        for ts in root.iter(ns + "TimeSeries"):
            def txt(path):
                el = ts.find(path)
                return el.text if el is not None else None
            name = txt(".//" + ns + "PowerSystemResources/" + ns + "name") or txt(".//" + ns + "registeredResource.name")
            mrid = txt(".//" + ns + "PowerSystemResources/" + ns + "mRID") or txt(".//" + ns + "registeredResource.mRID")
            psr = txt(".//" + ns + "psrType")
            count, latest_t, latest_v, step = 0, None, None, None
            for period in ts.iter(ns + "Period"):
                start = period.find(ns + "timeInterval/" + ns + "start").text
                res = period.find(ns + "resolution").text
                step = {"PT15M": 15, "PT30M": 30, "PT60M": 60, "P1D": 1440, "P7D": 10080, "P1Y": 525600}.get(res, 60)
                t0 = datetime.fromisoformat(start.replace("Z", "+00:00"))
                for pt in period.findall(ns + "Point"):
                    pos = int(pt.find(ns + "position").text)
                    t = t0 + timedelta(minutes=mul(step, pos - 1))
                    count += 1
                    for tag in ("quantity", "price.amount"):
                        el = pt.find(ns + tag)
                        if el is not None and (latest_t is None or t >= latest_t):
                            latest_t, latest_v = t, el.text
            out.append({"name": name, "mrid": mrid, "psr": psr, "latest_t": latest_t,
                        "latest_v": latest_v, "step": step, "n": count})
    return out


def entsoe_check(params, start, end):
    try:
        return entsoe_raw(merged(params, {"periodStart": tp(start), "periodEnd": tp(end)})), None
    except LookupError as error:
        return [], "no data (" + str(error) + ")"
    except Exception as error:  # noqa: BLE001
        return [], "FAILED: " + cell(error, 150)


def latest_of(series):
    times = [s["latest_t"] for s in series if s["latest_t"]]
    return max(times) if times else None


def probe_entsoe():
    say("## ENTSO-E")
    say()
    now = datetime.now(UTC).replace(minute=0, second=0, microsecond=0)
    day = now.replace(hour=0) - timedelta(days=1)

    # 1. Actual output per generating unit (A73): one day per request.
    say("### Output per generating unit (A73/A16), yesterday")
    say()
    params = {"documentType": "A73", "processType": "A16", "in_Domain": ES}
    docs, err = entsoe_check(params, day, day + timedelta(days=1))
    if err:
        say(err)
    else:
        series = read_series(docs)
        nuclear = [s for s in series if s["psr"] == "B14"]
        latest = latest_of(series)
        say(str(len(series)) + " units returned, " + str(len(nuclear)) + " of them nuclear (B14). "
            "Latest point across all: " + (fmt_time(latest) if latest else "none") + ".")
        say()
        if nuclear:
            say("| Nuclear unit | Unit code (mRID) | Latest point (UTC) | Last value (MW) | Step (min) |")
            say("|---|---|---|---|---|")
            for s in sorted(nuclear, key=lambda x: x["name"] or ""):
                t_txt = fmt_time(s["latest_t"]) if s["latest_t"] else "none"
                say("| " + " | ".join([cell(s["name"]), str(s["mrid"]), t_txt,
                                       str(s["latest_v"] or "-"), str(s["step"] or "-")]) + " |")
        time.sleep(1)
        old, err_old = entsoe_check(params, datetime(2015, 1, 5, tzinfo=UTC), datetime(2015, 1, 6, tzinfo=UTC))
        say()
        say("Same request for 5 Jan 2015: " + str(len(read_series(old)) if old else 0) + " units"
            + ((" (" + err_old + ")") if err_old else "") + ".")
    say()
    time.sleep(1)

    # 2. Unavailability of generation and production units (A80 / A77).
    for doc_type, label in (("A80", "generation units"), ("A77", "production units")):
        say("### Unavailability of " + label + " (" + doc_type + "), notices touching the next 30 days")
        say()
        params = {"documentType": doc_type, "biddingZone_Domain": ES}
        docs, err = entsoe_check(params, now - timedelta(days=1), now + timedelta(days=30))
        if err:
            say(err)
        else:
            rows = []
            for doc in docs:
                root = ET.fromstring(doc)
                ns = ns_of(root)
                ts = root.find(".//" + ns + "TimeSeries")
                if ts is None:
                    continue

                def g(tag, ts=ts, ns=ns):
                    el = ts.find(".//" + ns + tag)
                    return el.text if el is not None and el.text else ""
                created = root.find(ns + "createdDateTime")
                rows.append([
                    g("production_RegisteredResource.name"),
                    g("production_RegisteredResource.pSRType.psrType"),
                    g("businessType"),
                    g("start_DateAndOrTime.date"),
                    g("end_DateAndOrTime.date"),
                    g("production_RegisteredResource.pSRType.powerSystemResources.nominalP"),
                    created.text if created is not None and created.text else "",
                ])
            nuclear = [r for r in rows if r[1] == "B14"]
            say(str(len(rows)) + " notices returned, " + str(len(nuclear)) + " of them nuclear (B14). "
                "Business type A53 = planned, A54 = forced.")
            say()
            if rows:
                say("| Unit | Fuel | Type | Start | End | Nominal MW | Notice created |")
                say("|---|---|---|---|---|---|---|")
                for r in (nuclear or rows)[:25]:
                    say("| " + " | ".join(cell(x, 50) for x in r) + " |")
            time.sleep(1)
            old, err_old = entsoe_check(params, datetime(2015, 1, 5, tzinfo=UTC), datetime(2015, 2, 5, tzinfo=UTC))
            say()
            say("Same request for Jan 2015: " + str(len(old)) + " notices"
                + ((" (" + err_old + ")") if err_old else "") + ".")
        say()
        time.sleep(1)

    # 3. Installed capacity per unit (A71) and per type (A68).
    say("### Installed capacity")
    say()
    year = datetime(now.year, 1, 1, tzinfo=UTC)
    for doc_type, label in (("A71", "per unit (A71/A33)"), ("A68", "per type (A68/A33)")):
        params = {"documentType": doc_type, "processType": "A33", "in_Domain": ES}
        docs, err = entsoe_check(params, year, year + timedelta(days=1))
        if err:
            say("- " + label + ": " + err)
            continue
        series = read_series(docs)
        nuclear = [s for s in series if s["psr"] == "B14"]
        detail = "; ".join(cell(s["name"] or s["psr"], 40) + " " + str(s["latest_v"] or "-") + " MW" for s in nuclear)
        say("- " + label + ": " + str(len(series)) + " series, nuclear: " + (detail or "none"))
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
        docs, err = entsoe_check(merged({"documentType": "A69", "in_Domain": ES}, extra),
                                 now - timedelta(days=2), now + timedelta(days=2))
        if err:
            say("| " + label + " | " + err + " | | |")
        else:
            series = read_series(docs)
            latest = latest_of(series)
            psrs = ", ".join(sorted({s["psr"] or "-" for s in series})) or "-"
            say("| " + " | ".join([label, str(len(series)), fmt_time(latest) if latest else "none", psrs]) + " |")
        time.sleep(1)
    say()

    # 5. Day-ahead price: latest point per series, to explain probe 1's lag.
    say("### Day-ahead price (A44), latest point per series")
    say()
    docs, err = entsoe_check({"documentType": "A44", "in_Domain": ES, "out_Domain": ES},
                             now - timedelta(days=2), now + timedelta(days=2))
    if err:
        say(err)
    else:
        say("| Series | Points | Latest point (UTC) | Last price | Step (min) |")
        say("|---|---|---|---|---|")
        for i, s in enumerate(read_series(docs), 1):
            t_txt = fmt_time(s["latest_t"]) if s["latest_t"] else "none"
            say("| " + " | ".join([str(i), str(s["n"]), t_txt, str(s["latest_v"] or "-"), str(s["step"] or "-")]) + " |")
    say()


def main():
    say("# Spain probe 2 report")
    say()
    say("Run at " + fmt_time(datetime.now(UTC)) + " UTC. Read-only: nothing in data/ was changed.")
    say()
    for step in (probe_esios, probe_entsoe):
        try:
            step()
        except Exception:  # noqa: BLE001
            say("Error:")
            for line in traceback.format_exc().splitlines():
                say("    " + line)
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "spain_probe2_report.md").write_text("\n".join(report) + "\n", encoding="utf-8")
    print("Report written to " + str(OUT / "spain_probe2_report.md"))


main()
