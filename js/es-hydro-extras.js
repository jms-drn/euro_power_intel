// Spain Hydro: the Reserves map tab with its weekly extras: the week's
// biggest reservoir moves, river flows against normal and rainfall so far
// this year against earlier years (MITECO's weekly hydrological bulletin).
// Extends the map tab in es-hydro-map.js; everything follows the basin
// selected on the map and the 5- or 10-year average chosen above it.
// Code note: no asterisks here (chat formatting strips them when pasted).
import { ChartPanel } from "./chart.js";
import { cached, fetchText } from "./data.js";
import { addDays, fmtDate, fmtLongDate, fmtNumber, parisMidnight } from "./util.js";
import { MITECO } from "./es-data.js";
import { meanOf, mul, signed } from "./es-common.js";
import { near, shiftDate, yearsBack } from "./es-hydro.js";
import { EsHydroMap } from "./es-hydro-map.js";
import { getReservoirPoints } from "./es-hydro-map-data.js";

const key = s => String(s || "").normalize("NFD").toLowerCase().replace(/[^a-z]/g, "");
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
function loadCsv(name, numeric) {
  return cached("es-csv-" + name, async () => {
    const lines = (await fetchText("data/es/" + name + ".csv", { optional: true }).catch(() => "")).trim().split(/\r?\n/);
    const head = splitCsv(lines.at(0) || "");
    return lines.slice(1).filter(Boolean).map(line => {
      const v = splitCsv(line);
      const o = {};
      head.forEach((h, i) => { const x = v.at(i); o[h] = numeric.includes(h) ? (x === "" || x == null ? null : Number(x)) : x; });
      return o;
    });
  });
}
const pctOf = (v, ref) => (v == null || !ref ? null : mul(v, 100) / ref);
const pctTxt = v => (v == null ? "–" : fmtNumber(v, 0) + "%");

export class EsHydroMapFull extends EsHydroMap {
  constructor(root) {
    super(root);
    const box = document.createElement("div");
    box.innerHTML = `
      <article class="panel"><div class="panel-head"><div><h2 data-mv-title>The week's biggest moves</h2><p class="muted">Reservoirs of 20 hm³ or more · change since the previous bulletin</p></div></div>
        <div class="table-scroll flat" data-movers></div></article>
      <div data-flow-chart></div>
      <article class="panel"><div class="panel-head"><div><h2 data-fl-title>River flows</h2><p class="muted" data-fl-sub></p></div></div>
        <div class="table-scroll flat" data-flows></div></article>
      <div data-rain-chart></div>
      <article class="panel"><div class="panel-head"><div><h2>Rainfall by area</h2><p class="muted" data-rn-sub></p></div></div>
        <div class="table-scroll flat" data-rain></div></article>`;
    root.appendChild(box);
    this.flowPanel = new ChartPanel(root.querySelector("[data-flow-chart]"), { title: "River flows", size: "short", source: MITECO });
    this.rainPanel = new ChartPanel(root.querySelector("[data-rain-chart]"), { title: "Rainfall", size: "short", source: "MITECO (AEMET data)" });
    this.panels.push(this.flowPanel, this.rainPanel);
  }

  async render(id) {
    await super.render(id);
    if (id !== this.renderId) return;
    const got = await Promise.all([getReservoirPoints(), loadCsv("river_flows", ["flow"]), loadCsv("rain", ["mm"])]);
    if (id !== this.renderId) return;
    const sel = this.state.basin || "all";
    const N = this.state.avg === "10" ? 10 : 5;
    this.renderMovers(got.at(0), sel);
    this.renderFlows(got.at(1), sel, N);
    this.renderRain(got.at(2), N);
  }

  renderMovers(points, sel) {
    const rows = points.filter(p => p.cap >= 20 && p.dw != null && (sel === "all" || p.key === sel))
      .map(p => ({ ...p, pp: mul(p.dw, 100) / p.cap, fill: mul(p.water || 0, 100) / p.cap }));
    const up = rows.filter(p => p.dw > 0).sort((a, b) => b.dw - a.dw).slice(0, 5);
    const down = rows.filter(p => p.dw < 0).sort((a, b) => a.dw - b.dw).slice(0, 5);
    const line = p => `<tr><td class="text">${p.name}</td><td class="text">${p.basin}</td><td>${signed(p.dw, x => fmtNumber(x, 0))}</td><td>${signed(p.pp, x => fmtNumber(x, 1))}</td><td>${fmtNumber(p.fill, 0)}%</td><td>${fmtNumber(p.cap, 0)}</td></tr>`;
    const head = label => `<tr><th class="text" colspan="6">${label}</th></tr>`;
    const date = rows.find(p => p.date)?.date;
    this.root.querySelector("[data-mv-title]").textContent = `The week's biggest moves${sel === "all" ? "" : ", " + (rows.at(0)?.basin || "")}${date ? ", " + fmtLongDate(date) : ""}`;
    this.root.querySelector("[data-movers]").innerHTML = rows.length ? `<table><thead><tr><th>Reservoir</th><th>Basin</th><th>Change (hm³)</th><th>Change (points)</th><th>Now full</th><th>Capacity (hm³)</th></tr></thead><tbody>
      ${head("Biggest rises")}${up.length ? up.map(line).join("") : `<tr><td class="text" colspan="6">No rises this week</td></tr>`}
      ${head("Biggest falls")}${down.length ? down.map(line).join("") : `<tr><td class="text" colspan="6">No falls this week</td></tr>`}</tbody></table>`
      : `<p class="muted">No reservoir changes in the latest bulletin.</p>`;
  }

  renderFlows(rows, sel, N) {
    if (!rows.length) { this.root.querySelector("[data-flows]").innerHTML = `<p class="muted">River flows appear after the Spain hydro detail backfill.</p>`; return; }
    const st = new Map();
    for (const r of rows) {
      if (r.flow == null) continue;
      if (!st.has(r.station_id)) st.set(r.station_id, { id: r.station_id, name: r.station, river: r.river, basin: r.basin, key: key(r.basin), vals: new Map() });
      st.get(r.station_id).vals.set(r.date, r.flow);
    }
    const last = rows.reduce((m, r) => (r.date > m ? r.date : m), "");
    const K = yearsBack(N);
    const prevD = [...new Set(rows.map(r => r.date))].filter(d => d < last).sort().at(-1);
    const view = [...st.values()].map(s => {
      const v = s.vals.get(last) ?? null;
      const past = K.map(k => near(s.vals, shiftDate(last, -k))).filter(x => x != null);
      const avg = past.length >= 2 ? meanOf(past) : null;
      const all = [...s.vals.values()];
      return { ...s, v, avg, ly: near(s.vals, shiftDate(last, -1)), week: prevD && s.vals.get(prevD) != null && v != null ? v - s.vals.get(prevD) : null, pct: pctOf(v, avg), size: meanOf(all) };
    }).filter(s => s.v != null);
    const byBasin = new Map();
    for (const s of view) {
      if (s.pct == null) continue;
      if (!byBasin.has(s.basin)) byBasin.set(s.basin, []);
      byBasin.get(s.basin).push(s.pct);
    }
    const basins = [...byBasin.keys()].map(b => ({ b, pct: meanOf(byBasin.get(b)), n: byBasin.get(b).length })).sort((a, b) => a.pct - b.pct);
    this.flowPanel.setTitle(`River flows against normal, ${fmtLongDate(last)}`, `% of the ${N}-year average for the same week, average of each basin's gauging stations`);
    this.flowPanel.render({
      xType: "category", categories: basins.map(x => x.b), xLabel: x => x, xHeader: "Basin", yName: "%", yMin: 0, source: MITECO,
      series: [
        { name: "Normal (100%)", colour: "--s-avg", type: "line", dashed: true, width: 1.2, unit: "%", decimals: 0, avg: false, data: basins.map((x, i) => [i, 100]) },
        { name: "Flow, % of normal", colour: "--s-actual", type: "bar", barWidth: 14, unit: "%", decimals: 0, avg: false, data: basins.map((x, i) => [i, x.pct]) }
      ],
      notes: ["MITECO's weekly bulletin reports the flow at about 120 gauging stations, many below dams, so flows partly reflect reservoir releases as well as rain. Normal is the average of the same week in each of the years before."]
    });
    const shown = view.filter(s => sel === "all" || s.key === sel).sort((a, b) => b.size - a.size).slice(0, sel === "all" ? 15 : 12);
    this.root.querySelector("[data-fl-title]").textContent = sel === "all" ? "River flows: the largest rivers" : "River flows: stations in this basin";
    this.root.querySelector("[data-fl-sub]").textContent = `${fmtLongDate(last)} · m³/s against the same week in the ${N} years before and last year`;
    this.root.querySelector("[data-flows]").innerHTML = shown.length ? `<table><thead><tr><th>Station</th><th>River</th><th>Basin</th><th>Flow (m³/s)</th><th>% of normal</th><th>Last year</th><th>Week change</th></tr></thead><tbody>
      ${shown.map(s => `<tr><td class="text">${s.name}</td><td class="text">${s.river || ""}</td><td class="text">${s.basin}</td><td>${fmtNumber(s.v, 1)}</td><td>${pctTxt(s.pct)}</td><td>${fmtNumber(s.ly, 1)}</td><td>${signed(s.week, x => fmtNumber(x, 1))}</td></tr>`).join("")}</tbody></table>`
      : `<p class="muted">No gauging stations reported in this basin in the latest bulletin.</p>`;
  }

  renderRain(rows, N) {
    if (!rows.length) { this.root.querySelector("[data-rain]").innerHTML = `<p class="muted">Rainfall appears after the Spain hydro detail backfill.</p>`; return; }
    // Weekly national figure: the average of every station reporting that week.
    const week = new Map();
    for (const r of rows) {
      if (r.mm == null) continue;
      if (!week.has(r.date)) week.set(r.date, []);
      week.get(r.date).push(r.mm);
    }
    const dates = [...week.keys()].sort();
    const last = dates.at(-1);
    const year = Number(last.slice(0, 4));
    const cum = new Map();
    let acc = 0;
    let y0 = null;
    for (const d of dates) {
      const y = Number(d.slice(0, 4));
      if (y !== y0) { acc = 0; y0 = y; }
      acc += meanOf(week.get(d));
      cum.set(d, acc);
    }
    const K = yearsBack(N);
    const anchors = [];
    for (let d = dates.find(x => x.startsWith(String(year))) || last; d <= year + "-12-31"; d = addDays(d, 7)) anchors.push(d);
    const at = (d, k) => near(cum, shiftDate(d, -k));
    const nowV = cum.get(last);
    const avgNow = meanOf(K.map(k => at(last, k)));
    const lyNow = at(last, 1);
    this.rainPanel.setTitle(`Rainfall so far in ${year}`, `mm, cumulative from 1 January · average of MITECO's rain gauges · to ${fmtLongDate(last)}: ${fmtNumber(nowV, 0)} mm, ${pctTxt(pctOf(nowV, avgNow))} of the ${N}-year average`);
    this.rainPanel.render({
      xType: "time", xLabel: fmtDate, yName: "mm", yMin: 0, source: "MITECO (AEMET data)",
      series: [
        { name: `Range, ${N} years before`, colour: "--s-band", type: "band", unit: "mm", data: anchors.map(d => { const xs = K.map(k => at(d, k)).filter(v => v != null); return [parisMidnight(d), xs.length >= 2 ? Math.min(...xs) : null, xs.length >= 2 ? Math.max(...xs) : null]; }) },
        { name: `${N}-year average`, colour: "--s-avg", type: "line", dashed: true, width: 1.4, unit: "mm", decimals: 0, avg: false, data: anchors.map(d => [parisMidnight(d), meanOf(K.map(k => at(d, k)))]) },
        { name: "Last year", colour: "--s-ly", type: "line", width: 1.5, unit: "mm", decimals: 0, avg: false, data: anchors.map(d => [parisMidnight(d), at(d, 1)]) },
        { name: String(year), colour: "--s-actual", type: "line", width: 2.6, z: 20, unit: "mm", decimals: 0, avg: false, data: dates.filter(d => d.startsWith(String(year))).map(d => [parisMidnight(d), cum.get(d)]) }
      ],
      notes: [`Weekly rainfall at MITECO's ${new Set(rows.filter(r => r.date === last).map(r => r.station_id)).size} rain gauges (AEMET stations) in the latest bulletin, averaged across gauges and added up from 1 January. Last year ${fmtNumber(lyNow, 0)} mm to the same date.`]
    });
    // By area: each zone's stations, total so far this year against the same dates before.
    const zones = new Map();
    for (const r of rows) {
      if (r.mm == null) continue;
      if (!zones.has(r.zone)) zones.set(r.zone, new Map());
      const z = zones.get(r.zone);
      if (!z.has(r.station_id)) z.set(r.station_id, []);
      z.get(r.station_id).push([r.date, r.mm]);
    }
    const ytd = (list, y) => {
      const end = shiftDate(last, y - year);
      const xs = list.filter(p => p.at(0) >= y + "-01-01" && p.at(0) <= end);
      return xs.length ? xs.reduce((a, p) => a + p.at(1), 0) : null;
    };
    const table = [...zones.entries()].map(([zone, sts]) => {
      const lists = [...sts.values()];
      const now = meanOf(lists.map(l => ytd(l, year)));
      const avg = meanOf(K.map(k => meanOf(lists.map(l => ytd(l, year - k)))));
      const ly = meanOf(lists.map(l => ytd(l, year - 1)));
      const wk = meanOf(lists.map(l => l.find(p => p.at(0) === last)?.at(1) ?? null));
      return { zone, now, avg, ly, wk, pct: pctOf(now, avg), n: lists.length };
    }).filter(z => z.now != null).sort((a, b) => (a.pct ?? 999) - (b.pct ?? 999));
    this.root.querySelector("[data-rn-sub]").textContent = `1 January to ${fmtLongDate(last)} · mm, average of each area's gauges · driest against normal first`;
    this.root.querySelector("[data-rain]").innerHTML = `<table><thead><tr><th>Area</th><th>Gauges</th><th>So far this year (mm)</th><th>% of ${N}-year average</th><th>Last year (mm)</th><th>Latest week (mm)</th></tr></thead><tbody>
      ${table.map(z => `<tr><td class="text">${z.zone}</td><td>${z.n}</td><td>${fmtNumber(z.now, 0)}</td><td>${pctTxt(z.pct)}</td><td>${fmtNumber(z.ly, 0)}</td><td>${fmtNumber(z.wk, 1)}</td></tr>`).join("")}</tbody></table>`;
  }
}
