// Spain Prices: Mix & Price and Negative Prices, from the hourly file
// (data/es/hourly/YYYY.csv) built by scripts/es_market.py.
// Code note: no asterisks here (chat formatting strips them when pasted).
import { ChartPanel } from "./chart.js";
import { card, periodHtml } from "./market-common.js";
import { addDays, dateKey, daysBetween, fmtDateTime, fmtFromTo, fmtNumber, fmtPeriod, heroHtml, parisMidnight, todayParis } from "./util.js";
import { BOTH, ENTSOE, PRICE_FIRST, ZONES, getHourly } from "./es-data.js";
import { Base, EUR, MONTHS, cards, eur, headlineBlock, heatSpec, localHour, meanOf, mul, pct, quantile, scatterSpec, selectHtml, signed, sumOf, yearColour } from "./es-common.js";

// Hydro in the hourly file is REE's net figure (output minus pumping): counted
// when positive in shares, so every year is measured the same way.
const total = r => ["nuclear", "wind", "solar", "hydro", "ccgt", "coal", "chp", "ren_th"].reduce((a, k) => a + Math.max(0, r[k] || 0), 0);
const gw = v => (v == null ? null : v / 1000);
const CONDITIONS = {
  solar_share: { label: "Solar share of generation (%)", short: "solar share", unit: "%", width: 5, get: r => pct(r.solar, total(r)) },
  wind_share: { label: "Wind share of generation (%)", short: "wind share", unit: "%", width: 5, get: r => pct(r.wind, total(r)) },
  vre_share: { label: "Wind and solar share (%)", short: "wind and solar share", unit: "%", width: 5, get: r => pct((r.wind || 0) + (r.solar || 0), total(r)) },
  solar: { label: "Solar output (GW)", short: "solar output", unit: "GW", width: 2, get: r => gw(r.solar) },
  wind: { label: "Wind output (GW)", short: "wind output", unit: "GW", width: 2, get: r => gw(r.wind) },
  nuclear: { label: "Nuclear output (GW)", short: "nuclear output", unit: "GW", width: 0.5, get: r => gw(r.nuclear) },
  gas: { label: "Combined-cycle gas output (GW)", short: "gas output", unit: "GW", width: 1, get: r => gw(r.ccgt) },
  hydro: { label: "Hydro output, net of pumping (GW)", short: "net hydro output", unit: "GW", width: 1, get: r => gw(r.hydro) },
  residual: { label: "Residual demand (GW)", short: "residual demand", unit: "GW", width: 2, get: r => gw(r.residual) },
  net_exp: { label: "Net exports (GW)", short: "net exports", unit: "GW", width: 1, get: r => gw(r.net_exp) },
  demand: { label: "Demand (GW)", short: "demand", unit: "GW", width: 2, get: r => gw(r.demand) },
  hour: { label: "Hour of day (local)", short: "hour of day", unit: "h", width: 1, get: r => localHour(r.t) }
};
const STACK = [["nuclear", "Nuclear", "--f-nuclear"], ["wind", "Wind", "--f-wind"], ["solar", "Solar", "--f-solar"], ["hydro", "Hydro", "--f-hydro"],
  ["ccgt", "Combined cycle (gas)", "--f-gas"], ["chp", "Cogeneration and other", "--f-chp"], ["ren_th", "Renewable thermal", "--f-bio"], ["coal", "Coal", "--f-coal"]];
// The mix chart draws hydro before pumping, with pumping below zero.
const stackVal = (r, k) => (k === "hydro" ? Math.max(0, r.hydro_gross ?? r.hydro ?? 0) : Math.max(0, r[k] || 0));
const yearOf = t => Number(dateKey(t).slice(0, 4));
const monthOf = t => Number(dateKey(t).slice(5, 7)) - 1;
const mmdd = t => dateKey(t).slice(5);

// ---------- Mix & Price ----------

export class EsMixPrice extends Base {
  constructor(root) {
    super(root, "prices/mix", { preset: "last365", cond: "solar_share", days: "7" });
    root.innerHTML = `
      ${heroHtml("How the mix", "sets the price.", "The Spanish day-ahead price above the generation mix that produced it, then the average price under different conditions (solar and wind share, output by technology, residual demand, net exports, time of day), and every hour as a point coloured by year.")}
      <div class="toolbar">${periodHtml(PRICE_FIRST)}
        ${selectHtml("cond", "Condition", Object.keys(CONDITIONS).map(k => [k, CONDITIONS[k].label]))}
        ${selectHtml("days", "Linked charts show", [["2", "Last 2 days"], ["7", "Last 7 days"], ["14", "Last 14 days"], ["31", "Last 31 days"]])}</div>
      <p class="muted small">The two linked charts show the last days of the period. The condition chart and scatter use the whole period (up to three years). Hourly averages.</p>
      ${headlineBlock()}
      <div data-cards></div><div data-a></div><div data-b></div><div data-c></div><div data-d></div>`;
    this.wire();
    this.pricePanel = new ChartPanel(root.querySelector("[data-a]"), { title: "Price", size: "short", source: ENTSOE });
    this.mixPanel = new ChartPanel(root.querySelector("[data-b]"), { title: "Generation mix", size: "", source: "REE (Spanish TSO)" });
    this.bandPanel = new ChartPanel(root.querySelector("[data-c]"), { title: "Price by condition", size: "short", source: BOTH });
    this.scatterPanel = new ChartPanel(root.querySelector("[data-d]"), { title: "Every hour", size: "short", source: BOTH });
    this.panels = [this.pricePanel, this.mixPanel, this.bandPanel, this.scatterPanel];
  }

  async render(id) {
    const s = this.state;
    const to = s.to > todayParis() ? todayParis() : s.to;
    const from = daysBetween(s.from, to) > 1095 ? addDays(to, -1095) : s.from;
    const rows = (await getHourly(from, to)).filter(r => r.es != null);
    if (id !== this.renderId) return;
    if (!rows.length) throw new Error("no hourly data in this period");
    const c = CONDITIONS[s.cond];
    const linkFrom = parisMidnight(addDays(to, 1 - Number(s.days)));
    const recent = rows.filter(r => r.t >= linkFrom);
    this.pricePanel.setTitle("Day-ahead prices", `${fmtPeriod(addDays(to, 1 - Number(s.days)), to)} · €/MWh, hourly`);
    this.pricePanel.render({
      xType: "time", xLabel: fmtDateTime, yName: "€/MWh", zeroLine: true, source: ENTSOE,
      series: ["pt", "fr", "es"].map(z => ({ name: ZONES[z.toUpperCase()].name, colour: ZONES[z.toUpperCase()].colour, type: "line", width: z === "es" ? 2.4 : 1.3, unit: "€/MWh", decimals: 2, data: recent.map(r => [r.t, r[z]]) }))
    });
    this.mixPanel.setTitle("Generation mix", "GW, stacked; hydro before pumping, pumping below zero");
    this.mixPanel.render({
      xType: "time", xLabel: fmtDateTime, yName: "GW", zeroLine: true, source: "REE (Spanish TSO)",
      series: [...STACK.map(k => ({ name: k.at(1), colour: k.at(2), type: "line", stack: "mix", areaOpacity: 0.85, width: 0.6, symbols: false, unit: "GW", decimals: 2, data: recent.map(r => [r.t, stackVal(r, k.at(0)) / 1000]) })),
        { name: "Pumping", colour: "--s-ly", type: "line", stack: "pump", areaOpacity: 0.6, width: 0.6, symbols: false, unit: "GW", decimals: 2, data: recent.map(r => [r.t, (r.pump || 0) / 1000]) }]
    });
    const pts = rows.map(r => ({ x: c.get(r), p: r.es, t: r.t })).filter(o => o.x != null && Number.isFinite(o.x));
    const bins = new Map();
    for (const o of pts) {
      const b = mul(Math.floor(o.x / c.width), c.width);
      if (!bins.has(b)) bins.set(b, []);
      bins.get(b).push(o.p);
    }
    const keys = [...bins.keys()].filter(k => bins.get(k).length >= 5).sort((a, b) => a - b);
    const xs = pts.map(o => o.x).sort((a, b) => a - b);
    const q25 = quantile(xs, 0.25);
    const q75 = quantile(xs, 0.75);
    const low = meanOf(pts.filter(o => o.x <= q25).map(o => o.p));
    const high = meanOf(pts.filter(o => o.x >= q75).map(o => o.p));
    const fmtX = v => fmtNumber(v, c.unit === "%" ? 0 : 1) + (c.unit === "h" ? ":00" : c.unit === "%" ? "%" : " " + c.unit);
    const span = fmtFromTo(from, to);
    this.headline.textContent = `${span.at(0).toUpperCase() + span.slice(1)}, in the hours when ${c.short} was highest (top quarter, ${fmtX(q75)} or more) the Spanish day-ahead price averaged ${EUR(high)}, against ${EUR(low)} when it was lowest (bottom quarter, ${fmtX(q25)} or less).`;
    this.root.querySelector("[data-cards]").innerHTML = cards([
      card("Average price", EUR(meanOf(rows.map(r => r.es))), `${fmtNumber(rows.length, 0)} hours`, " accent"),
      card(`Top quarter of ${c.short}`, EUR(high), `${fmtX(q75)} or more`),
      card(`Bottom quarter of ${c.short}`, EUR(low), `${fmtX(q25)} or less`),
      card("Difference", signed(high - low, v => "€" + fmtNumber(v, 2)), "Top minus bottom quarter")
    ]);
    this.bandPanel.setTitle(`Spanish price by ${c.short}`, `${fmtPeriod(from, to)} · average, and 10th–90th percentile band, €/MWh`);
    this.bandPanel.render({
      xType: "category", categories: keys.map(k => fmtNumber(k, c.width < 1 ? 1 : 0) + "–" + fmtNumber(k + c.width, c.width < 1 ? 1 : 0)), xLabel: x => x, xHeader: c.label, yName: "€/MWh", zeroLine: true, source: BOTH,
      yAxis2: { name: "Hours", format: v => fmtNumber(v, 0) },
      series: [
        { name: "Hours", colour: "--s-ly", type: "bar", yAxis: 1, unit: "h", decimals: 0, avg: false, data: keys.map((k, i) => [i, bins.get(k).length]) },
        { name: "10th–90th percentile", colour: "--s-d1", type: "band", data: keys.map((k, i) => { const v = [...bins.get(k)].sort((a, b) => a - b); return [i, quantile(v, 0.1), quantile(v, 0.9)]; }) },
        { name: "Average price", colour: "--s-actual", type: "line", width: 2.4, unit: "€/MWh", decimals: 2, avg: false, data: keys.map((k, i) => [i, meanOf(bins.get(k))]) }
      ],
      notes: ["Bands with fewer than 5 hours are left out."]
    });
    const lastYear = yearOf(rows.at(-1).t);
    const groups = [...new Set(pts.map(o => yearOf(o.t)))].sort().map(y => ({ name: String(y), colour: yearColour(y, lastYear), data: pts.filter(o => yearOf(o.t) === y).map(o => [Math.round(mul(o.x, 100)) / 100, o.p]) }));
    this.scatterPanel.setTitle(`Every hour: Spanish price against ${c.short}`, `${fmtPeriod(from, to)} · coloured by year`);
    this.scatterPanel.render(scatterSpec({ groups, xName: c.label, yName: "€/MWh", xFmt: fmtX, yFmt: EUR, source: BOTH }));
  }
}

// ---------- Negative Prices ----------

export class EsNegative extends Base {
  constructor(root) {
    super(root, "prices/negative", { year: String(new Date().getFullYear()), zone: "ES", thr: "0", zero: "0" }, false);
    const years = [];
    for (let y = new Date().getFullYear(); y >= 2015; y--) years.push([String(y), String(y)]);
    root.innerHTML = `
      ${heroHtml("Negative and", "zero prices.", "Hours with day-ahead prices below zero (or below any threshold), how deep they went and when they happen, year to date against the same dates last year and the average of the three years before.")}
      <div class="toolbar">
        ${selectHtml("year", "Year", years)}
        ${selectHtml("zone", "Market", Object.keys(ZONES).map(z => [z, ZONES[z].name]))}
        ${selectHtml("thr", "Count prices below", [["-20", "−€20"], ["-10", "−€10"], ["-5", "−€5"], ["0", "€0"], ["5", "€5"], ["10", "€10"], ["20", "€20"]])}
        <label class="check"><input type="checkbox" data-k="zero"> Include prices at the threshold</label></div>
      ${headlineBlock()}
      <div data-cards></div><div data-a></div><div data-b></div><div data-c></div><div data-d></div>`;
    this.wire();
    this.cumPanel = new ChartPanel(root.querySelector("[data-a]"), { title: "Hours so far this year", size: "short", source: ENTSOE });
    this.monthPanel = new ChartPanel(root.querySelector("[data-b]"), { title: "By month", size: "short", source: ENTSOE });
    this.heatPanel = new ChartPanel(root.querySelector("[data-c]"), { title: "By month and hour", size: "", source: ENTSOE });
    this.histPanel = new ChartPanel(root.querySelector("[data-d]"), { title: "Price distribution", size: "short", source: ENTSOE });
    this.panels = [this.cumPanel, this.monthPanel, this.heatPanel, this.histPanel];
  }

  async render(id) {
    const s = this.state;
    const year = Number(s.year);
    const z = s.zone.toLowerCase();
    const thr = Number(s.thr);
    const incl = s.zero === "1";
    const rows = (await getHourly(String(year - 4) + "-01-01", String(year) + "-12-31")).filter(r => r[z] != null);
    if (id !== this.renderId) return;
    const exact = thr === 0;
    const hoursOf = r => (exact ? (r[z + "_neg"] || 0) + (incl ? r[z + "_zero"] || 0 : 0) : (incl ? r[z] <= thr : r[z] < thr) ? 1 : 0);
    const depthOf = r => Math.max(0, thr - r[z]);
    const thisYear = rows.filter(r => yearOf(r.t) === year);
    if (!thisYear.length) throw new Error("no prices for " + year);
    const lastT = thisYear.at(-1).t;
    const cut = mmdd(lastT);
    const ytd = y => rows.filter(r => yearOf(r.t) === y && mmdd(r.t) <= cut);
    const sum = (list, f) => sumOf(list.map(f));
    const statOf = list => ({ hours: sum(list, hoursOf), depth: sum(list.filter(r => hoursOf(r) > 0), depthOf), low: list.length ? Math.min(...list.map(r => r[z])) : null,
      days: new Set(list.filter(r => hoursOf(r) > 0).map(r => dateKey(r.t))).size });
    const now = statOf(ytd(year));
    const ly = statOf(ytd(year - 1));
    const earlier = [year - 1, year - 2, year - 3].map(y => statOf(ytd(y)));
    const avg3 = meanOf(earlier.map(x => x.hours));
    const name = ZONES[s.zone].adj;
    const what = thr === 0 ? (incl ? "at or below zero" : "below zero") : (incl ? "at or below " : "below ") + eur(thr);
    const toDate = dateKey(lastT);
    this.headline.textContent = `${name} day-ahead prices have been ${what} for ${fmtNumber(now.hours, 1)} hours in ${year} to ${fmtPeriod(toDate, toDate)}, against ${fmtNumber(ly.hours, 1)} hours on the same dates in ${year - 1} and ${fmtNumber(avg3, 1)} on average in the three years before.`;
    this.root.querySelector("[data-cards]").innerHTML = cards([
      card("Hours " + what, fmtNumber(now.hours, 1) + " h", `${signed(now.hours - ly.hours, v => fmtNumber(v, 1) + " h")} on last year`, " accent"),
      card("Against the 3-year average", signed(now.hours - avg3, v => fmtNumber(v, 1) + " h"), `Average ${fmtNumber(avg3, 1)} h to the same date`),
      card("Days with such prices", String(now.days), `${ly.days} last year`),
      card("Depth", fmtNumber(now.depth, 0) + " €/MWh·h", `${fmtNumber(ly.depth, 0)} last year`),
      card("Lowest hourly price", EUR(now.low), `${EUR(ly.low)} last year`)
    ]);
    const cum = y => {
      let acc = 0;
      return ytd(y).map(r => { acc += hoursOf(r); return [parisMidnight(String(year) + "-" + mmdd(r.t)) + mul(localHour(r.t), 3600000), acc]; });
    };
    this.cumPanel.setTitle(`Cumulative hours ${what}, ${name}`, `1 Jan to ${fmtPeriod(toDate, toDate)} · hours, same calendar dates`);
    this.cumPanel.render({
      xType: "time", xLabel: fmtDateTime, yName: "h", yMin: 0, source: ENTSOE,
      series: [year - 3, year - 2, year - 1, year].map((y, i) => ({ name: String(y), colour: i === 3 ? "--s-actual" : i === 2 ? "--s-ly" : "--s-d2", dashed: i < 2, type: "line", width: i === 3 ? 2.6 : 1.4, unit: "h", decimals: 1, avg: false, data: cum(y) }))
    });
    const months = y => MONTHS.map((m, i) => sum(rows.filter(r => yearOf(r.t) === y && monthOf(r.t) === i), hoursOf));
    this.monthPanel.setTitle(`Hours ${what} by month`, `${name} · ${year} against ${year - 1} and the ${year - 3}–${year - 1} average`);
    this.monthPanel.render({
      xType: "category", categories: MONTHS, xLabel: x => x, xHeader: "Month", yName: "h", yMin: 0, source: ENTSOE,
      series: [
        { name: String(year - 1), colour: "--s-ly", type: "bar", unit: "h", decimals: 1, avg: false, data: months(year - 1).map((v, i) => [i, v]) },
        { name: String(year), colour: "--s-actual", type: "bar", unit: "h", decimals: 1, avg: false, data: months(year).map((v, i) => [i, v]) },
        { name: "Average " + (year - 3) + "–" + (year - 1), colour: "--s-d1", type: "line", dashed: true, unit: "h", decimals: 1, avg: false, data: MONTHS.map((m, i) => [i, meanOf([1, 2, 3].map(k => months(year - k).at(i)))]) }
      ]
    });
    const grid = MONTHS.map((m, i) => Array.from({ length: 24 }, (x, h) => {
      const list = thisYear.filter(r => monthOf(r.t) === i && localHour(r.t) === h);
      return list.length ? Math.round(mul(sum(list, hoursOf), 100)) / 100 : null;
    }));
    this.heatPanel.setTitle(`When prices go ${what}: hours by month and hour of day, ${year}`, `${name} · local time`);
    this.heatPanel.render(heatSpec({ rows: MONTHS, cols: Array.from({ length: 24 }, (x, h) => String(h).padStart(2, "0")), values: grid, label: "Hours", fmt: v => fmtNumber(v, 2) + " h", source: ENTSOE }));
    const bucket = p => mul(Math.floor(p / 10), 10);
    const hist = list => { const m = new Map(); for (const r of list) { const b = bucket(r[z]); m.set(b, (m.get(b) || 0) + 1); } return m; };
    const hNow = hist(ytd(year));
    const hLy = hist(ytd(year - 1));
    const bks = [...new Set([...hNow.keys(), ...hLy.keys()])].sort((a, b) => a - b);
    this.histPanel.setTitle("Hourly prices by €10 band, year to date", `${name} · ${year} against the same dates in ${year - 1} · hours`);
    this.histPanel.render({
      xType: "category", categories: bks.map(b => eur(b)), xLabel: x => x, xHeader: "From (€/MWh)", yName: "h", yMin: 0, source: ENTSOE,
      series: [
        { name: String(year - 1), colour: "--s-ly", type: "bar", unit: "h", decimals: 0, avg: false, data: bks.map((b, i) => [i, hLy.get(b) || 0]) },
        { name: String(year), colour: "--s-actual", type: "bar", unit: "h", decimals: 0, avg: false, data: bks.map((b, i) => [i, hNow.get(b) || 0]) }
      ],
      notes: [exact ? "Hours below zero are counted every 15 minutes since 30 Sep 2025 (hourly before)." : "Thresholds other than zero are applied to hourly average prices.", "Depth: how far below the threshold each hour was, added up."]
    });
  }
}
