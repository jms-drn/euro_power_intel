// Spain Prices: Capture Prices and Residual Demand, from the daily market
// summaries and the hourly file built by scripts/es_market.py.
// Code note: no asterisks here (chat formatting strips them when pasted).
import { ChartPanel } from "./chart.js";
import { card, periodHtml } from "./market-common.js";
import { addDays, dateKey, dateRange, daysBetween, fmtDate, fmtFromTo, fmtMonth, fmtNumber, fmtPeriod, heroHtml, parisMidnight, todayParis, weekStart } from "./util.js";
import { BOTH, PRICE_FIRST, getHourly, getPricesDaily } from "./es-data.js";
import { Base, EUR, GW, MONTHS, cards, headlineBlock, localHour, meanOf, mul, pct, scatterSpec, selectHtml, signed, yearColour } from "./es-common.js";

const TECHS = [["solar", "Solar", "--f-solar"], ["wind", "Wind", "--f-wind"], ["nuclear", "Nuclear", "--f-nuclear"], ["hydro", "Hydro (net of pumping)", "--f-hydro"], ["ccgt", "Combined cycle (gas)", "--f-gas"]];
const techName = k => TECHS.find(t => t.at(0) === k).at(1);
const pp = v => signed(v, x => fmtNumber(x, 1) + " pp");
const monthDates = (y, m) => dateRange(`${y}-${String(m + 1).padStart(2, "0")}-01`, addDays(m === 11 ? `${y + 1}-01-01` : `${y}-${String(m + 2).padStart(2, "0")}-01`, -1));

// Output-weighted capture price, baseload and capture rate over a list of dates.
function capture(daily, dates, tech) {
  let w = 0;
  let sum = 0;
  const base = [];
  for (const d of dates) {
    const r = daily.byDate.get(d);
    if (!r) continue;
    if (r.ES_base != null) base.push(r.ES_base);
    const c = r["cap_" + tech];
    const g = r["gen_" + tech];
    if (c != null && g) { sum += mul(c, g); w += g; }
  }
  const price = w ? sum / w : null;
  const b = meanOf(base);
  return { price, base: b, rate: price != null && b ? pct(price, b) : null, gen: w ? w / dates.length : null };
}

// ---------- Capture Prices ----------

export class EsCapture extends Base {
  constructor(root) {
    super(root, "prices/capture", { preset: "last365", res: "1M", tech: "solar" });
    root.innerHTML = `
      ${heroHtml("What each technology", "earns.", "Capture prices: the Spanish day-ahead price weighted by each technology's output, what a megawatt-hour of solar, wind, nuclear, hydro or gas sold for on average, and the capture rate against baseload. Compared with last year and earlier years.")}
      <div class="toolbar">${periodHtml(PRICE_FIRST)}
        ${selectHtml("res", "Resolution", [["1w", "Weekly"], ["1M", "Monthly"], ["1y", "Yearly"]])}
        ${selectHtml("tech", "Technology for the year-by-year charts", TECHS.map(t => [t.at(0), t.at(1)]))}</div>
      ${headlineBlock()}
      <div data-cards></div><div data-a></div><div data-b></div><div data-c></div><div data-d></div>`;
    this.wire();
    this.pricePanel = new ChartPanel(root.querySelector("[data-a]"), { title: "Capture prices", size: "tall", source: BOTH });
    this.ratePanel = new ChartPanel(root.querySelector("[data-b]"), { title: "Capture rate by month", size: "short", source: BOTH });
    this.scatterPanel = new ChartPanel(root.querySelector("[data-c]"), { title: "Capture rate against output", size: "short", source: BOTH });
    this.hourPanel = new ChartPanel(root.querySelector("[data-d]"), { title: "When each technology earns", size: "short", source: BOTH });
    this.panels = [this.pricePanel, this.ratePanel, this.scatterPanel, this.hourPanel];
  }

  async render(id) {
    const s = this.state;
    const daily = await getPricesDaily();
    if (id !== this.renderId) return;
    const to = s.to > todayParis() ? todayParis() : s.to;
    const dates = dateRange(s.from < PRICE_FIRST ? PRICE_FIRST : s.from, to).filter(d => daily.byDate.get(d)?.ES_base != null);
    if (!dates.length) throw new Error("no prices in this period");
    const lyDates = dates.map(d => addDays(d, -364));
    const stats = TECHS.map(t => ({ k: t.at(0), now: capture(daily, dates, t.at(0)), ly: capture(daily, lyDates, t.at(0)) }));
    const sel = stats.find(x => x.k === s.tech);
    const span = fmtFromTo(dates.at(0), dates.at(-1));
    this.headline.textContent = `${span.at(0).toUpperCase() + span.slice(1)}, Spanish ${techName(s.tech).toLowerCase()} output earned ${EUR(sel.now.price)} on average, a capture rate of ${fmtNumber(sel.now.rate, 1)}% of the ${EUR(sel.now.base)} baseload${sel.ly.rate != null ? `, against ${fmtNumber(sel.ly.rate, 1)}% on the same dates a year earlier` : ""}.`;
    this.root.querySelector("[data-cards]").innerHTML = cards([
      card("Baseload", EUR(sel.now.base), sel.ly.base != null ? signed(sel.now.base - sel.ly.base, v => "€" + fmtNumber(v, 2)) + " on last year" : ""),
      ...stats.map(x => card(techName(x.k), EUR(x.now.price), `Capture rate ${fmtNumber(x.now.rate, 1)}%${x.ly.rate != null && x.now.rate != null ? " · " + pp(x.now.rate - x.ly.rate) + " on last year" : ""}`, x.k === s.tech ? " accent" : ""))
    ]);
    const key = d => (s.res === "1w" ? weekStart(d) : s.res === "1y" ? d.slice(0, 4) + "-01-01" : d.slice(0, 7) + "-01");
    const groups = new Map();
    for (const d of dates) { const k = key(d); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(d); }
    const ks = [...groups.keys()].sort();
    const xLabel = s.res === "1M" ? fmtMonth : s.res === "1y" ? x => dateKey(x).slice(0, 4) : x => "Week of " + fmtDate(x);
    this.pricePanel.setTitle("Capture prices and baseload", `${fmtPeriod(dates.at(0), dates.at(-1))} · €/MWh`);
    this.pricePanel.render({
      xType: "time", xLabel, axisLabel: s.res === "1M" ? fmtMonth : undefined, xHeader: "Period", yName: "€/MWh", zeroLine: true, source: BOTH,
      series: [
        { name: "Baseload", colour: "--s-ly", type: "line", dashed: true, width: 1.6, unit: "€/MWh", decimals: 2, avg: false, data: ks.map(k => [parisMidnight(k), capture(daily, groups.get(k), "solar").base]) },
        ...TECHS.map(t => ({ name: t.at(1), colour: t.at(2), type: "line", width: t.at(0) === s.tech ? 2.6 : 1.5, unit: "€/MWh", decimals: 2, avg: false, data: ks.map(k => [parisMidnight(k), capture(daily, groups.get(k), t.at(0)).price]) }))
      ],
      notes: ["Capture price: the average Spanish day-ahead price weighted by the technology's output each quarter-hour. For the whole period, see the cards above: those are weighted by output, so months when a technology ran more count for more. A simple average of the points in this chart would not be. Hydro is REE's real-time figure, net of pumped-storage consumption, counted only when positive, so every year is measured the same way."]
    });
    const lastYear = Number(dates.at(-1).slice(0, 4));
    const years = [lastYear - 4, lastYear - 3, lastYear - 2, lastYear - 1, lastYear].filter(y => y >= 2015);
    const monthRate = (y, m) => {
      const ds = monthDates(y, m).filter(d => daily.byDate.has(d));
      return ds.length ? capture(daily, ds, s.tech).rate : null;
    };
    const earlier = [];
    for (let y = 2015; y < years.at(0); y++) earlier.push(y);
    this.ratePanel.setTitle(`${techName(s.tech)} capture rate by month, year by year`, "% of baseload");
    this.ratePanel.render({
      xType: "category", categories: MONTHS, xLabel: x => x, xHeader: "Month", yName: "%", source: BOTH,
      series: [
        ...(earlier.length ? [{ name: `Average ${earlier.at(0)}–${earlier.at(-1)}`, colour: "--s-d2", type: "line", dashed: true, width: 1.4, unit: "%", decimals: 1, avg: false, data: MONTHS.map((m, i) => [i, meanOf(earlier.map(y => monthRate(y, i)))]) }] : []),
        ...years.map(y => ({ name: String(y), colour: y === lastYear ? "--s-actual" : yearColour(y, lastYear), type: "line", width: y === lastYear ? 2.6 : 1.3, unit: "%", decimals: 1, avg: false, data: MONTHS.map((m, i) => [i, monthRate(y, i)]) }))
      ]
    });
    const points = [];
    for (let y = 2015; y <= lastYear; y++) for (let m = 0; m < 12; m++) {
      const ds = monthDates(y, m).filter(d => daily.byDate.has(d));
      const c = ds.length >= 20 ? capture(daily, ds, s.tech) : null;
      if (c && c.rate != null && c.gen != null) points.push({ y, x: c.gen / 1000, r: c.rate });
    }
    const scatterGroups = [...new Set(points.map(p => p.y))].map(y => ({ name: String(y), colour: yearColour(y, lastYear), size: 8, data: points.filter(p => p.y === y).map(p => [Math.round(mul(p.x, 100)) / 100, Math.round(mul(p.r, 10)) / 10]) }));
    this.scatterPanel.setTitle(`${techName(s.tech)}: capture rate against average output, every month since 2015`, "Each point is a month, coloured by year");
    this.scatterPanel.render(scatterSpec({ groups: scatterGroups, xName: "Average output (GW)", yName: "Capture rate (%)", xFmt: v => fmtNumber(v, 2) + " GW", yFmt: v => fmtNumber(v, 1) + "%", source: BOTH,
      notes: ["As more of a technology runs at the same time, its capture rate usually falls: the cannibalisation effect."] }));
    const hFrom = daysBetween(dates.at(0), to) > 1095 ? addDays(to, -1095) : dates.at(0);
    const hours = (await getHourly(hFrom, to)).filter(r => r.es != null);
    if (id !== this.renderId) return;
    const byHour = Array.from({ length: 24 }, () => []);
    for (const r of hours) byHour.at(localHour(r.t)).push(r);
    const cats = byHour.map((x, h) => String(h).padStart(2, "0") + ":00");
    this.hourPanel.setTitle("Average output and price by hour of day", `${fmtPeriod(hFrom, to)} · GW (left), €/MWh (right), local time`);
    this.hourPanel.render({
      xType: "category", categories: cats, xLabel: x => x, xHeader: "Hour", yName: "GW", zeroLine: true, yAxis2: { name: "€/MWh", format: v => fmtNumber(v, 0) }, source: BOTH,
      series: [
        ...TECHS.map(t => ({ name: t.at(1), colour: t.at(2), type: "line", width: 1.8, unit: "GW", decimals: 2, avg: false, data: byHour.map((list, h) => [h, meanOf(list.map(r => r[t.at(0)])) / 1000]) })),
        { name: "Spanish price", colour: "--s-actual", type: "line", dashed: true, width: 2.4, yAxis: 1, unit: "€/MWh", decimals: 2, avg: false, data: byHour.map((list, h) => [h, meanOf(list.map(r => r.es))]) }
      ],
      notes: ["Hydro here is REE's net figure, so it can dip below zero in the hours when pumping exceeds hydro output."]
    });
  }
}

// ---------- Residual Demand ----------

export class EsResidual extends Base {
  constructor(root) {
    super(root, "prices/residual", { preset: "last365", res: "1w" });
    root.innerHTML = `
      ${heroHtml("Residual", "demand.", "Spanish demand minus wind and solar output: what the rest of the fleet and imports have to cover. Against the same dates last year and the average and range of earlier years, and the average price at each level.")}
      <div class="toolbar">${periodHtml(PRICE_FIRST)}
        ${selectHtml("res", "Resolution", [["1d", "Daily"], ["1w", "Weekly"], ["1M", "Monthly"]])}</div>
      ${headlineBlock()}
      <div data-cards></div><div data-a></div><div data-b></div>`;
    this.wire();
    this.linePanel = new ChartPanel(root.querySelector("[data-a]"), { title: "Residual demand", size: "tall", source: "REE (Spanish TSO)" });
    this.pricePanel = new ChartPanel(root.querySelector("[data-b]"), { title: "Price by residual demand", size: "short", source: BOTH });
    this.panels = [this.linePanel, this.pricePanel];
  }

  async render(id) {
    const s = this.state;
    const daily = await getPricesDaily();
    if (id !== this.renderId) return;
    const to = s.to > todayParis() ? todayParis() : s.to;
    const dates = dateRange(s.from < PRICE_FIRST ? PRICE_FIRST : s.from, to).filter(d => daily.byDate.get(d)?.res_mean != null);
    if (!dates.length) throw new Error("no residual demand in this period");
    const shift = (d, k) => `${Number(d.slice(0, 4)) - k}${d.slice(4)}`;
    const valOf = d => daily.byDate.get(d)?.res_mean ?? null;
    const key = d => (s.res === "1w" ? weekStart(d) : s.res === "1M" ? d.slice(0, 7) + "-01" : d);
    const groups = new Map();
    for (const d of dates) { const k = key(d); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(d); }
    const ks = [...groups.keys()].sort();
    const at = (k, years) => meanOf(groups.get(k).map(d => valOf(shift(d, years))));
    const now = meanOf(dates.map(valOf));
    const ly = meanOf(dates.map(d => valOf(shift(d, 1))));
    const lows = dates.map(d => ({ d, v: daily.byDate.get(d).res_min })).filter(x => x.v != null).sort((a, b) => a.v - b.v);
    const highs = dates.map(d => daily.byDate.get(d).res_max).filter(v => v != null);
    const span = fmtFromTo(dates.at(0), dates.at(-1));
    const change = ly ? pct(now - ly, ly) : null;
    this.headline.textContent = `${span.at(0).toUpperCase() + span.slice(1)}, Spanish residual demand averaged ${GW(now)}${change != null ? `, ${fmtNumber(Math.abs(change), 1)}% ${change >= 0 ? "above" : "below"} the same dates a year earlier (${GW(ly)})` : ""}${lows.length ? `. Its lowest quarter-hour was ${GW(lows.at(0).v)} on ${fmtPeriod(lows.at(0).d, lows.at(0).d)}` : ""}.`;
    this.root.querySelector("[data-cards]").innerHTML = cards([
      card("Average residual demand", GW(now), change != null ? `${signed(change, v => fmtNumber(v, 1) + "%")} on last year` : "", " accent"),
      card("Last year, same dates", GW(ly), ""),
      card("Lowest quarter-hour", lows.length ? GW(lows.at(0).v) : "–", lows.length ? fmtPeriod(lows.at(0).d, lows.at(0).d) : ""),
      card("Highest quarter-hour", highs.length ? GW(Math.max(...highs)) : "–", "")
    ]);
    const xLabel = s.res === "1M" ? fmtMonth : s.res === "1w" ? x => "Week of " + fmtDate(x) : fmtDate;
    const earlierYears = [2, 3, 4, 5, 6];
    this.linePanel.setTitle("Residual demand: demand minus wind and solar", `${fmtPeriod(dates.at(0), dates.at(-1))} · GW`);
    this.linePanel.render({
      xType: "time", xLabel, axisLabel: s.res === "1M" ? fmtMonth : undefined, xHeader: "Date", yName: "GW", source: "REE (Spanish TSO)",
      series: [
        { name: "Range of the 5 years before", colour: "--s-d2", type: "band", data: ks.map(k => { const vs = earlierYears.map(y => at(k, y)).filter(v => v != null); return [parisMidnight(k), vs.length ? Math.min(...vs) / 1000 : null, vs.length ? Math.max(...vs) / 1000 : null]; }) },
        { name: "Average of the 5 years before", colour: "--s-d1", type: "line", dashed: true, width: 1.4, unit: "GW", decimals: 2, data: ks.map(k => [parisMidnight(k), meanOf(earlierYears.map(y => at(k, y)))]).filter(p => p.at(1) != null).map(p => [p.at(0), p.at(1) / 1000]) },
        { name: "Last year", colour: "--s-ly", type: "line", width: 1.6, unit: "GW", decimals: 2, data: ks.map(k => [parisMidnight(k), at(k, 1)]).filter(p => p.at(1) != null).map(p => [p.at(0), p.at(1) / 1000]) },
        { name: "This period", colour: "--s-actual", type: "line", width: 2.6, unit: "GW", decimals: 2, data: ks.map(k => [parisMidnight(k), at(k, 0) / 1000]) }
      ],
      notes: ["Earlier years are compared on the same calendar dates. The 5 years before are the second to sixth years back, so last year is shown on its own."]
    });
    const hFrom = daysBetween(dates.at(0), to) > 1095 ? addDays(to, -1095) : dates.at(0);
    const both = await Promise.all([getHourly(hFrom, to), getHourly(shift(hFrom, 1), shift(to, 1))]);
    if (id !== this.renderId) return;
    const binned = rows => {
      const m = new Map();
      for (const r of rows) {
        if (r.residual == null || r.es == null) continue;
        const b = mul(Math.floor(r.residual / 2000), 2);
        if (!m.has(b)) m.set(b, []);
        m.get(b).push(r.es);
      }
      return m;
    };
    const a = binned(both.at(0));
    const b = binned(both.at(1));
    const bins = [...new Set([...a.keys(), ...b.keys()])].filter(k => (a.get(k)?.length || 0) + (b.get(k)?.length || 0) >= 5).sort((x, y) => x - y);
    this.pricePanel.setTitle("Average Spanish price at each level of residual demand", `${fmtPeriod(hFrom, to)} against a year earlier · €/MWh, 2 GW bands`);
    this.pricePanel.render({
      xType: "category", categories: bins.map(k => `${k}–${k + 2} GW`), xLabel: x => x, xHeader: "Residual demand", yName: "€/MWh", zeroLine: true, source: BOTH,
      series: [
        { name: "A year earlier", colour: "--s-ly", type: "line", width: 1.6, unit: "€/MWh", decimals: 2, avg: false, data: bins.map((k, i) => [i, meanOf(b.get(k) || [])]) },
        { name: "This period", colour: "--s-actual", type: "line", width: 2.6, unit: "€/MWh", decimals: 2, avg: false, data: bins.map((k, i) => [i, meanOf(a.get(k) || [])]) }
      ],
      notes: ["Hourly averages. Bands with fewer than 5 hours are left out."]
    });
  }
}
