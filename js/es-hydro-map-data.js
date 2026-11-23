// Spain Reserves map: loaders for MITECO's basin and reservoir data (written
// by scripts/es_basins.py) and the sums behind the map's shading.
// Code note: no asterisks here (chat formatting strips them when pasted).
import { cached, fetchText } from "./data.js";
import { meanOf, mul } from "./es-common.js";
import { near, shiftDate, yearsBack } from "./es-hydro.js";

export const MEASURES = {
  pct: { label: "% full", short: "% full", phrase: "were", tail: " full", unit: "%", diff: "pp", dec: 1, v: r => (r.cap_hm3 ? mul(r.water_hm3, 100) / r.cap_hm3 : null) },
  gwh: { label: "Energy (GWh)", short: "hydroelectric energy stored", phrase: "held", tail: " of hydroelectric energy", unit: "GWh", diff: "GWh", dec: 0, v: r => (r.energy_cap ? r.energy : null) },
  hm3: { label: "Volume (hm³)", short: "water stored", phrase: "held", tail: " of water", unit: "hm³", diff: "hm³", dec: 0, v: r => r.water_hm3 }
};
export const SHADES = {
  avg: "Against the average",
  avgpct: "% against the average",
  ly: "Against last year",
  week: "Change on the week",
  level: "Level"
};
const SUM_FIELDS = ["water_hm3", "cap_hm3", "hydro_water_hm3", "hydro_cap_hm3", "energy", "energy_cap", "reservoirs"];

function splitCsv(line) {
  const out = [];
  let cur = "";
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') { quoted = !quoted; continue; }
    if (ch === "," && !quoted) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

// Weekly basin levels: { dates, keys, names, byKey } where byKey maps a basin
// key (and "all" for Spain) to a Map of date to row.
export function getBasins() {
  return cached("es-basins", async () => {
    const lines = (await fetchText("data/es/basins.csv", { optional: true }).catch(() => "")).trim().split("\n");
    const head = splitCsv(lines.at(0) || "");
    const byKey = new Map();
    const names = new Map();
    const all = new Map();
    for (const line of lines.slice(1)) {
      const v = splitCsv(line);
      const r = {};
      head.forEach((h, i) => { const x = v.at(i); r[h] = h === "date" || h === "basin" || h === "key" ? x : (x === "" || x == null ? null : Number(x)); });
      if (!byKey.has(r.key)) byKey.set(r.key, new Map());
      byKey.get(r.key).set(r.date, r);
      names.set(r.key, r.basin);
      if (!all.has(r.date)) all.set(r.date, { date: r.date });
      const a = all.get(r.date);
      for (const f of SUM_FIELDS) if (r[f] != null) a[f] = (a[f] || 0) + r[f];
    }
    byKey.set("all", all);
    names.set("all", "Spain (mainland)");
    const dates = [...all.keys()].sort();
    const keys = [...names.keys()].filter(k => k !== "all").sort((a, b) => names.get(a).localeCompare(names.get(b)));
    return { dates, keys, names, byKey };
  });
}

// Basin outlines, registered with ECharts as "es-basins" (region name = key).
export function loadBasinMap() {
  return cached("es-basin-map", async () => {
    const geo = JSON.parse(await fetchText("data/es/map/basins.json"));
    for (const f of geo.features || []) f.properties = { ...f.properties, name: f.properties.key };
    echarts.registerMap("es-basins", geo);
    return true;
  });
}
export const getReservoirPoints = () => cached("es-res-points", async () => JSON.parse(await fetchText("data/es/map/reservoirs.json", { optional: true }).catch(() => "[]") || "[]"));

// One basin's weekly values for a measure, as a Map of date to value.
export function valuesOf(data, key, measure) {
  const m = MEASURES[measure] || MEASURES.pct;
  const out = new Map();
  for (const [d, r] of data.byKey.get(key) || new Map()) out.set(d, m.v(r));
  return out;
}

// Latest bulletin for every basin and Spain: value, last year, average and
// range of the N years before, weekly change and the shading value.
export function basinView(data, measure, shade, n) {
  const last = data.dates.at(-1);
  const prev = data.dates.at(-2);
  const K = yearsBack(n);
  const view = key => {
    const vals = valuesOf(data, key, measure);
    const v = vals.get(last) ?? null;
    const past = K.map(k => near(vals, shiftDate(last, -k))).filter(x => x != null);
    const avg = past.length ? meanOf(past) : null;
    const ly = near(vals, shiftDate(last, -1));
    const before = prev ? vals.get(prev) ?? null : null;
    const row = data.byKey.get(key).get(last) || {};
    const b = { key, name: data.names.get(key), v, ly, avg, min: past.length ? Math.min(...past) : null, max: past.length ? Math.max(...past) : null,
      week: v != null && before != null ? v - before : null, row };
    b.s = v == null ? null
      : shade === "level" ? v
      : shade === "ly" ? (ly == null ? null : v - ly)
      : shade === "week" ? b.week
      : shade === "avgpct" ? (avg ? mul(v - avg, 100) / avg : null)
      : (avg == null ? null : v - avg);
    return b;
  };
  return { last, prev, spain: view("all"), basins: data.keys.map(view) };
}

// Colours: a muted diverging scale for differences, a single blue for levels.
const DIV = ["#b4544e", "#c98a84", "#8e969f", "#7fa2c9", "#4f7fbd"];
const SEQ = ["#d3dde8", "#a7bfd8", "#7aa0c7", "#4f7fb3", "#2f5c92"];
function hex(c) { return [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)); }
function mix(a, b, f) { const x = hex(a); const y = hex(b); return "#" + x.map((v, i) => Math.round(v + mul(y.at(i) - v, f)).toString(16).padStart(2, "0")).join(""); }
function ramp(stops, f) {
  const p = Math.max(0, Math.min(1, f));
  const i = Math.min(stops.length - 2, Math.floor(mul(p, stops.length - 1)));
  return mix(stops.at(i), stops.at(i + 1), mul(p, stops.length - 1) - i);
}
export function scaleFor(values, shade) {
  const vs = values.filter(v => v != null && Number.isFinite(v));
  if (shade === "level") {
    const lo = vs.length ? Math.min(...vs) : 0;
    const hi = vs.length ? Math.max(...vs) : 1;
    return { diverging: false, lo, hi, colour: v => (v == null ? null : ramp(SEQ, hi > lo ? (v - lo) / (hi - lo) : 0.5)), stops: SEQ };
  }
  const raw = vs.length ? Math.max(...vs.map(Math.abs)) : 1;
  const step = raw > 200 ? 100 : raw > 50 ? 25 : raw > 20 ? 10 : raw > 5 ? 5 : 1;
  const lim = Math.max(step, Math.ceil(raw / step) / (1 / step));
  return { diverging: true, lo: -lim, hi: lim, colour: v => (v == null ? null : ramp(DIV, (v + lim) / (lim + lim))), stops: DIV };
}
export const fillColour = pctFull => ramp(SEQ, (pctFull ?? 0) / 100);
