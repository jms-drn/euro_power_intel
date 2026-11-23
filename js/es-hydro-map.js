// Spain Hydro: the Overview tab. A map of every basin shaded against the 5-
// or 10-year average, last year or last week, with a date slider back to
// 1988; cards for hydroelectric reserves, hydro output and inflow; a ranked
// basin list with sparklines; and the chosen basin's year below.
// Code note: no asterisks here (chat formatting strips them when pasted).
import { ChartPanel } from "./chart.js";
import { card } from "./market-common.js";
import { cssVar, fmtDate, fmtLongDate, fmtNumber, heroHtml, parisMidnight } from "./util.js";
import { MITECO, getMixDaily } from "./es-data.js";
import { Base, cards, headlineBlock, meanOf, mul, selectHtml, signed } from "./es-common.js";
import { near, shiftDate, yearsBack } from "./es-hydro.js";
import { AGAINST, COMPARE, MEASURES, basinView, fillColour, genStats, getBasins, getReservoirPoints, inflowSeries, loadBasinMap, pickDate, scaleFor, showOptions, sparkline, useLabel, valuesOf } from "./es-hydro-map-data.js";

const SPAIN = [[-9.6, 43.95], [3.45, 35.95]];
const pctOf = (v, ref) => (v == null || !ref ? null : mul(v - ref, 100) / ref);
const side = v => (v >= 0 ? "above" : "below");

export class EsHydroMap extends Base {
  constructor(root) {
    super(root, "hydro/overview", { measure: "wpct", compare: "avg5", show: "diff", res: "hydro", basin: "all", date: "" }, false);
    root.innerHTML = `
      ${heroHtml("Spain's hydro,", "at a glance.", "Reservoirs in every river basin from MITECO's weekly hydrological bulletin against the average of the five or ten years before, hydroelectric reserves, hydro output and inflow against normal. Slide back to any bulletin since 1988; click a basin to see its year.")}
      ${headlineBlock()}
      <div data-cards></div>
      <div class="map-layout">
        <div class="map-col">
          <div class="map-controls">
            <div class="segmented" role="group" aria-label="Measure">${Object.keys(MEASURES).map(k => `<button type="button" data-measure="${k}">${MEASURES[k].label}</button>`).join("")}</div>
            ${selectHtml("compare", "Compare with", Object.keys(COMPARE).map(k => [k, COMPARE[k]]))}
            ${selectHtml("show", "Show as", showOptions(MEASURES.wpct))}
            ${selectHtml("res", "Reservoirs", [["hydro", "Hydroelectric"], ["all", "All"], ["none", "Hide"]])}
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin:8px 0 2px">
            <button class="btn ghost small" type="button" data-step="-52" title="A year earlier">−1y</button>
            <button class="btn ghost small" type="button" data-step="-1" title="Previous bulletin">◀</button>
            <input type="range" data-slider min="0" max="0" value="0" style="flex:1" aria-label="Bulletin date">
            <button class="btn ghost small" type="button" data-step="1" title="Next bulletin">▶</button>
            <button class="btn ghost small" type="button" data-step="9999" title="Latest bulletin">Latest</button>
            <span data-slider-label class="muted small" style="min-width:92px;text-align:right"></span>
          </div>
          <div data-legend class="muted small" style="margin:4px 0 8px"></div>
          <div data-map></div>
        </div>
        <aside class="panel reactor-list">
          <div class="panel-head"><div><h2>Basins</h2><p data-list-sub></p></div></div>
          <div class="reactor-rows" data-list></div>
        </aside>
      </div>
      <div data-detail></div>
      <article class="panel"><div class="panel-head"><div><h2 data-top-title>Largest reservoirs</h2><p class="muted" data-top-sub>Latest bulletin · weekly change in hm³</p></div></div>
        <div class="table-scroll flat" data-top></div></article>`;
    this.wire();
    this.mapPanel = new ChartPanel(root.querySelector("[data-map]"), { title: "Basins", size: "map", table: true, source: MITECO });
    this.detailPanel = new ChartPanel(root.querySelector("[data-detail]"), { title: "Basin", size: "short", source: MITECO });
    this.panels = [this.mapPanel, this.detailPanel];
    root.querySelectorAll("[data-measure]").forEach(b => b.addEventListener("click", () => { this.state.measure = b.dataset.measure; this.update(); }));
    const slider = root.querySelector("[data-slider]");
    slider.addEventListener("input", () => { root.querySelector("[data-slider-label]").textContent = fmtLongDate(this.dates.at(Number(slider.value))); });
    slider.addEventListener("change", () => this.goTo(Number(slider.value)));
    root.querySelectorAll("[data-step]").forEach(b => b.addEventListener("click", () => this.goTo(Number(slider.value) + Number(b.dataset.step))));
  }

  goTo(i) {
    if (!this.dates) return;
    const j = Math.max(0, Math.min(this.dates.length - 1, i));
    this.state.date = j === this.dates.length - 1 ? "" : this.dates.at(j);
    this.update();
  }

  sync() {
    super.sync();
    this.root.querySelectorAll("[data-measure]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.measure === this.state.measure)));
  }

  select(key) {
    this.state.basin = key || "all";
    this.update();
  }

  async render(id) {
    const s = this.state;
    const got = await Promise.all([getBasins(), getReservoirPoints(), getMixDaily()]);
    if (id !== this.renderId) return;
    const data = got.at(0);
    const points = got.at(1);
    const mix = got.at(2);
    if (!data.dates.length) throw new Error("no basin data yet: run the Spain hydro detail backfill");
    await loadBasinMap(data.names);
    if (id !== this.renderId) return;
    this.dates = data.dates;
    if (!MEASURES[s.measure]) s.measure = "wpct";
    if (!COMPARE[s.compare]) s.compare = "avg5";
    const m = MEASURES[s.measure];
    const showSel = this.root.querySelector('[data-k="show"]');
    if (showSel) { showSel.innerHTML = showOptions(m).map(o => `<option value="${o.at(0)}">${o.at(1)}</option>`).join(""); showSel.value = s.show; }
    const date = pickDate(data.dates, s.date);
    const isLatest = date === data.dates.at(-1);
    this.selDate = date;
    const slider = this.root.querySelector("[data-slider]");
    slider.max = String(data.dates.length - 1);
    slider.value = String(data.dates.indexOf(date));
    this.root.querySelector("[data-slider-label]").textContent = fmtLongDate(date);
    const N = s.compare === "avg10" ? 10 : 5;
    const view = basinView(data, s.measure, s.compare, s.show, date);
    const scale = scaleFor(view.basins.map(b => b.s), s.show);
    const fmtV = v => (v == null ? "–" : fmtNumber(v, m.dec) + (m.unit === "%" ? "%" : " " + m.unit));
    const fmtD = v => signed(v, x => fmtNumber(x, m.dec) + " " + m.diff);
    const fmtP = v => signed(v, x => fmtNumber(x, 1) + "%");
    const fmtS = v => (s.show === "level" ? fmtV(v) : s.show === "pct" ? fmtP(v) : fmtD(v));
    const sel = data.byKey.has(s.basin) ? s.basin : "all";

    // Cards and the copy-ready summary: always on the same footing (energy % full, water % full, output).
    const ePct = valuesOf(data, "all", "epct");
    const wPct = valuesOf(data, "all", "wpct");
    const nAvg = (vals, n) => meanOf(yearsBack(n).map(k => near(vals, shiftDate(date, -k))));
    const e = { v: ePct.get(date), a5: nAvg(ePct, 5), a10: nAvg(ePct, 10), ly: near(ePct, shiftDate(date, -1)) };
    const w = { v: wPct.get(date), a5: nAvg(wPct, 5), a10: nAvg(wPct, 10) };
    const allRow = data.byKey.get("all").get(date) || {};
    const pp = (v, ref) => (v == null || ref == null ? "–" : signed(v - ref, x => fmtNumber(x, 1) + " pp"));
    const lastMix = [...mix.byDate.keys()].sort().filter(d => mix.byDate.get(d).hydro != null).at(-1);
    const asOf = lastMix && date >= "2015-01-08" ? (date < lastMix ? date : lastMix) : null;
    const g = asOf ? genStats(mix, asOf) : null;
    const flow = inflowSeries(data.byKey.get("all"), mix);
    const inNow = flow.get(date);
    const inNorm = meanOf(yearsBack(N).map(k => near(flow, shiftDate(date, -k))));
    const gw = v => (v == null ? "–" : fmtNumber(v / 1000, 2) + " GW");
    const vsNorm = b => `${b.n5 ? signed(pctOf(b.v, b.n5), x => fmtNumber(x, 0) + "%") + " vs 5-yr norm" : ""}${b.n10 ? " · " + signed(pctOf(b.v, b.n10), x => fmtNumber(x, 0) + "%") + " vs 10-yr" : ""}${b.ly ? " · last year " + gw(b.ly) : ""}`;
    const twh = b => (b.v == null ? null : mul(mul(b.v, b.days), 24) / 1000000);
    const below = view.basins.filter(b => b.d != null && b.d < 0).length;
    const withD = view.basins.filter(b => b.d != null).length;
    this.root.querySelector("[data-cards]").innerHTML = cards([
      card("Hydroelectric reserves", e.v == null ? "–" : fmtNumber(e.v, 1) + "% full", `${fmtNumber((allRow.energy || 0) / 1000, 2)} TWh · ${pp(e.v, e.a5)} vs 5-yr avg · ${pp(e.v, e.a10)} vs 10-yr · ${pp(e.v, e.ly)} vs last year`, " accent"),
      card("Hydro output, past 7 days", g ? gw(g.week.v) : "–", g ? vsNorm(g.week) : "REE data from 2015"),
      card("Hydro output, month to date", g ? gw(g.month.v) : "–", g ? vsNorm(g.month) : ""),
      card("Hydro output, year to date", g && g.year.v != null ? fmtNumber(twh(g.year), 2) + " TWh" : "–", g ? `${g.year.n5 ? signed(pctOf(g.year.v, g.year.n5), x => fmtNumber(x, 1) + "%") + " vs 5-yr norm" : ""}${g.year.n10 ? " · " + signed(pctOf(g.year.v, g.year.n10), x => fmtNumber(x, 1) + "%") + " vs 10-yr" : ""}${g.year.ly ? " · " + signed(pctOf(g.year.v, g.year.ly), x => fmtNumber(x, 1) + "%") + " on last year" : ""}` : ""),
      card("Estimated inflow, latest week", inNow == null ? "–" : fmtNumber(inNow, 0) + " GWh", inNorm ? `${N}-yr norm ${fmtNumber(inNorm, 0)} GWh (${fmtNumber(mul(inNow ?? 0, 100) / inNorm, 0)}%)` : "Output plus change in energy stored"),
      card(s.compare === "week" ? "Basins down on the week" : "Basins below " + AGAINST[s.compare], `${below} of ${withD}`, m.label)
    ]);
    const ranked = view.basins.filter(b => b.s != null).sort((a, b) => a.s - b.s);
    const wBasins = basinView(data, "wpct", "avg5", "diff", date).basins.filter(b => b.d != null).sort((a, b) => a.d - b.d);
    const listOf = xs => xs.map(b => `${b.name} (${signed(b.d, x => fmtNumber(x, 1) + " pp")})`).join(" and ");
    const parts = [`In MITECO's bulletin of ${fmtLongDate(date)}, Spain's hydroelectric reserves stood at ${fmtNumber((allRow.energy || 0) / 1000, 2)} TWh, ${fmtNumber(e.v, 1)}% full: ${e.a5 == null ? "" : fmtNumber(Math.abs(e.v - e.a5), 1) + " points " + side(e.v - e.a5) + " the 5-year average for the time of year"}${e.a10 == null ? "" : " and " + fmtNumber(Math.abs(e.v - e.a10), 1) + " points " + side(e.v - e.a10) + " the 10-year average"}.`];
    if (w.v != null && w.a5 != null) parts.push(`Reservoirs overall were ${fmtNumber(w.v, 1)}% full, ${fmtNumber(Math.abs(w.v - w.a5), 1)} points ${side(w.v - w.a5)} the 5-year average.`);
    if (g && g.week.v != null && g.week.n5) parts.push(`Hydro output averaged ${gw(g.week.v)} in the week to ${fmtLongDate(g.asOf)}, ${fmtNumber(Math.abs(pctOf(g.week.v, g.week.n5)), 0)}% ${side(g.week.v - g.week.n5)} the 5-year norm${g.year.v != null && g.year.n5 ? `, and ${fmtNumber(twh(g.year), 1)} TWh so far this year, ${fmtNumber(Math.abs(pctOf(g.year.v, g.year.n5)), 0)}% ${side(g.year.v - g.year.n5)} the norm` : ""}.`);
    if (wBasins.length >= 4) parts.push(`Furthest below normal: ${listOf(wBasins.slice(0, 2))}; furthest above: ${listOf(wBasins.slice(-2).reverse())}.`);
    this.headline.textContent = parts.join(" ");

    // Legend, map and list.
    const colour = b => scale.colour(b.s) || cssVar("--map-other");
    const lo = (scale.loCapped ? "≤ " : "") + fmtS(scale.lo);
    const hi = (scale.hiCapped ? "≥ " : "") + fmtS(scale.hi);
    const what = s.show === "level" ? m.label : `${m.label}, ${s.show === "pct" ? "% difference" : m.diff === "pp" ? "points" : m.diff + " difference"} against ${AGAINST[s.compare]}`;
    this.root.querySelector("[data-legend]").innerHTML = `<span style="display:inline-flex;align-items:center;gap:8px">${lo} <i style="display:inline-block;width:170px;height:8px;border-radius:4px;background:linear-gradient(90deg,${scale.stops.join(",")})"></i> ${hi}</span>
      <span style="margin-left:10px">${what}${scale.diverging ? " · each side scaled separately" : ""}${isLatest ? " · dots: reservoirs sized by capacity, shaded by % full" : " · reservoir dots show the latest bulletin only"}</span>`;
    const shown = !isLatest || s.res === "none" ? [] : points.filter(p => p.lon != null && p.cap && (s.res === "all" || p.hydro));
    const byName = new Map(view.basins.map(b => [b.name, b]));
    const tipBasin = b => `<div style="max-width:310px;white-space:normal"><div style="font-weight:700;font-size:13px">${b.name}</div>
      <div style="margin-top:4px">${m.label}: <b>${fmtV(b.v)}</b></div>
      <div>Against the 5-year average: <b>${b.avg5 == null ? "–" : fmtD(b.v - b.avg5)}</b> · 10-year: <b>${b.avg10 == null ? "–" : fmtD(b.v - b.avg10)}</b></div>
      <div>Against last year: <b>${b.ly == null ? "–" : fmtD(b.v - b.ly)}</b> · last week: <b>${b.week == null ? "–" : fmtD(b.v - b.week)}</b></div>
      <div>% against ${AGAINST[s.compare]}: <b>${fmtP(b.p)}</b></div>
      <div class="muted" style="margin-top:4px">${fmtNumber(b.row.water_hm3, 0)} of ${fmtNumber(b.row.cap_hm3, 0)} hm³ · ${b.row.energy_cap ? fmtNumber(b.row.energy, 0) + " of " + fmtNumber(b.row.energy_cap, 0) + " GWh hydroelectric" : "no hydroelectric energy"} · ${b.row.reservoirs || 0} reservoirs</div></div>`;
    const tipRes = p => `<div style="max-width:280px;white-space:normal"><div style="font-weight:700">${p.name}</div><div class="muted">${p.basin} · ${useLabel(p.use)}</div>
      <div style="margin-top:4px"><b>${fmtNumber(p.water, 0)}</b> of ${fmtNumber(p.cap, 0)} hm³ (${fmtNumber(mul(p.water || 0, 100) / p.cap, 0)}% full)</div>
      <div>Week: ${signed(p.dw, x => fmtNumber(x, 0) + " hm³")}${p.energy_cap ? ` · energy ${fmtNumber(p.energy, 0)} of ${fmtNumber(p.energy_cap, 0)} GWh` : ""}</div></div>`;
    const tip = p => (p.componentType === "geo" ? (byName.get(p.name) ? tipBasin(byName.get(p.name)) : p.name) : p.seriesName === "reservoirs" ? tipRes(shown.at(p.dataIndex)) : "");
    const selName = data.names.get(sel);
    const option = (t, { forExport }) => ({
      backgroundColor: "transparent", animation: false,
      tooltip: forExport ? undefined : { trigger: "item", confine: true, backgroundColor: t.tooltip, borderColor: t.border, padding: [9, 12], textStyle: { color: t.text, fontSize: 12 }, formatter: tip },
      geo: {
        map: "es-basins", roam: !forExport, scaleLimit: { min: 1, max: 8 }, boundingCoords: SPAIN,
        top: forExport ? 100 : 10, bottom: forExport ? 60 : 10, label: { show: false }, selectedMode: false,
        tooltip: { show: !forExport, formatter: tip },
        itemStyle: { areaColor: cssVar("--map-other"), borderColor: t.panel, borderWidth: 1 },
        emphasis: { label: { show: false }, itemStyle: { borderColor: t.text, borderWidth: 2 } },
        regions: view.basins.map(b => ({ name: b.name, itemStyle: { areaColor: colour(b), borderColor: b.name === selName ? t.text : t.panel, borderWidth: b.name === selName ? 2.5 : 1 }, emphasis: { itemStyle: { areaColor: colour(b) } } }))
      },
      series: [{
        name: "reservoirs", type: "scatter", coordinateSystem: "geo", z: 3,
        data: shown.map(p => ({ name: p.name, value: [p.lon, p.lat], symbolSize: Math.max(3, Math.sqrt(p.cap) / 2.4),
          itemStyle: { color: fillColour(mul(p.water || 0, 100) / p.cap), borderColor: t.panel, borderWidth: 0.6, opacity: p.hydro ? 0.95 : 0.55 } })),
        emphasis: { scale: 1.5, itemStyle: { borderColor: t.text, borderWidth: 1.5 } }
      }]
    });
    this.mapPanel.setTitle(`Reservoirs by basin, ${fmtLongDate(date)}`, `${what} · scroll or pinch to zoom · click a basin`);
    this.mapPanel.render({
      series: [],
      custom: {
        option, legend: [], exportSize: 900,
        table: () => ({
          headers: ["Basin", m.label, "5-year average", "10-year average", "Last year", "Last week", "Difference against " + AGAINST[s.compare], "% difference", "Water (hm³)", "Capacity (hm³)", "Energy (GWh)", "Energy capacity (GWh)"],
          rows: [view.spain, ...view.basins].map(b => [b.name, b.v, b.avg5, b.avg10, b.ly, b.week, b.d, b.p, b.row.water_hm3, b.row.cap_hm3, b.row.energy, b.row.energy_cap])
        }),
        onReady: chart => {
          this.mapChart = chart;
          chart.off("click");
          chart.on("click", p => { if (p.componentType === "geo") { const b = byName.get(p.name); if (b) this.select(b.key === this.state.basin ? "all" : b.key); } });
        }
      },
      notes: ["MITECO's weekly hydrological bulletin, every mainland reservoir over 5 hm³. Averages use the bulletin nearest the same date in each of the years before. Energy is MITECO's calculation of the hydroelectric energy the stored water could produce; basins without hydroelectric reservoirs show no energy. Basin outlines: MITECO."]
    });

    const list = this.root.querySelector("[data-list]");
    this.root.querySelector("[data-list-sub]").textContent = `${s.show === "level" ? m.label : "Against " + AGAINST[s.compare]} · lowest first · last 12 weeks`;
    const rowHtml = (b, dot) => `<button type="button" class="reactor-row${b.key === sel ? " active" : ""}" data-basin="${b.key}">
        <span class="dot" style="background:${dot}"></span>
        <span class="reactor-name"><b>${b.name}</b><span>${fmtV(b.v)}</span></span>
        ${sparkline(b.spark)}
        <span class="reactor-when"><span>${fmtS(b.s)}</span></span></button>`;
    list.innerHTML = rowHtml(view.spain, cssVar("--s-actual")) + [...ranked, ...view.basins.filter(b => b.s == null)].map(b => rowHtml(b, colour(b))).join("");
    list.querySelectorAll("[data-basin]").forEach(row => {
      const name = data.names.get(row.dataset.basin);
      row.addEventListener("mouseenter", () => { if (row.dataset.basin !== "all") this.mapChart?.dispatchAction({ type: "highlight", geoIndex: 0, name }); });
      row.addEventListener("mouseleave", () => { if (row.dataset.basin !== "all") this.mapChart?.dispatchAction({ type: "downplay", geoIndex: 0, name }); });
      row.addEventListener("click", () => this.select(row.dataset.basin));
    });

    this.renderDetail(data, sel, m, N, date);
    this.root.querySelector("[data-top-title]").textContent = `Largest reservoirs, ${data.names.get(sel)}`;
    if (!isLatest) {
      this.root.querySelector("[data-top-sub]").textContent = "Reservoir-level detail is available for the latest bulletin only";
      this.root.querySelector("[data-top]").innerHTML = `<p class="muted">Move the slider to the latest bulletin to see individual reservoirs.</p>`;
      return;
    }
    this.root.querySelector("[data-top-sub]").textContent = "Latest bulletin · weekly change in hm³";
    const inBasin = points.filter(p => p.cap && (sel === "all" || p.key === sel)).sort((a, b) => b.cap - a.cap).slice(0, sel === "all" ? 10 : 8);
    this.root.querySelector("[data-top]").innerHTML = `<table><thead><tr><th>Reservoir</th><th>Basin</th><th>Use</th><th>Capacity (hm³)</th><th>Water (hm³)</th><th>% full</th><th>Week (hm³)</th><th>Energy (GWh)</th></tr></thead><tbody>
      ${inBasin.map(p => `<tr><td class="text">${p.name}</td><td class="text">${p.basin}</td><td class="text">${useLabel(p.use)}</td><td>${fmtNumber(p.cap, 0)}</td><td>${fmtNumber(p.water, 0)}</td>
        <td>${fmtNumber(mul(p.water || 0, 100) / p.cap, 0)}%</td><td>${signed(p.dw, x => fmtNumber(x, 0))}</td><td>${p.energy_cap ? fmtNumber(p.energy, 0) + " / " + fmtNumber(p.energy_cap, 0) : "–"}</td></tr>`).join("")}</tbody></table>`;
  }

  renderDetail(data, key, m, N, date) {
    const vals = valuesOf(data, key, this.state.measure);
    const year = Number(date.slice(0, 4));
    const dates = data.dates.filter(d => d.startsWith(String(year)));
    const K = yearsBack(N);
    const at = (d, k) => near(vals, shiftDate(d, -k));
    const unit = m.unit;
    this.detailPanel.setTitle(`${data.names.get(key)}: ${m.label}, ${year}`, `Weekly bulletins · against last year and the ${N} years before${key === "all" ? " · click a basin to see it here" : " · click it again, or Spain in the list, to go back"}`);
    this.detailPanel.render({
      xType: "time", xLabel: fmtDate, yName: unit, yMin: 0, source: MITECO,
      series: [
        { name: `Range, ${N} years before`, colour: "--s-band", type: "band", unit, data: dates.map(d => { const xs = K.map(k => at(d, k)).filter(v => v != null); return [parisMidnight(d), xs.length >= 2 ? Math.min(...xs) : null, xs.length >= 2 ? Math.max(...xs) : null]; }) },
        { name: `${N}-year average`, colour: "--s-avg", type: "line", dashed: true, width: 1.4, unit, decimals: m.dec, avg: false, data: dates.map(d => [parisMidnight(d), meanOf(K.map(k => at(d, k)))]) },
        { name: "Last year", colour: "--s-ly", type: "line", width: 1.5, unit, decimals: m.dec, avg: false, data: dates.map(d => [parisMidnight(d), at(d, 1)]) },
        { name: String(year), colour: "--s-actual", type: "line", width: 2.6, z: 20, unit, decimals: m.dec, avg: false, data: dates.filter(d => d <= date).map(d => [parisMidnight(d), vals.get(d) ?? null]) }
      ]
    });
  }
}
