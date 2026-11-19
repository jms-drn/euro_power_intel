// Spain data: loaders for the files written by scripts/es_store.py,
// es_prices.py, es_market.py and es_alerts.py.
// Code note: no asterisks here (chat formatting strips them when pasted), so
// multiplication is written with mul().
import { cached, fetchText, parseUtc } from "./data.js";
import { getFlows, getPrices } from "./market-data.js";
import { QUARTER, addDays, dateKey, fmtLongDate, fmtTime, parisMidnight, todayParis } from "./util.js";

export const ES_FIRST = "2015-01-01";
export const PRICE_FIRST = "2015-01-05";
export const REE = "REE (Spanish TSO) via ESIOS";
export const ENTSOE = "ENTSO-E Transparency Platform";
export const BOTH = "ENTSO-E and REE";
export const mul = (a, b) => a / (1 / b);
// Kept for the current main.js; sample data has been retired now that the
// real history is in.
export const usingMock = () => false;

// ---------- Reading CSV files ----------

const num = s => (s === "" || s == null ? null : Number(s));
function parse(text) {
  const lines = (text || "").trim().split("\n");
  if (!lines.at(0)) return { header: [], rows: [] };
  return { header: lines.at(0).split(","), rows: lines.slice(1).map(l => l.split(",")) };
}
function toObjects(text, timeCol) {
  const p = parse(text);
  return p.rows.map(r => {
    const o = {};
    p.header.forEach((h, i) => { o[h] = h === timeCol ? r.at(i) : num(r.at(i)); });
    if (timeCol === "t") o.t = parseUtc(o.t);
    return o;
  });
}
function monthsOf(from, to) {
  const out = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const ty = Number(to.slice(0, 4));
  const tm = Number(to.slice(5, 7));
  while (y < ty || (y === ty && m <= tm)) {
    out.push(y + "-" + String(m).padStart(2, "0"));
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}
async function monthly(base, from, to, cols) {
  const lo = parisMidnight(from);
  const hi = parisMidnight(addDays(to, 1));
  const texts = await Promise.all(monthsOf(from, to).map(ym =>
    fetchText(base + "/" + ym.slice(0, 4) + "/" + ym + ".csv", { optional: true }).catch(() => "")));
  const out = [];
  for (const text of texts) {
    for (const r of toObjects(text, "start_utc")) {
      const t = parseUtc(r.start_utc);
      if (t < lo || t >= hi) continue;
      const rec = { t, min: r.min || 15 };
      for (const c of cols) rec[c] = r[c] ?? null;
      out.push(rec);
    }
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}
function table(rows) {
  return { rows, byDate: new Map(rows.map(r => [r.date, r])) };
}
function daily(name) {
  return cached("es-daily-" + name, async () => table(toObjects(await fetchText("data/es/daily/" + name + ".csv", { optional: true }), "date")));
}

// ---------- Generation ----------

export const MIX_COLS = ["hydro", "coal", "fuel_gas", "nuclear", "ccgt", "wind", "solar", "exchanges", "balearic_link", "other",
  "solar_thermal", "solar_pv", "renewable_thermal", "chp_other", "pump_load", "pump_gen", "hydro_gen"];
export const FUELS = [
  { value: "nuclear", label: "Nuclear", colour: "--f-nuclear" },
  { value: "wind", label: "Wind", colour: "--f-wind" },
  { value: "solar_pv", label: "Solar PV", colour: "--f-solar" },
  { value: "solar_thermal", label: "Solar thermal", colour: "--f-solar-th" },
  { value: "hydro", label: "Hydro", colour: "--f-hydro" },
  { value: "ccgt", label: "Combined cycle (gas)", colour: "--f-gas" },
  { value: "chp_other", label: "Cogeneration and other", colour: "--f-chp" },
  { value: "renewable_thermal", label: "Renewable thermal", colour: "--f-bio" },
  { value: "coal", label: "Coal", colour: "--f-coal" },
  { value: "fuel_gas", label: "Fuel-gas", colour: "--f-oil" }
];
export const RENEWABLE = ["wind", "solar_pv", "solar_thermal", "hydro", "renewable_thermal"];
// Output of one technology (MW, never below zero). Hydro is REE's real-time
// hydro plus pumping consumption, i.e. output before pumping (REE's own
// figure is net of pumping); before Dec 2024 there is no pumping series and
// REE's figure is used. Before June 2015 there is no solar or cogeneration
// split, so the totals stand in.
export function fuelValue(r, f) {
  let v = r[f];
  if (f === "hydro" && v != null && r.pump_load != null) v = v - r.pump_load;
  if (v == null && f === "solar_pv") v = r.solar;
  if (v == null && f === "chp_other") v = r.other;
  return v == null ? null : Math.max(0, v);
}
// Pumping consumption (MW, zero or negative), or null before Dec 2024.
export function pumpValue(r) {
  return r.pump_load == null ? null : Math.min(0, r.pump_load);
}
export function totalGen(r) {
  return FUELS.reduce((a, f) => a + (fuelValue(r, f.value) || 0), 0);
}
export const getMixDaily = () => daily("mix");
export function getMixRaw(from, to) {
  return cached("es-mix-" + from + "-" + to, () => monthly("data/es/mix", from, to, MIX_COLS));
}

// ---------- Demand ----------

export const getDemandDaily = () => daily("demand");
export function getDemandRaw(from, to) {
  return cached("es-demand-" + from + "-" + to, () => monthly("data/es/demand", from, to, ["actual", "forecast"]));
}

// ---------- Prices ----------

export const ZONES = {
  ES: { name: "Spain", adj: "Spanish", colour: "--z-es" },
  FR: { name: "France", adj: "French", colour: "--z-fr" },
  PT: { name: "Portugal", adj: "Portuguese", colour: "--z-pt" }
};
// Daily prices (Z_base, Z_peak ...) joined with the market summaries
// (cap_T, gen_T, res_mean, par_FR, par_PT) by date.
export function getPricesDaily() {
  return cached("es-daily-prices-market", async () => {
    const [p, m] = await Promise.all([daily("prices"), daily("market")]);
    const rows = p.rows.map(r => ({ ...(m.byDate.get(r.date) || {}), ...r }));
    return table(rows);
  });
}
// Day-ahead prices for ES, FR or PT: list of {t, eur, min}.
export function getPriceRaw(zone, from, to) {
  return getPrices(zone, from, to);
}
// One row per hour from data/es/hourly/YYYY.csv between two dates.
export function getHourly(from, to) {
  return cached("es-hourly-" + from + "-" + to, async () => {
    const years = [];
    for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) years.push(y);
    const lo = parisMidnight(from);
    const hi = parisMidnight(addDays(to, 1));
    const parts = await Promise.all(years.map(y => cached("es-hourly-year-" + y, async () =>
      toObjects(await fetchText("data/es/hourly/" + y + ".csv", { optional: true }).catch(() => ""), "t"))));
    return parts.flat().filter(r => r.t >= lo && r.t < hi);
  });
}

// ---------- Flows (Spain's point of view: export = power leaving Spain) ----------

export const getFlowsDaily = () => daily("flows");
function toQuarterMap(points, col) {
  const out = new Map();
  for (const p of points) {
    if (p[col] == null) continue;
    for (let k = 0; k < Math.max(1, p.min / 15); k++) out.set(p.t + mul(k, QUARTER), p[col]);
  }
  return out;
}
// Physical flows by border every 15 minutes: list of {t, min, fr_exp, fr_imp, pt_exp, pt_imp, fr_net, pt_net, net}.
export function getFlowsRaw(from, to) {
  return cached("es-flows-" + from + "-" + to, async () => {
    // France-Spain is stored from France's side (export = France to Spain).
    const both = await Promise.all([getFlows("ES", from, to), monthly("data/es/flows/PT", from, to, ["export_mw", "import_mw"])]);
    const fr = both.at(0);
    const pt = both.at(1);
    const frExp = toQuarterMap(fr, "import_mw");
    const frImp = toQuarterMap(fr, "export_mw");
    const ptExp = toQuarterMap(pt, "export_mw");
    const ptImp = toQuarterMap(pt, "import_mw");
    const times = [...new Set([...frExp.keys(), ...ptExp.keys()])].sort((a, b) => a - b);
    return times.map(t => {
      const r = { t, min: 15, fr_exp: frExp.get(t) ?? null, fr_imp: frImp.get(t) ?? null, pt_exp: ptExp.get(t) ?? null, pt_imp: ptImp.get(t) ?? null };
      r.fr_net = r.fr_exp == null ? null : r.fr_exp - (r.fr_imp || 0);
      r.pt_net = r.pt_exp == null ? null : r.pt_exp - (r.pt_imp || 0);
      r.net = r.fr_net == null || r.pt_net == null ? null : r.fr_net + r.pt_net;
      return r;
    });
  });
}

// ---------- Alerts for the bell ----------

export async function getEsAlerts() {
  try {
    const text = await fetchText("data/es/alerts.json", { optional: true });
    return text ? JSON.parse(text).alerts || [] : [];
  } catch (error) {
    return [];
  }
}

// ---------- Freshness line under the tabs ----------

export async function freshness(page) {
  const today = todayParis();
  const lastOf = (rows, col) => { for (let i = rows.length - 1; i >= 0; i--) { const r = rows.at(i); if (r[col] != null) return r.t; } return null; };
  const parts = [];
  try {
    if (page === "demand" || page === "overview") {
      const t = lastOf(await getDemandRaw(addDays(today, -1), today), "actual");
      if (t) parts.push("Demand to " + fmtTime(t + QUARTER));
    }
    if (page === "prices" || page === "overview") {
      const rows = await getPriceRaw("ES", today, addDays(today, 1));
      const t = rows.length ? rows.at(-1).t : null;
      if (t) parts.push("prices to " + fmtLongDate(dateKey(t)).replace(/ \d{4}$/, ""));
    }
    if (page === "generation" || page === "overview" || page === "prices") {
      const t = lastOf(await getMixRaw(addDays(today, -1), today), "wind");
      if (t) parts.push("mix to " + fmtTime(t + QUARTER));
    }
    if (page === "flows") {
      const t = lastOf(await getFlowsRaw(addDays(today, -1), today), "net");
      if (t) parts.push("flows to " + fmtTime(t + QUARTER));
    }
  } catch (error) { console.error(error); }
  const text = parts.join(" · ");
  return text ? text.at(0).toUpperCase() + text.slice(1) : "";
}
