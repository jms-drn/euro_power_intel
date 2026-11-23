// Spain Hydro Overview: loaders for MITECO's basin and reservoir data (from
// scripts/es_basins.py), the measures, comparisons and colour scales behind
// the map, small sparklines, and hydro output and inflow sums for the cards.
// Code note: no asterisks here (chat formatting strips them when pasted).
import { cached, fetchText } from "./data.js";
import { addDays } from "./util.js";
import { meanOf, mul } from "./es-common.js";
import { near, shiftDate, yearsBack } from "./es-hydro.js";

export const MEASURES = {
  wpct: { label: "Water % full", short: "water, % full", unit: "%", diff: "pp", dec: 1, v: r => (r.cap_hm3 ? mul(r.water_hm3, 100) / r.cap_hm3 : null) },
  epct: { label: "Hydro energy % full", short: "hydroelectric energy, % full", unit: "%", diff: "pp", dec: 1, v: r => (r.energy_cap ? mul(r.energy, 100) / r.energy_cap : null) },
  gwh: { label: "Energy (GWh)", short: "hydroelectric energy", unit: "GWh", diff: "GWh", dec: 0, v: r => (r.energy_cap ? r.energy : null) },
  hm3: { label: "Volume (hm³)", short: "water stored", unit: "hm³", diff: "hm³", dec: 0, v: r => r.water_hm3 }
};
export const COMPARE = { avg5: "5-year average", avg10: "10-year average", ly: "Last year", week: "Last week" };
export const AGAINST = { avg5: "the 5-year average", avg10: "the 10-year average", ly: "last year", week: "last week" };
export const showOptions = m => [["diff", m.diff === "pp" ? "Points (pp)" : m.diff + " difference"], ["pct", "% difference"], ["level", "Level"]];
const SUM_FIELDS = ["water_hm3", "cap_hm3", "hydro_water_hm3", "hydro_cap_hm3", "energy", "energy_cap", "reservoirs"];

// MITECO's reservoir uses, in English.
const USES = { consuntivo: "Water supply and irrigation", hidroelectrico: "Hydropower", mixto: "Mixed use" };
export const keyOf = s => String(s || "").normalize("NFD").toLowerCase().replace(/[^a-z]/g, "");
export const useLabel = u => USES[keyOf(u)] || u || "";

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
export function loadCsv(path, text) {
  return cached("es-csv-" + path, async () => {
    const lines = (await fetchText(path, { optional: true }).catch(() => "")).trim().split(/\r?\n/);
    const head = splitCsv(lines.at(0) || "");
    return lines.slice(1).filter(Boolean).map(line => {
      const v = splitCsv(line);
      const o = {};
      head.forEach((h, i) => { const x = v.at(i); o[h] = text.includes(h) ? x : (x === "" || x == null ? null : Number(x)); });
      return o;
    });
  });
}

// Weekly basin levels: { dates, keys, names, byKey }; byKey maps a basin key
// (and "all" for Spain) to a Map of date to row.
export function getBasins() {
  return cached("es-basins", async () => {
    const rows = await loadCsv("data/es/basins.csv", ["date", "basin", "key"]);
    const byKey = new Map();
    const names = new Map();
    const all = new Map();
    for (const r of rows) {
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

// Basin outlines, registered with ECharts as "es-basins" under their proper names.
export function loadBasinMap(names) {
  return cached("es-basin-map", async () => {
    const geo = JSON.parse(await fetchText("data/es/map/basins.json"));
    for (const f of geo.features || []) {
      const k = f.properties.key;
      f.properties = { key: k, name: names.get(k) || f.properties.name || k };
    }
    echarts.registerMap("es-basins", geo);
    return true;
  });
}
export const getReservoirPoints = () => cached("es-res-points", async () => JSON.parse(await fetchText("data/es/map/reservoirs.json", { optional: true }).catch(() => "[]") || "[]"));

// One basin's weekly values for a measure, as a Map of date to value.
export function valuesOf(data, key, measure) {
  const m = MEASURES[measure] || MEASURES.wpct;
  const out = new Map();
  for (const [d, r] of data.byKey.get(key) || new Map()) out.set(d, m.v(r));
  return out;
}
// The bulletin on or just before a date (or the latest if empty).
export function pickDate(dates, d) {
  if (!d) return dates.at(-1);
  const before = dates.filter(x => x <= d);
  return before.length ? before.at(-1) : dates.at(0);
}

// Every basin and Spain on one bulletin date: value, comparisons and the
// value used for shading (difference, % difference or level).
export function basinView(data, measure, compare, show, date) {
  const i = data.dates.indexOf(date);
  const prev = i > 0 ? data.dates.at(i - 1) : null;
  const avgOf = (vals, n) => { const xs = yearsBack(n).map(k => near(vals, shiftDate(date, -k))).filter(x => x != null); return xs.length ? meanOf(xs) : null; };
  const rangeOf = (vals, n) => { const xs = yearsBack(n).map(k => near(vals, shiftDate(date, -k))).filter(x => x != null); return xs.length >= 2 ? [Math.min(...xs), Math.max(...xs)] : [null, null]; };
  const view = key => {
    const vals = valuesOf(data, key, measure);
    const v = vals.get(date) ?? null;
    const b = { key, name: data.names.get(key), v, row: data.byKey.get(key).get(date) || {},
      avg5: avgOf(vals, 5), avg10: avgOf(vals, 10), ly: near(vals, shiftDate(date, -1)), week: prev ? vals.get(prev) ?? null : null };
    b.range = rangeOf(vals, compare === "avg10" ? 10 : 5);
    b.ref = b[compare];
    b.d = v == null || b.ref == null ? null : v - b.ref;
    b.p = b.d == null || !b.ref ? null : mul(b.d, 100) / Math.abs(b.ref);
    b.s = show === "level" ? v : show === "pct" ? b.p : b.d;
    b.spark = data.dates.slice(Math.max(0, i - 11), i + 1).map(d => vals.get(d) ?? null);
    return b;
  };
  return { date, prev, spain: view("all"), basins: data.keys.map(view) };
}

// Colours. Differences: each side scaled on its own, capped at the
// second-largest value so a single outlier cannot wash out the rest.
const RED = ["#8e969f", "#c98a84", "#b4544e", "#8f3a36"];
const BLUE = ["#8e969f", "#7fa2c9", "#4f7fbd", "#2f5c92"];
const SEQ = ["#d3dde8", "#a7bfd8", "#7aa0c7", "#4f7fb3", "#2f5c92"];
function hex(c) { return [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)); }
function mix(a, b, f) { const x = hex(a); const y = hex(b); return "#" + x.map((v, i) => Math.round(v + mul(y.at(i) - v, f)).toString(16).padStart(2, "0")).join(""); }
function ramp(stops, f) {
  const p = Math.max(0, Math.min(1, f));
  const i = Math.min(stops.length - 2, Math.floor(mul(p, stops.length - 1)));
  return mix(stops.at(i), stops.at(i + 1), mul(p, stops.length - 1) - i);
}
function niceUp(x) {
  if (!(x > 0)) return 1;
  const step = x > 200 ? 50 : x > 50 ? 10 : x > 20 ? 5 : x > 5 ? 2 : x > 1 ? 1 : 0.5;
  return Math.ceil(x / step) / (1 / step);
}
function sideLimit(abs) {
  const xs = abs.filter(v => v > 0).sort((a, b) => b - a);
  if (!xs.length) return { lim: 1, capped: false };
  const lim = niceUp(xs.length >= 3 ? xs.at(1) : xs.at(0));
  return { lim, capped: xs.at(0) > lim };
}
export function scaleFor(values, show) {
  const vs = values.filter(v => v != null && Number.isFinite(v));
  if (show === "level") {
    const lo = vs.length ? Math.min(...vs) : 0;
    const hi = vs.length ? Math.max(...vs) : 1;
    return { diverging: false, lo, hi, colour: v => (v == null ? null : ramp(SEQ, hi > lo ? (v - lo) / (hi - lo) : 0.5)), stops: SEQ };
  }
  const neg = sideLimit(vs.filter(v => v < 0).map(Math.abs));
  const pos = sideLimit(vs.filter(v => v > 0));
  return {
    diverging: true, lo: -neg.lim, hi: pos.lim, loCapped: neg.capped, hiCapped: pos.capped,
    colour: v => (v == null ? null : v < 0 ? ramp(RED, Math.abs(v) / neg.lim) : ramp(BLUE, v / pos.lim)),
    stops: [...[...RED].reverse(), ...BLUE.slice(1)]
  };
}
export const fillColour = pctFull => ramp(SEQ, (pctFull ?? 0) / 100);

// A small line of the last weeks (rising blue, falling red).
export function sparkline(values) {
  const vs = values.filter(v => v != null);
  if (vs.length < 2) return "";
  const lo = Math.min(...vs);
  const hi = Math.max(...vs);
  const pts = values.map((v, i) => (v == null ? null : [mul(i, 64 / Math.max(1, values.length - 1)), 17 - mul(hi > lo ? (v - lo) / (hi - lo) : 0.5, 15)])).filter(Boolean);
  const col = vs.at(-1) >= vs.at(0) ? "#5b8bc4" : "#c0675e";
  return `<svg width="64" height="18" viewBox="0 0 64 18" aria-hidden="true" style="flex:none"><polyline fill="none" stroke="${col}" stroke-width="1.5" points="${pts.map(p => p.at(0).toFixed(1) + "," + p.at(1).toFixed(1)).join(" ")}"/></svg>`;
}

// Hydro output (REE, net of pumping) to a date: past 7 days, month to date
// and year to date, against last year and the 5- and 10-year norms.
export function genStats(mix, asOf) {
  const mw = d => { const r = mix.byDate.get(d); return r && r.hydro != null ? r.hydro : null; };
  const window = (from, to) => { const out = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push(d); return out; };
  const avgMw = (days, k) => { const xs = days.map(d => mw(shiftDate(d, -k))).filter(v => v != null); return xs.length >= mul(days.length, 0.8) ? meanOf(xs) : null; };
  const block = days => {
    const v = avgMw(days, 0);
    const n5 = meanOf(yearsBack(5).map(k => avgMw(days, k)));
    const n10 = meanOf(yearsBack(10).map(k => avgMw(days, k)));
    return { v, ly: avgMw(days, 1), n5, n10, days: days.length };
  };
  return {
    asOf,
    week: block(window(addDays(asOf, -6), asOf)),
    month: block(window(asOf.slice(0, 8) + "01", asOf)),
    year: block(window(asOf.slice(0, 5) + "01-01", asOf))
  };
}

// Estimated weekly inflow (GWh) per bulletin: REE net hydro output between two
// bulletins plus the change in hydroelectric energy stored.
export function inflowSeries(all, mix) {
  const gwh = d => { const r = mix.byDate.get(d); return r && r.hydro != null ? mul(r.hydro, 24) / 1000 : null; };
  const dates = [...all.keys()].sort().filter(d => d >= "2015-01-01");
  const out = new Map();
  for (let i = 1; i < dates.length; i++) {
    const a = all.get(dates.at(i - 1));
    const b = all.get(dates.at(i));
    if (a.energy == null || b.energy == null) continue;
    let gen = 0;
    let ok = true;
    for (let d = addDays(a.date, 1); d <= b.date; d = addDays(d, 1)) {
      const g = gwh(d);
      if (g == null) { ok = false; break; }
      gen += g;
    }
    if (ok) out.set(b.date, gen + b.energy - a.energy);
  }
  return out;
}
