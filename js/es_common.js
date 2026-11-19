// Shared pieces for the Spain pages: number formats, headline block, the
// Base class used by the analysis tabs (period picker, settings, address
// and shared period), simple statistics and a scatter/heat-map helper.
// Code note: no asterisks here (chat formatting strips them when pasted).
import { bindPeriod } from "./market-common.js";
import { copyText, fmtNumber, toWall, writeHash } from "./util.js";

export const mul = (a, b) => a / (1 / b);
export const pct = (part, whole) => (whole ? mul(100, part / whole) : null);
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const GW = v => (v == null || !Number.isFinite(v) ? "–" : fmtNumber(v / 1000, 1) + " GW");
export const EUR = v => (v == null || !Number.isFinite(v) ? "–" : "€" + fmtNumber(v, 2) + "/MWh");
export const eur = v => (v == null || !Number.isFinite(v) ? "–" : "€" + fmtNumber(v, 2));
export const signed = (v, f) => (v == null || !Number.isFinite(v) ? "–" : (v >= 0 ? "+" : "−") + f(Math.abs(v)));
export const meanOf = vs => { const f = vs.filter(v => v != null && Number.isFinite(v)); return f.length ? f.reduce((a, b) => a + b, 0) / f.length : null; };
export const sumOf = vs => vs.filter(v => v != null && Number.isFinite(v)).reduce((a, b) => a + b, 0);
export const cards = list => `<div class="es-cards">${list.join("")}</div>`;
export const linkCard = (href, html) => `<a class="es-card-link" href="${href}">${html}</a>`;
export const localHour = t => new Date(toWall(t)).getUTCHours();
export const quantile = (sorted, q) => (sorted.length ? sorted.at(Math.min(sorted.length - 1, Math.max(0, Math.floor(mul(q, sorted.length - 1))))) : null);

export function headlineBlock() {
  return `<div class="headline es-headline"><p data-headline>Loading…</p><button class="btn ghost small" type="button" data-copy>Copy</button></div>`;
}
export function wireHeadline(root) {
  const h = root.querySelector("[data-headline]");
  root.querySelector("[data-copy]").addEventListener("click", () => copyText(h.textContent));
  return h;
}
// A labelled drop-down bound to state key k.
export function selectHtml(k, label, options) {
  return `<label class="field"><span>${label}</span><select data-k="${k}">${options.map(o => `<option value="${o.at(0)}">${o.at(1)}</option>`).join("")}</select></label>`;
}

// Analysis tab: an optional period picker plus settings (data-k), the
// address, the shared period across the Prices tabs, and a render(id) to
// implement. Pass hasPeriod = false for tabs without a period picker.
export class Base {
  constructor(root, key, defaults, hasPeriod = true) {
    this.root = root;
    this.key = key;
    this.writesHash = true;
    this.hasPeriod = hasPeriod;
    this.state = { preset: "last365", from: "", to: "", ...defaults };
    this.renderId = 0;
    this.panels = [];
  }
  wire() {
    this.headline = wireHeadline(this.root);
    this.period = this.hasPeriod ? bindPeriod(this.root, this.state, () => this.update()) : null;
    this.root.querySelectorAll("[data-k]").forEach(input => input.addEventListener("change", () => {
      this.state[input.dataset.k] = input.type === "checkbox" ? (input.checked ? "1" : "0") : input.value;
      this.update();
    }));
  }
  sync() {
    this.period?.sync();
    this.root.querySelectorAll("[data-k]").forEach(i => {
      if (i.type === "checkbox") i.checked = this.state[i.dataset.k] === "1";
      else i.value = this.state[i.dataset.k];
    });
  }
  setParams(p) {
    for (const k of Object.keys(this.state)) if (p.has(k)) this.state[k] = p.get(k);
    if (this.period && this.state.preset !== "custom") this.period.apply();
    this.sync();
  }
  applyPeriod(p) {
    if (!p || !this.period) return;
    Object.assign(this.state, { preset: p.preset, from: p.from, to: p.to });
    if (p.preset !== "custom") this.period.apply();
  }
  activate() { return this.update(); }
  async update() {
    const id = ++this.renderId;
    if (this.period && this.state.preset !== "custom") this.period.apply();
    writeHash(this.key, this.state);
    this.sync();
    try {
      await this.render(id);
    } catch (error) {
      console.error(error);
      if (id === this.renderId) this.headline.textContent = `The data could not be loaded (${error.message}).`;
    }
  }
  refreshTheme() { for (const p of this.panels) p.refreshTheme(); }
}

// Colours for years in scatter charts (newest strongest).
const YEAR_COLOURS = ["#60a5fa", "#34d399", "#fbbf24", "#f472b6", "#a78bfa", "#f87171", "#22d3ee", "#a3e635", "#fb923c", "#e879f9", "#94a3b8", "#2dd4bf"];
export const yearColour = (year, last) => YEAR_COLOURS.at((last - year) % YEAR_COLOURS.length);

// A custom ECharts scatter for ChartPanel: groups = list of {name, colour, data: list of [x, y]}.
export function scatterSpec({ groups, xName, yName, xFmt, yFmt, notes, source }) {
  return {
    source, notes,
    custom: {
      legend: groups.map(g => ({ name: g.name, colour: g.colour, shape: "dot" })),
      table: () => ({ headers: ["Group", xName, yName], rows: groups.flatMap(g => g.data.map(p => [g.name, p.at(0), p.at(1)])) }),
      option: t => ({
        animation: false,
        grid: { left: 64, right: 24, top: 20, bottom: 48 },
        tooltip: { trigger: "item", backgroundColor: t.tooltip, borderColor: t.border, textStyle: { color: t.text },
          formatter: p => `${p.seriesName}<br>${xName}: ${xFmt(p.value.at(0))}<br>${yName}: ${yFmt(p.value.at(1))}` },
        xAxis: { type: "value", name: xName, nameLocation: "middle", nameGap: 30, scale: true, axisLabel: { color: t.muted }, nameTextStyle: { color: t.muted }, splitLine: { lineStyle: { color: t.grid } } },
        yAxis: { type: "value", name: yName, scale: true, axisLabel: { color: t.muted }, nameTextStyle: { color: t.muted }, splitLine: { lineStyle: { color: t.grid } } },
        series: groups.map(g => ({ name: g.name, type: "scatter", symbolSize: g.size || 4, large: g.data.length > 3000, itemStyle: { color: g.colour, opacity: 0.6 }, data: g.data }))
      })
    }
  };
}

// A custom ECharts heat map: rows x cols of values (null = no data).
export function heatSpec({ rows, cols, values, label, fmt, source, notes, colours }) {
  const flat = [];
  values.forEach((r, i) => r.forEach((v, j) => { if (v != null) flat.push([j, i, v]); }));
  const vs = flat.map(p => p.at(2));
  return {
    source, notes,
    custom: {
      legend: [],
      table: () => ({ headers: ["", ...cols], rows: rows.map((r, i) => [r, ...values.at(i).map(v => (v == null ? "" : v))]) }),
      option: t => ({
        animation: false,
        grid: { left: 56, right: 24, top: 16, bottom: 70 },
        tooltip: { backgroundColor: t.tooltip, borderColor: t.border, textStyle: { color: t.text },
          formatter: p => `${rows.at(p.value.at(1))}, ${cols.at(p.value.at(0))}<br>${label}: ${fmt(p.value.at(2))}` },
        xAxis: { type: "category", data: cols, axisLabel: { color: t.muted }, splitArea: { show: false } },
        yAxis: { type: "category", data: rows, axisLabel: { color: t.muted } },
        visualMap: { min: vs.length ? Math.min(...vs) : 0, max: vs.length ? Math.max(...vs) : 1, calculable: true, orient: "horizontal", left: "center", bottom: 6,
          textStyle: { color: t.muted }, inRange: { color: colours || ["#0f172a", "#1d4ed8", "#38bdf8", "#fde047"] } },
        series: [{ type: "heatmap", data: flat, label: { show: false } }]
      })
    }
  };
}
