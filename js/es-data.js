// Spain data: loaders for the files written by scripts/es_store.py and
// scripts/es_prices.py. Until Spain's history has been downloaded (no
// data/es/coverage.json yet), sample data is generated instead, so the pages
// can be tried out; a "Sample data" label shows wherever it is used.
// Add ?mock=1 before the # in the address to force sample data, ?mock=0 to
// force real data.
// Code note: no asterisks here (chat formatting strips them when pasted), so
// multiplication is written with mul().
import { cached, fetchText, parseUtc } from "./data.js";
import { getFlows, getPrices } from "./market-data.js";
import { DAY, HOUR, QUARTER, addDays, dateKey, fmtLongDate, fmtTime, parisMidnight, toWall, todayParis } from "./util.js";

export const ES_FIRST = "2015-01-01";
export const REE = "REE (Spanish TSO) via ESIOS";
export const ENTSOE = "ENTSO-E Transparency Platform";
export const mul = (a, b) => a / (1 / b);

// ---------- Sample-data switch ----------

let mock = null;
export async function isMock() {
  if (mock !== null) return mock;
  const q = new URLSearchParams(location.search).get("mock");
  if (q === "1" || q === "0") { mock = q === "1"; return mock; }
  const cov = await fetchText("data/es/coverage.json", { optional: true }).catch(() => "");
  mock = !cov;
  return mock;
}
export const usingMock = () => mock === true;

// ---------- Reading CSV files ----------

const num = s => (s === "" || s == null ? null : Number(s));
function parse(text) {
  const lines = (text || "").trim().split("\n");
  if (!lines[0]) return { header: [], rows: [] };
  return { header: lines[0].split(","), rows: lines.slice(1).map(l => l.split(",")) };
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
    const p = parse(text);
    const idx = {};
    p.header.forEach((h, i) => { idx[h] = i; });
    for (const r of p.rows) {
      const t = parseUtc(r[0]);
      if (t < lo || t >= hi) continue;
      const rec = { t, min: idx.min != null ? Number(r[idx.min]) || 15 : 15 };
      for (const c of cols) rec[c] = idx[c] != null ? num(r[idx[c]]) : null;
      out.push(rec);
    }
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}
function table(rows) {
  return { rows, byDate: new Map(rows.map(r => [r.date, r])) };
}
function daily(name, sample) {
  return cached("es-daily-" + name, async () => {
    if (await isMock()) return table(sample());
    const p = parse(await fetchText("data/es/daily/" + name + ".csv", { optional: true }));
    return table(p.rows.map(r => {
      const o = { date: r[0] };
      for (let i = 1; i < p.header.length; i++) o[p.header[i]] = num(r[i]);
      return o;
    }));
  });
}

// ---------- Columns ----------

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
// Older data has no solar split or cogeneration split: fall back to the totals.
export function fuelValue(r, f) {
  let v = r[f];
  if (v == null && f === "solar_pv") v = r.solar;
  if (v == null && f === "chp_other") v = r.other;
  return v == null ? null : Math.max(0, v);
}
export function totalGen(r) {
  return FUELS.reduce((a, f) => a + (fuelValue(r, f.value) || 0), 0);
}

// ---------- Sample data ----------
// Smooth, repeatable shapes: seasonal swings, a daily profile, weekends and
// day-to-day noise, so every chart and comparison has something to show.

const rnd = s => { const x = mul(Math.sin(s), 43758.5453); return x - Math.floor(x); };
const dayNo = d => Math.round((Date.parse(d + "T12:00:00Z") - Date.parse("2015-01-01T12:00:00Z")) / DAY);
const sinPi = x => Math.sin(mul(Math.PI, x));
function dayInfo(d) {
  const n = dayNo(d);
  const doy = (Date.parse(d + "T12:00:00Z") - Date.parse(d.slice(0, 4) + "-01-01T12:00:00Z")) / DAY;
  const winter = Math.cos(mul(2, mul(Math.PI, (doy - 15) / 365)));
  const summer = (1 - winter) / 2;
  const wd = (new Date(d + "T12:00:00Z").getUTCDay() + 6) % 7;
  return {
    n, winter, summer, weekend: wd >= 5,
    windDay: rnd(n + 0.17), cloud: rnd(n + 0.41), gas: 0.8 + mul(0.6, rnd(Math.floor(n / 30) + 0.9)),
    nucOut: rnd(n + 0.73) < 0.25 ? 1 : 0, trend: n / 4000
  };
}
const infoCache = new Map();
const info = d => { if (!infoCache.has(d)) infoCache.set(d, dayInfo(d)); return infoCache.get(d); };

function sample(t) {
  const d = dateKey(t);
  const w = new Date(toWall(t));
  const h = w.getUTCHours() + w.getUTCMinutes() / 60;
  const I = info(d);
  const noise = rnd(t / 900000 + 0.5) - 0.5;
  const shape = sinPi(Math.max(0, Math.min(1, (h - 5) / 19)));
  const demand = 27000 + mul(3500, I.winter) - (I.weekend ? 3500 : 0) + mul(5000, shape - 0.55) + mul(400, noise);
  const solarCap = 8000 + mul(14000, I.summer) + mul(4000, I.trend);
  const pv = h > 7 && h < 20 ? mul(mul(solarCap, sinPi((h - 7) / 13)), 1 - mul(0.6, I.cloud)) : 0;
  const st = mul(pv, 0.04);
  const wind = Math.max(500, mul(16000, I.windDay) + mul(1500, Math.sin(h / 3 + I.n)) + 1500);
  const nuclear = 7100 - mul(1000, I.nucOut);
  const hydro = 2500 + mul(2000, I.winter) + mul(1500, shape);
  const other = 1700;
  const ccgt = Math.max(1200, demand - pv - st - wind - nuclear - hydro - other + 800);
  const esPrice = Math.max(-2, mul(55 + mul(25, I.gas) + mul(15, I.winter), 1) + mul(30, Math.sin(mul(Math.PI, (h - 8) / 12))) - mul(pv, 0.004) - mul(wind, 0.002) + mul(8, noise));
  const frPrice = esPrice + 8 + mul(15, I.winter) + mul(10, rnd(I.n + 2.2) - 0.3);
  const ptPrice = rnd(I.n + 3.3) < 0.9 ? esPrice : esPrice + 4;
  const frNet = mul(2200, Math.sin(h / 4 + I.n)) - mul(900, I.winter);
  const ptNet = 600 + mul(1200, rnd(I.n + 5.5) - 0.4);
  return {
    actual: demand, forecast: demand + mul(500, rnd(t / 3600000 + 0.2) - 0.5),
    nuclear, wind, solar_pv: pv, solar_thermal: st, solar: pv + st, hydro, hydro_gen: hydro, ccgt,
    chp_other: 1100, renewable_thermal: 450, other: 1550 + st, coal: mul(150, I.winter), fuel_gas: 0,
    exchanges: -(frNet + ptNet), balearic_link: -60, pump_load: -mul(900, pv / Math.max(1, solarCap)), pump_gen: mul(600, shape),
    ES: esPrice, FR: frPrice, PT: ptPrice,
    fr_exp: Math.max(0, frNet), fr_imp: Math.max(0, -frNet), pt_exp: Math.max(0, ptNet), pt_imp: Math.max(0, -ptNet)
  };
}
// Which sample values exist at time t: demand, mix and flows up to now;
// the forecast two days ahead; prices to the end of tomorrow after 13:00.
function horizon(kind) {
  const now = Date.now();
  if (kind === "forecast") return parisMidnight(addDays(todayParis(), 2));
  if (kind === "price") {
    const h = new Date(toWall(now)).getUTCHours();
    return parisMidnight(addDays(todayParis(), h >= 13 ? 2 : 1));
  }
  return now - (now % QUARTER) - QUARTER;
}
function sampleRaw(from, to, pick) {
  const out = [];
  const hi = parisMidnight(addDays(to, 1));
  for (let t = parisMidnight(from); t < hi; t += QUARTER) {
    const rec = pick(t, sample(t));
    if (rec) out.push(rec);
  }
  return out;
}
const hourCache = new Map();
function hoursOf(d) {
  if (!hourCache.has(d)) {
    const hrs = [];
    const end = parisMidnight(addDays(d, 1));
    for (let t = parisMidnight(d); t < end; t += HOUR) hrs.push({ t, v: sample(t) });
    hourCache.set(d, hrs);
  }
  return hourCache.get(d);
}
function sampleDaily(build) {
  const out = [];
  const last = addDays(todayParis(), 1);
  for (let d = ES_FIRST; d <= last; d = addDays(d, 1)) {
    const row = build(d, hoursOf(d));
    if (row) out.push(row);
  }
  return out;
}
const avg = (hrs, f) => hrs.reduce((a, x) => a + f(x), 0) / hrs.length;

// ---------- Demand ----------

export const getDemandDaily = () => daily("demand", () => sampleDaily((d, hrs) => {
  const now = Date.now();
  const real = hrs.filter(x => x.t < now);
  const row = { date: d, forecast_mean: Math.round(avg(hrs, x => x.v.forecast)) };
  if (real.length >= 20) {
    const vs = real.map(x => x.v.actual);
    row.mean = Math.round(avg(real, x => x.v.actual));
    row.peak = Math.round(Math.max(...vs));
    row.minimum = Math.round(Math.min(...vs));
    row.energy_gwh = Math.round(row.mean / 100 / (1 / real.length)) / 10;
    row.hours = real.length;
  }
  return row;
}));

export function getDemandRaw(from, to) {
  return cached("es-demand-" + from + "-" + to, async () => {
    if (await isMock()) {
      const now = horizon("actual");
      const fh = horizon("forecast");
      return sampleRaw(from, to, (t, v) => (t >= fh ? null : { t, min: 15, actual: t <= now ? v.actual : null, forecast: v.forecast }));
    }
    return monthly("data/es/demand", from, to, ["actual", "forecast"]);
  });
}

// ---------- Generation ----------

export const getMixDaily = () => daily("mix", () => sampleDaily((d, hrs) => {
  const real = hrs.filter(x => x.t < Date.now());
  if (real.length < 20) return null;
  const row = { date: d };
  for (const c of MIX_COLS) row[c] = Math.round(avg(real, x => x.v[c]));
  return row;
}));

export function getMixRaw(from, to) {
  return cached("es-mix-" + from + "-" + to, async () => {
    if (await isMock()) {
      const now = horizon("actual");
      return sampleRaw(from, to, (t, v) => {
        if (t > now) return null;
        const r = { t, min: 15 };
        for (const c of MIX_COLS) r[c] = v[c];
        return r;
      });
    }
    return monthly("data/es/mix", from, to, MIX_COLS);
  });
}

// ---------- Prices ----------

export const ZONES = {
  ES: { name: "Spain", short: "ES", colour: "--z-es" },
  FR: { name: "France", short: "FR", colour: "--z-fr" },
  PT: { name: "Portugal", short: "PT", colour: "--z-pt" }
};

export const getPricesDaily = () => daily("prices", () => sampleDaily((d, hrs) => {
  const ph = horizon("price");
  const ok = hrs.filter(x => x.t < ph);
  if (ok.length < 20) return null;
  const row = { date: d };
  for (const z of Object.keys(ZONES)) {
    const vs = ok.map(x => x.v[z]);
    const peak = ok.filter(x => { const w = new Date(toWall(x.t)); const wd = (w.getUTCDay() + 6) % 7; return wd < 5 && w.getUTCHours() >= 8 && w.getUTCHours() < 20; });
    const off = ok.filter(x => !peak.includes(x));
    const base = avg(ok, x => x.v[z]);
    row[z + "_base"] = base;
    row[z + "_peak"] = peak.length ? avg(peak, x => x.v[z]) : null;
    row[z + "_off"] = avg(off, x => x.v[z]);
    row[z + "_min"] = Math.min(...vs);
    row[z + "_max"] = Math.max(...vs);
    row[z + "_std"] = Math.sqrt(avg(ok, x => mul(x.v[z] - base, x.v[z] - base)));
    row[z + "_neg"] = vs.filter(v => v < 0).length;
    row[z + "_zero"] = 0;
    row[z + "_negd"] = vs.filter(v => v < 0).reduce((a, v) => a - v, 0);
  }
  return row;
}));

// Day-ahead prices for ES, FR or PT: list of {t, eur, min}.
export function getPriceRaw(zone, from, to) {
  return cached("es-price-" + zone + "-" + from + "-" + to, async () => {
    if (await isMock()) {
      const ph = horizon("price");
      return sampleRaw(from, to, (t, v) => (t >= ph ? null : { t, min: 15, eur: Math.round(mul(v[zone], 100)) / 100 }));
    }
    return getPrices(zone, from, to);
  });
}

// ---------- Flows (Spain's point of view: export = power leaving Spain) ----------

export const getFlowsDaily = () => daily("flows", () => sampleDaily((d, hrs) => {
  const real = hrs.filter(x => x.t < Date.now());
  if (real.length < 20) return null;
  const row = { date: d };
  for (const c of ["fr_exp", "fr_imp", "pt_exp", "pt_imp"]) row[c] = Math.round(avg(real, x => x.v[c]));
  row.fr_net = row.fr_exp - row.fr_imp;
  row.pt_net = row.pt_exp - row.pt_imp;
  row.net = row.fr_net + row.pt_net;
  return row;
}));

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
    if (await isMock()) {
      const now = horizon("actual");
      return sampleRaw(from, to, (t, v) => (t > now ? null : {
        t, min: 15, fr_exp: v.fr_exp, fr_imp: v.fr_imp, pt_exp: v.pt_exp, pt_imp: v.pt_imp,
        fr_net: v.fr_exp - v.fr_imp, pt_net: v.pt_exp - v.pt_imp, net: v.fr_exp - v.fr_imp + v.pt_exp - v.pt_imp
      }));
    }
    // France-Spain is stored from France's side (export = France to Spain).
    const [fr, pt] = await Promise.all([getFlows("ES", from, to), monthly("data/es/flows/PT", from, to, ["export_mw", "import_mw"])]);
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

// ---------- Freshness line under the tabs ----------

export async function freshness(page) {
  const today = todayParis();
  const lastOf = (rows, col) => { for (let i = rows.length - 1; i >= 0; i--) { const r = rows[i]; if (r[col] != null) return r.t; } return null; };
  const parts = [];
  try {
    if (page === "demand" || page === "overview") {
      const t = lastOf(await getDemandRaw(addDays(today, -1), today), "actual");
      if (t) parts.push("Demand to " + fmtTime(t + QUARTER));
    }
    if (page === "prices" || page === "overview") {
      const rows = await getPriceRaw("ES", today, addDays(today, 1));
      const t = rows.length ? rows[rows.length - 1].t : null;
      if (t) parts.push("prices to " + fmtLongDate(dateKey(t)).replace(/ \d{4}$/, ""));
    }
    if (page === "generation" || page === "overview") {
      const t = lastOf(await getMixRaw(addDays(today, -1), today), "wind");
      if (t) parts.push("mix to " + fmtTime(t + QUARTER));
    }
    if (page === "flows") {
      const t = lastOf(await getFlowsRaw(addDays(today, -1), today), "net");
      if (t) parts.push("flows to " + fmtTime(t + QUARTER));
    }
  } catch (error) { console.error(error); }
  const text = parts.join(" · ");
  return text ? text[0].toUpperCase() + text.slice(1) : "";
}
