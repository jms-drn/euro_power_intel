// Spain Hydro Overview, the weekly extras under the map: the week's biggest
// reservoir moves, river flows against normal and rainfall (so far this year
// or week by week) against the seasonal norm. Everything follows the
// bulletin chosen on the slider, the basin selected on the map and the 5- or
// 10-year average chosen above it.
// Code note: no asterisks here (chat formatting strips them when pasted).
import { ChartPanel } from "./chart.js";
import { addDays, fmtDate, fmtLongDate, fmtNumber, parisMidnight } from "./util.js";
import { MITECO } from "./es-data.js";
import { meanOf, mul, signed } from "./es-common.js";
import { near, shiftDate, yearsBack } from "./es-hydro.js";
import { EsHydroMap } from "./es-hydro-map.js";
import { getReservoirPoints, keyOf, loadCsv } from "./es-hydro-map-data.js";

const AEMET = "MITECO (AEMET data)";
const pctOf = (v, ref) => (v == null || !ref ? null : mul(v, 100) / ref);
const pctTxt = v => (v == null ? "–" : fmtNumber(v, 0) + "%");
const onOrBefore = (dates, d) => dates.filter(x => x <= d).at(-1);

export class EsHydroMapFull extends EsHydroMap {
  constructor(root) {
    super(root);
    this.state.rview = "ytd";
    const box = document.createElement("div");
    box.innerHTML = `
      <article class="panel"><div class="panel-head"><div><h2 data-mv-title>The week's biggest moves</h2><p class="muted">Reservoirs of 20 hm³ or more · change since the previous bulletin</p></div></div>
        <div class="table-scroll flat" data-movers></div></article>
      <div data-flow-chart></div>
      <article class="panel"><div class="panel-head"><div><h2 data-fl-title>River flows</h2><p class="muted" data-fl-sub></p></div></div>
        <div class="table-scroll flat" data-flows></div></article>
      <div class="toolbar" style="margin-top:18px"><label class="field"><span>Rainfall</span><select data-rview>
        <option value="ytd">So far this year</option><option value="week">Week by week</option></select></label>
        <span class="muted small">The highlighted week follows the slider above the map.</span></div>
      <div data-rain-chart></div>
      <article class="panel"><div class="panel-head"><div><h2 data-rn-title>Rainfall by area</h2><p class="muted" data-rn-sub></p></div></div>
        <div class="table-scroll flat" data-rain></div></article>`;
    root.appendChild(box);
    root.querySelector("[data-rview]").addEventListener("change", e => { this.state.rview = e.target.value; this.update(); });
    this.flowPanel = new ChartPanel(root.querySelector("[data-flow-chart]"), { title: "River flows", size: "short", source: MITECO });
    this.rainPanel = new ChartPanel(root.querySelector("[data-rain-chart]"), { title: "Rainfall", size: "short", source: AEMET });
    this.panels.push(this.flowPanel, this.rainPanel);
  }

  async render(id) {
    await super.render(id);
    if (id !== this.renderId || !this.selDate) return;
    const got = await Promise.all([getReservoirPoints(), loadCsv("data/es/river_flows.csv", ["date", "station", "river", "basin"]), loadCsv("data/es/rain.csv", ["date", "station", "zone"])]);
    if (id !== this.renderId) return;
    const sel = this.state.basin || "all";
    const N = this.state.compare === "avg10" ? 10 : 5;
    this.root.querySelector("[data-rview]").value = this.state.rview;
    this.renderMovers(got.at(0), sel, this.selDate === this.dates.at(-1));
    this.renderFlows(got.at(1), sel, N);
    this.renderRain(got.at(2), N);
  }

  renderMovers(points, sel, isLatest) {
    if (!isLatest) {
      this.root.querySelector("[data-mv-title]").textContent = "The week's biggest moves";
      this.root.querySelector("[data-movers]").innerHTML = `<p class="muted">Reservoir-level detail is available for the latest bulletin only.</p>`;
      return;
    }
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
      if (!st.has(r.station_id)) st.set(r.station_id, { id: r.station_id, name: r.station, river: r.river, basin: r.basin, key: keyOf(r.basin), vals: new Map() });
      st.get(r.station_id).vals.set(r.date, r.flow);
    }
    const allDates = [...new Set(rows.map(r => r.date))].sort();
    const last = onOrBefore(allDates, addDays(this.selDate, 3));
    if (!last || last < addDays(this.selDate, -10)) {
      this.flowPanel.setTitle("River flows against normal", "MITECO's river-flow records start in 2001");
      this.flowPanel.render({ xType: "category", categories: [], xLabel: x => x, yName: "%", source: MITECO, series: [] });
      this.root.querySelector("[data-fl-sub]").textContent = "";
      this.root.querySelector("[data-flows]").innerHTML = `<p class="muted">No river-flow data for that bulletin.</p>`;
      return;
    }
    const prevD = allDates.filter(d => d < last).at(-1);
    const K = yearsBack(N);
    const view = [...st.values()].map(s => {
      const v = s.vals.get(last) ?? null;
      const past = K.map(k => near(s.vals, shiftDate(last, -k))).filter(x => x != null);
      const avg = past.length >= 2 ? meanOf(past) : null;
      return { ...s, v, avg, ly: near(s.vals, shiftDate(last, -1)), week: prevD && s.vals.get(prevD) != null && v != null ? v - s.vals.get(prevD) : null, pct: pctOf(v, avg), size: meanOf([...s.vals.values()]) };
    }).filter(s => s.v != null);
    const byBasin = new Map();
    for (const s of view) {
      if (s.pct == null) continue;
      if (!byBasin.has(s.basin)) byBasin.set(s.basin, []);
      byBasin.get(s.basin).push(s.pct);
    }
    const basins = [...byBasin.keys()].map(b => ({ b, pct: meanOf(byBasin.get(b)) })).sort((a, b) => a.pct - b.pct);
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
      : `<p class="muted">No gauging stations reported in this basin in that bulletin.</p>`;
  }

  renderRain(rows, N) {
    if (!rows.length) { this.root.querySelector("[data-rain]").innerHTML = `<p class="muted">Rainfall appears after the Spain hydro detail backfill.</p>`; return; }
    // National weekly figure: the average of every gauge reporting that week.
    const byWeek = new Map();
    for (const r of rows) {
      if (r.mm == null) continue;
      if (!byWeek.has(r.date)) byWeek.set(r.date, []);
      byWeek.get(r.date).push(r.mm);
    }
    const dates = [...byWeek.keys()].sort();
    const weekly = new Map(dates.map(d => [d, meanOf(byWeek.get(d))]));
    const selD = onOrBefore(dates, addDays(this.selDate, 3));
    if (!selD || selD < addDays(this.selDate, -10)) {
      this.rainPanel.setTitle("Rainfall", "MITECO's rainfall records start in 1995");
      this.rainPanel.render({ xType: "time", xLabel: fmtDate, yName: "mm", source: AEMET, series: [] });
      this.root.querySelector("[data-rn-sub]").textContent = "";
      this.root.querySelector("[data-rain]").innerHTML = `<p class="muted">No rainfall data for that bulletin.</p>`;
      return;
    }
    const year = Number(selD.slice(0, 4));
    const cum = new Map();
    let acc = 0;
    let y0 = null;
    for (const d of dates) {
      const y = Number(d.slice(0, 4));
      if (y !== y0) { acc = 0; y0 = y; }
      acc += weekly.get(d);
      cum.set(d, acc);
    }
    const K = yearsBack(N);
    const anchors = [];
    for (let d = dates.find(x => x.startsWith(String(year))) || selD; d <= year + "-12-31"; d = addDays(d, 7)) anchors.push(d);
    const normOf = (series, d) => meanOf(K.map(k => near(series, shiftDate(d, -k))));
    const rangeOf = (series, d) => { const xs = K.map(k => near(series, shiftDate(d, -k))).filter(v => v != null); return xs.length >= 2 ? [Math.min(...xs), Math.max(...xs)] : [null, null]; };
    const weekNow = weekly.get(selD);
    const weekNorm = normOf(weekly, selD);
    const ytdNow = cum.get(selD);
    const ytdNorm = normOf(cum, selD);
    const mark = [{ from: parisMidnight(addDays(selD, -6)), to: parisMidnight(addDays(selD, 1)), label: "Selected week", colour: "--today" }];
    const thisYear = dates.filter(d => d.startsWith(String(year)));
    const gauges = new Set(rows.filter(r => r.date === selD).map(r => r.station_id)).size;
    if (this.state.rview === "week") {
      this.rainPanel.setTitle(`Weekly rainfall, ${year}`, `mm, average of MITECO's rain gauges · week to ${fmtLongDate(selD)}: ${fmtNumber(weekNow, 1)} mm, ${pctTxt(pctOf(weekNow, weekNorm))} of the seasonal norm`);
      this.rainPanel.render({
        xType: "time", xLabel: fmtDate, yName: "mm", yMin: 0, source: AEMET, markAreas: mark,
        series: [
          { name: `Range, ${N} years before`, colour: "--s-band", type: "band", unit: "mm", data: anchors.map(d => [parisMidnight(d), ...rangeOf(weekly, d)]) },
          { name: `Seasonal norm (${N}-year average)`, colour: "--s-avg", type: "line", dashed: true, width: 1.4, unit: "mm", decimals: 1, avg: false, data: anchors.map(d => [parisMidnight(d), normOf(weekly, d)]) },
          { name: String(year), colour: "--s-actual", type: "bar", barWidth: 6, unit: "mm", decimals: 1, avg: false, data: thisYear.map(d => [parisMidnight(d), weekly.get(d)]) }
        ],
        notes: [`Weekly rainfall at MITECO's ${gauges} rain gauges (AEMET stations) in that bulletin, averaged across gauges. The seasonal norm is the average of the same week in each of the ${N} years before.`]
      });
    } else {
      this.rainPanel.setTitle(`Rainfall so far in ${year}`, `mm, cumulative from 1 January · to ${fmtLongDate(selD)}: ${fmtNumber(ytdNow, 0)} mm, ${pctTxt(pctOf(ytdNow, ytdNorm))} of the ${N}-year norm`);
      this.rainPanel.render({
        xType: "time", xLabel: fmtDate, yName: "mm", yMin: 0, source: AEMET, markAreas: mark,
        series: [
          { name: `Range, ${N} years before`, colour: "--s-band", type: "band", unit: "mm", data: anchors.map(d => [parisMidnight(d), ...rangeOf(cum, d)]) },
          { name: `${N}-year average`, colour: "--s-avg", type: "line", dashed: true, width: 1.4, unit: "mm", decimals: 0, avg: false, data: anchors.map(d => [parisMidnight(d), normOf(cum, d)]) },
          { name: "Last year", colour: "--s-ly", type: "line", width: 1.5, unit: "mm", decimals: 0, avg: false, data: anchors.map(d => [parisMidnight(d), near(cum, shiftDate(d, -1))]) },
          { name: String(year), colour: "--s-actual", type: "line", width: 2.6, z: 20, unit: "mm", decimals: 0, avg: false, data: thisYear.filter(d => d <= selD).map(d => [parisMidnight(d), cum.get(d)]) }
        ],
        notes: [`Weekly rainfall at MITECO's ${gauges} rain gauges (AEMET stations), averaged across gauges and added up from 1 January.`]
      });
    }

    // By area: each zone's gauges, the selected week and the year to it, against the norm.
    const zones = new Map();
    for (const r of rows) {
      if (r.mm == null) continue;
      if (!zones.has(r.zone)) zones.set(r.zone, new Map());
      const z = zones.get(r.zone);
      if (!z.has(r.station_id)) z.set(r.station_id, new Map());
      z.get(r.station_id).set(r.date, r.mm);
    }
    const ytd = (vals, y) => {
      const end = shiftDate(selD, y - year);
      let sum = 0;
      let n = 0;
      for (const [d, mm] of vals) if (d >= y + "-01-01" && d <= end) { sum += mm; n += 1; }
      return n ? sum : null;
    };
    const table = [...zones.entries()].map(([zone, sts]) => {
      const lists = [...sts.values()];
      const wk = meanOf(lists.map(l => l.get(selD) ?? null));
      const wkNorm = meanOf(K.map(k => meanOf(lists.map(l => near(l, shiftDate(selD, -k))))));
      const now = meanOf(lists.map(l => ytd(l, year)));
      const norm = meanOf(K.map(k => meanOf(lists.map(l => ytd(l, year - k)))));
      const ly = meanOf(lists.map(l => ytd(l, year - 1)));
      return { zone, n: lists.length, wk, wkPct: pctOf(wk, wkNorm), now, pct: pctOf(now, norm), ly };
    }).filter(z => z.now != null).sort((a, b) => (a.pct ?? 999) - (b.pct ?? 999));
    this.root.querySelector("[data-rn-title]").textContent = `Rainfall by area, week to ${fmtLongDate(selD)}`;
    this.root.querySelector("[data-rn-sub]").textContent = `mm, average of each area's gauges · against the ${N}-year norm · driest so far this year first`;
    this.root.querySelector("[data-rain]").innerHTML = `<table><thead><tr><th>Area</th><th>Gauges</th><th>Week (mm)</th><th>Week % of norm</th><th>Year to date (mm)</th><th>Year to date % of norm</th><th>Last year to date (mm)</th></tr></thead><tbody>
      <tr><td class="text"><b>Spain (all gauges)</b></td><td>${gauges}</td><td>${fmtNumber(weekNow, 1)}</td><td>${pctTxt(pctOf(weekNow, weekNorm))}</td><td>${fmtNumber(ytdNow, 0)}</td><td>${pctTxt(pctOf(ytdNow, ytdNorm))}</td><td>${fmtNumber(near(cum, shiftDate(selD, -1)), 0)}</td></tr>
      ${table.map(z => `<tr><td class="text">${z.zone}</td><td>${z.n}</td><td>${fmtNumber(z.wk, 1)}</td><td>${pctTxt(z.wkPct)}</td><td>${fmtNumber(z.now, 0)}</td><td>${pctTxt(z.pct)}</td><td>${fmtNumber(z.ly, 0)}</td></tr>`).join("")}</tbody></table>`;
  }
}
