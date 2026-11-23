// Spain Hydro: the Reserves map tab. Basins shaded by how full they are,
// against the 5- or 10-year average or last year, or by the week's change;
// reservoirs as dots; a ranked basin list; and a basin's year on click.
// Code note: no asterisks here (chat formatting strips them when pasted).
import { ChartPanel } from "./chart.js";
import { card } from "./market-common.js";
import { cssVar, fmtDate, fmtLongDate, fmtNumber, heroHtml, parisMidnight } from "./util.js";
import { MITECO } from "./es-data.js";
import { Base, cards, headlineBlock, meanOf, mul, selectHtml, signed } from "./es-common.js";
import { AVG_OPTIONS, near, shiftDate, yearsBack } from "./es-hydro.js";
import { MEASURES, SHADES, basinView, fillColour, getBasins, getReservoirPoints, loadBasinMap, scaleFor, valuesOf } from "./es-hydro-map-data.js";

const SPAIN = [[-9.6, 43.95], [3.45, 35.95]];
const LEAD = { avg: "Against the average", avgpct: "In percentage terms", ly: "Against last year", week: "On the week", level: "" };

export class EsHydroMap extends Base {
  constructor(root) {
    super(root, "hydro/map", { measure: "pct", shade: "avg", avg: "5", res: "hydro", basin: "all" }, false);
    root.innerHTML = `
      ${heroHtml("Spain's reserves,", "basin by basin.", "Water and hydroelectric energy in every river basin from MITECO's weekly hydrological bulletin, against the average of the five (or ten) years before, last year or last week, with every reservoir over 5 hm³ on the map. Click a basin to see its year.")}
      ${headlineBlock()}
      <div data-cards></div>
      <div class="map-layout">
        <div class="map-col">
          <div class="map-controls">
            <span class="field-label">Show</span>
            <div class="segmented" role="group" aria-label="Measure">${Object.keys(MEASURES).map(k => `<button type="button" data-measure="${k}">${MEASURES[k].label}</button>`).join("")}</div>
            ${selectHtml("shade", "Shade by", Object.keys(SHADES).map(k => [k, SHADES[k]]))}
            ${selectHtml("avg", "Average", AVG_OPTIONS)}
            ${selectHtml("res", "Reservoirs", [["hydro", "Hydroelectric"], ["all", "All"], ["none", "Hide"]])}
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
      <article class="panel"><div class="panel-head"><div><h2 data-top-title>Largest reservoirs</h2><p class="muted">Latest bulletin · weekly change in hm³</p></div></div>
        <div class="table-scroll flat" data-top></div></article>`;
    this.wire();
    this.mapPanel = new ChartPanel(root.querySelector("[data-map]"), { title: "Basins", size: "map", table: true, source: MITECO });
    this.detailPanel = new ChartPanel(root.querySelector("[data-detail]"), { title: "Basin", size: "short", source: MITECO });
    this.panels = [this.mapPanel, this.detailPanel];
    root.querySelectorAll("[data-measure]").forEach(b => b.addEventListener("click", () => { this.state.measure = b.dataset.measure; this.update(); }));
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
    const got = await Promise.all([getBasins(), getReservoirPoints(), loadBasinMap()]);
    if (id !== this.renderId) return;
    const data = got.at(0);
    const points = got.at(1);
    if (!data.dates.length) throw new Error("no basin data yet: run the Spain hydro detail backfill");
    const m = MEASURES[s.measure] || MEASURES.pct;
    const N = s.avg === "10" ? 10 : 5;
    const view = basinView(data, s.measure, s.shade, N);
    const scale = scaleFor(view.basins.map(b => b.s), s.shade);
    const isPctShade = s.shade === "avgpct";
    const unitOf = isPctShade ? "%" : s.shade === "level" ? m.unit : m.diff;
    const decOf = isPctShade ? 1 : m.dec;
    const fmtV = v => (v == null ? "–" : fmtNumber(v, m.dec) + (m.unit === "%" ? "%" : " " + m.unit));
    const fmtD = (v, unit, dec) => signed(v, x => fmtNumber(x, dec) + (unit === "%" ? "%" : " " + unit));
    const fmtS = v => (s.shade === "level" ? fmtV(v) : fmtD(v, unitOf, decOf));
    const sp = view.spain;
    const ranked = view.basins.filter(b => b.s != null).sort((a, b) => a.s - b.s);
    const low = ranked.at(0);
    const high = ranked.at(-1);
    const below = view.basins.filter(b => b.v != null && b.avg != null && b.v < b.avg).length;
    const withV = view.basins.filter(b => b.v != null).length;

    this.headline.textContent = `In MITECO's bulletin of ${fmtLongDate(view.last)}, Spain's reservoirs ${m.phrase} ${fmtV(sp.v)}${m.tail}, ${fmtD(sp.avg == null ? null : sp.v - sp.avg, m.diff, m.dec)} against the ${N}-year average for the time of year.` +
      (low && high && s.shade !== "level" ? ` ${LEAD[s.shade]}, ${low.name} is lowest (${fmtS(low.s)}) and ${high.name} highest (${fmtS(high.s)}).` : "");
    this.root.querySelector("[data-cards]").innerHTML = cards([
      card("Spain, " + m.label, fmtV(sp.v), "MITECO bulletin of " + fmtLongDate(view.last), " accent"),
      card(`Against the ${N}-year average`, fmtD(sp.avg == null ? null : sp.v - sp.avg, m.diff, m.dec), "Average " + fmtV(sp.avg)),
      card("Against last year", fmtD(sp.ly == null ? null : sp.v - sp.ly, m.diff, m.dec), "Same week last year " + fmtV(sp.ly)),
      card("Change on the week", fmtD(sp.week, m.diff, m.dec), ""),
      card("Basins below average", `${below} of ${withV}`, `For the time of year, ${N} years before`)
    ]);

    const colour = b => scale.colour(b.s) || cssVar("--map-other");
    const legendLo = scale.diverging ? "below" : "lower";
    this.root.querySelector("[data-legend]").innerHTML = `<span style="display:inline-flex;align-items:center;gap:8px">${fmtS(scale.lo)} <i style="display:inline-block;width:160px;height:8px;border-radius:4px;background:linear-gradient(90deg,${scale.stops.join(",")})"></i> ${fmtS(scale.hi)}</span>
      <span style="margin-left:10px">${SHADES[s.shade]}${s.shade === "avg" || s.shade === "avgpct" ? ` (${N} years before)` : ""}: red is ${legendLo}, blue ${scale.diverging ? "above" : "higher"} · dots: reservoirs sized by capacity, shaded by % full</span>`;

    const shown = s.res === "none" ? [] : points.filter(p => p.lon != null && p.cap && (s.res === "all" || p.hydro));
    const byKey = new Map(view.basins.map(b => [b.key, b]));
    const tipBasin = b => `<div style="max-width:300px;white-space:normal"><div style="font-weight:700;font-size:13px">${b.name}</div>
      <div style="margin-top:4px">${m.label}: <b>${fmtV(b.v)}</b></div>
      <div>Against the ${N}-year average: <b>${fmtD(b.avg == null ? null : b.v - b.avg, m.diff, m.dec)}</b></div>
      <div>Against last year: <b>${fmtD(b.ly == null ? null : b.v - b.ly, m.diff, m.dec)}</b></div>
      <div>Change on the week: <b>${fmtD(b.week, m.diff, m.dec)}</b></div>
      <div class="muted" style="margin-top:4px">${fmtNumber(b.row.water_hm3, 0)} of ${fmtNumber(b.row.cap_hm3, 0)} hm³ · ${b.row.energy_cap ? fmtNumber(b.row.energy, 0) + " of " + fmtNumber(b.row.energy_cap, 0) + " GWh hydroelectric" : "no hydroelectric energy"} · ${b.row.reservoirs} reservoirs</div></div>`;
    const tipRes = p => `<div style="max-width:280px;white-space:normal"><div style="font-weight:700">${p.name}</div><div class="muted">${p.basin} · ${p.use || ""}${p.hydro ? " · hydroelectric" : ""}</div>
      <div style="margin-top:4px"><b>${fmtNumber(p.water, 0)}</b> of ${fmtNumber(p.cap, 0)} hm³ (${fmtNumber(mul(p.water || 0, 100) / p.cap, 0)}% full)</div>
      <div>Week: ${signed(p.dw, x => fmtNumber(x, 0) + " hm³")}${p.energy_cap ? ` · energy ${fmtNumber(p.energy, 0)} of ${fmtNumber(p.energy_cap, 0)} GWh` : ""}</div></div>`;
    const sel = s.basin;
    const option = (t, { forExport }) => ({
      backgroundColor: "transparent", animation: false,
      tooltip: forExport ? undefined : {
        trigger: "item", confine: true, backgroundColor: t.tooltip, borderColor: t.border, padding: [9, 12], textStyle: { color: t.text, fontSize: 12 },
        formatter: p => (p.componentType === "geo" ? (byKey.get(p.name) ? tipBasin(byKey.get(p.name)) : "") : p.seriesName === "reservoirs" ? tipRes(shown.at(p.dataIndex)) : "")
      },
      geo: {
        map: "es-basins", roam: !forExport, scaleLimit: { min: 1, max: 8 }, boundingCoords: SPAIN,
        top: forExport ? 100 : 10, bottom: forExport ? 60 : 10, label: { show: false }, tooltip: { show: true }, selectedMode: false,
        itemStyle: { areaColor: cssVar("--map-other"), borderColor: t.panel, borderWidth: 1 },
        emphasis: { label: { show: false }, itemStyle: { borderColor: t.text, borderWidth: 2 } },
        regions: view.basins.map(b => ({ name: b.key, itemStyle: { areaColor: colour(b), borderColor: b.key === sel ? t.text : t.panel, borderWidth: b.key === sel ? 2.5 : 1 }, emphasis: { itemStyle: { areaColor: colour(b) } } }))
      },
      series: [{
        name: "reservoirs", type: "scatter", coordinateSystem: "geo", z: 3,
        data: shown.map(p => ({ name: p.name, value: [p.lon, p.lat], symbolSize: Math.max(3, Math.sqrt(p.cap) / 2.4),
          itemStyle: { color: fillColour(mul(p.water || 0, 100) / p.cap), borderColor: t.panel, borderWidth: 0.6, opacity: p.hydro ? 0.95 : 0.55 } })),
        emphasis: { scale: 1.5, itemStyle: { borderColor: t.text, borderWidth: 1.5 } }
      }]
    });
    this.mapPanel.setTitle(`Reservoirs by basin, ${fmtLongDate(view.last)}`, `${m.label} · shaded by ${SHADES[s.shade].toLowerCase()} · scroll or pinch to zoom`);
    this.mapPanel.render({
      series: [],
      custom: {
        option, legend: [], exportSize: 900,
        table: () => ({
          headers: ["Basin", m.label, "Last year", `${N}-year average`, `${N}-year low`, `${N}-year high`, "Change on the week", "Water (hm³)", "Capacity (hm³)", "Energy (GWh)", "Energy capacity (GWh)"],
          rows: [sp, ...view.basins].map(b => [b.name, b.v, b.ly, b.avg, b.min, b.max, b.week, b.row.water_hm3, b.row.cap_hm3, b.row.energy, b.row.energy_cap])
        }),
        onReady: chart => {
          this.mapChart = chart;
          chart.off("click");
          chart.on("click", p => { if (p.componentType === "geo") this.select(p.name === this.state.basin ? "all" : p.name); });
        }
      },
      legendCaption: null,
      notes: ["MITECO's weekly hydrological bulletin, every mainland reservoir over 5 hm³. Averages and ranges use the bulletin nearest the same date in each of the years before. Energy is MITECO's calculation of the hydroelectric energy the stored water could produce; basins without hydroelectric reservoirs show no energy. Basin outlines: MITECO."]
    });

    const list = this.root.querySelector("[data-list]");
    this.root.querySelector("[data-list-sub]").textContent = `${SHADES[s.shade]} · lowest first · click to see a basin`;
    const rowHtml = b => `<button type="button" class="reactor-row${b.key === sel ? " active" : ""}" data-basin="${b.key}">
        <span class="dot" style="background:${colour(b)}"></span>
        <span class="reactor-name"><b>${b.name}</b><span>${fmtV(b.v)}</span></span>
        <span class="reactor-when"><span>${fmtS(b.s)}</span></span></button>`;
    list.innerHTML = `<button type="button" class="reactor-row${sel === "all" ? " active" : ""}" data-basin="all"><span class="dot" style="background:${cssVar("--s-actual")}"></span>
        <span class="reactor-name"><b>Spain (mainland)</b><span>${fmtV(sp.v)}</span></span><span class="reactor-when"><span>${fmtS(sp.s)}</span></span></button>` +
      [...ranked, ...view.basins.filter(b => b.s == null)].map(rowHtml).join("");
    list.querySelectorAll("[data-basin]").forEach(row => {
      const key = row.dataset.basin;
      row.addEventListener("mouseenter", () => { if (key !== "all") this.mapChart?.dispatchAction({ type: "highlight", geoIndex: 0, name: key }); });
      row.addEventListener("mouseleave", () => { if (key !== "all") this.mapChart?.dispatchAction({ type: "downplay", geoIndex: 0, name: key }); });
      row.addEventListener("click", () => this.select(key));
    });

    this.renderDetail(data, sel, m, N, view.last);
    const inBasin = points.filter(p => p.cap && (sel === "all" || p.key === sel)).sort((a, b) => b.cap - a.cap).slice(0, sel === "all" ? 10 : 8);
    this.root.querySelector("[data-top-title]").textContent = `Largest reservoirs, ${data.names.get(sel)}`;
    this.root.querySelector("[data-top]").innerHTML = `<table><thead><tr><th>Reservoir</th><th>Basin</th><th>Use</th><th>Capacity (hm³)</th><th>Water (hm³)</th><th>% full</th><th>Week (hm³)</th><th>Energy (GWh)</th></tr></thead><tbody>
      ${inBasin.map(p => `<tr><td class="text">${p.name}</td><td class="text">${p.basin}</td><td class="text">${p.use || ""}${p.hydro ? " · hydro" : ""}</td><td>${fmtNumber(p.cap, 0)}</td><td>${fmtNumber(p.water, 0)}</td>
        <td>${fmtNumber(mul(p.water || 0, 100) / p.cap, 0)}%</td><td>${signed(p.dw, x => fmtNumber(x, 0))}</td><td>${p.energy_cap ? fmtNumber(p.energy, 0) + " / " + fmtNumber(p.energy_cap, 0) : "–"}</td></tr>`).join("")}</tbody></table>`;
  }

  renderDetail(data, key, m, N, last) {
    const vals = valuesOf(data, key, this.state.measure);
    const year = Number(last.slice(0, 4));
    const dates = data.dates.filter(d => d.startsWith(String(year)));
    const K = yearsBack(N);
    const at = (d, k) => near(vals, shiftDate(d, -k));
    const unit = m.unit;
    this.detailPanel.setTitle(`${data.names.get(key)}: ${m.label}, ${year}`, `Weekly bulletins · against last year and the ${N} years before${key === "all" ? "" : " · click the basin again or Spain in the list to go back"}`);
    this.detailPanel.render({
      xType: "time", xLabel: fmtDate, yName: unit, yMin: 0, source: MITECO,
      series: [
        { name: `Range, ${N} years before`, colour: "--s-band", type: "band", unit, data: dates.map(d => { const xs = K.map(k => at(d, k)).filter(v => v != null); return [parisMidnight(d), xs.length >= 2 ? Math.min(...xs) : null, xs.length >= 2 ? Math.max(...xs) : null]; }) },
        { name: `${N}-year average`, colour: "--s-avg", type: "line", dashed: true, width: 1.4, unit, decimals: m.dec, avg: false, data: dates.map(d => [parisMidnight(d), meanOf(K.map(k => at(d, k)))]) },
        { name: "Last year", colour: "--s-ly", type: "line", width: 1.5, unit, decimals: m.dec, avg: false, data: dates.map(d => [parisMidnight(d), at(d, 1)]) },
        { name: String(year), colour: "--s-actual", type: "line", width: 2.6, z: 20, unit, decimals: m.dec, avg: false, data: dates.map(d => [parisMidnight(d), vals.get(d) ?? null]) }
      ]
    });
  }
}
