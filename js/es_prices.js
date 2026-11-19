// Spain Prices: Short term, Explorer and Spreads.
// Code note: no asterisks here (chat formatting strips them when pasted).
import { ChartPanel } from "./chart.js";
import { marketEventsBetween } from "./events.js";
import { card, periodHtml } from "./market-common.js";
import { QH_SWITCH, fmtByUnit, isPeak } from "./market-data.js";
import { TimeExplorer } from "./time-explorer.js";
import { QUARTER, addDays, dateKey, dateRange, fmtDate, fmtDateTime, fmtFromTo, fmtMonth, fmtNumber, fmtPeriod, fmtTime, heroHtml, parisMidnight, todayParis, weekStart, writeHash } from "./util.js";
import { ENTSOE, PRICE_FIRST, ZONES, getPriceRaw, getPricesDaily } from "./es-data.js";
import { Base, EUR, cards, eur, headlineBlock, meanOf, mul, pct, selectHtml, signed, wireHeadline } from "./es-common.js";

const NEIGHBOURS = ["FR", "PT"];
const gap = v => signed(v, x => "€" + fmtNumber(x, 2));

// ---------- Short term ----------

export class EsPricesShort {
  constructor(root) {
    this.root = root;
    this.writesHash = true;
    this.state = { day: "today" };
    root.innerHTML = `
      ${heroHtml("Spanish prices,", "today and tomorrow.", "The Spanish day-ahead price every 15 minutes, with France and Portugal, and the day's key figures. Tomorrow's prices appear after the auction, around 13:00.")}
      <div class="toolbar"><div class="field"><span>Day</span><div class="segmented" role="group" data-dayseg><button type="button" data-day="today">Today</button><button type="button" data-day="tomorrow">Tomorrow</button></div></div></div>
      ${headlineBlock()}
      <div data-cards></div>
      <div data-chart></div>`;
    this.headline = wireHeadline(root);
    root.querySelector("[data-dayseg]").addEventListener("click", e => { const b = e.target.closest("[data-day]"); if (b) { this.state.day = b.dataset.day; this.activate(); } });
    this.panel = new ChartPanel(root.querySelector("[data-chart]"), { title: "Day-ahead prices", size: "tall", source: ENTSOE });
  }

  setParams(p) { if (p.has("day")) this.state.day = p.get("day"); }

  async activate() {
    writeHash("prices/short", this.state);
    try {
      const today = todayParis();
      let day = this.state.day === "tomorrow" ? addDays(today, 1) : today;
      let es = await getPriceRaw("ES", day, day);
      let note = "";
      if (!es.length && day !== today) { note = "Tomorrow's prices are not published yet, so today is shown. "; day = today; es = await getPriceRaw("ES", day, day); }
      this.root.querySelectorAll("[data-day]").forEach(b => b.setAttribute("aria-pressed", String((b.dataset.day === "tomorrow") === (day !== today))));
      if (!es.length) throw new Error("no prices for this day yet");
      const prev = addDays(day, -1);
      const got = await Promise.all([getPriceRaw("ES", prev, day), getPriceRaw("FR", prev, day), getPriceRaw("PT", prev, day), getPricesDaily()]);
      const all = got.at(0); const fr = got.at(1); const pt = got.at(2); const daily = got.at(3);
      const ofDay = (rows, d) => rows.filter(r => dateKey(r.t) === d);
      const base = meanOf(es.map(r => r.eur));
      const basePrev = meanOf(ofDay(all, prev).map(r => r.eur));
      const avgN = n => meanOf(dateRange(addDays(day, -n), addDays(day, -1)).map(d => daily.byDate.get(d)?.ES_base));
      const lyBase = daily.byDate.get(addDays(day, -364))?.ES_base;
      const peakVals = es.filter(r => isPeak(r.t)).map(r => r.eur);
      const lo = es.reduce((m, r) => (!m || r.eur < m.eur ? r : m), null);
      const hi = es.reduce((m, r) => (!m || r.eur > m.eur ? r : m), null);
      const negH = es.filter(r => r.eur < 0).reduce((a, r) => a + r.min / 60, 0);
      const zeroH = es.filter(r => r.eur === 0).reduce((a, r) => a + r.min / 60, 0);
      const parity = z => {
        const m = new Map(ofDay(z === "FR" ? fr : pt, day).map(r => [r.t, r.eur]));
        const both = es.filter(r => m.has(r.t));
        return both.length ? pct(both.filter(r => Math.abs(r.eur - m.get(r.t)) < 0.01).length, both.length) : null;
      };
      const zb = z => meanOf(ofDay(z === "FR" ? fr : pt, day).map(r => r.eur));
      const label = day === today ? "today" : "tomorrow";
      this.root.querySelector("[data-cards]").innerHTML = cards([
        card("Baseload " + label, EUR(base), basePrev != null ? gap(base - basePrev) + " on the day before" : "", " accent"),
        card("Against recent days", `${gap(base - avgN(7))} / ${gap(base - avgN(30))}`, "vs 7-day / 30-day average"),
        card("Same weekday last year", EUR(lyBase), lyBase != null ? gap(base - lyBase) + " this year" : ""),
        card("Peak / off-peak", `${eur(meanOf(peakVals))} / ${eur(meanOf(es.filter(r => !isPeak(r.t)).map(r => r.eur)))}`, peakVals.length ? "Mon–Fri 08:00–20:00 / other periods" : "Weekend: no peak period"),
        card("Lowest / highest", `${eur(lo.eur)} / ${eur(hi.eur)}`, `at ${fmtTime(lo.t)} / ${fmtTime(hi.t)} · range ${eur(hi.eur - lo.eur)}`),
        card("Negative-price hours", fmtNumber(negH, 2) + " h", zeroH ? `plus ${fmtNumber(zeroH, 2)} h at zero` : "Below zero"),
        ...NEIGHBOURS.map(z => card(`Spain minus ${ZONES[z].name}`, zb(z) != null ? gap(base - zb(z)) : "–", parity(z) != null ? `Same price ${fmtNumber(parity(z), 0)}% of the time · ${ZONES[z].name} ${EUR(zb(z))}` : "No price yet"))
      ]);
      this.headline.textContent = `${note}The Spanish day-ahead baseload ${day === today ? "is" : "for tomorrow is"} ${EUR(base)}${basePrev != null ? `, ${gap(base - basePrev)} on the day before` : ""}. Prices range from ${EUR(lo.eur)} at ${fmtTime(lo.t)} to ${EUR(hi.eur)} at ${fmtTime(hi.t)}${negH ? `, with ${fmtNumber(negH, 2)} hours below zero` : ""}.`;
      const line = (rows, z, width) => ({ name: ZONES[z].name, colour: ZONES[z].colour, type: "line", step: "start", width, unit: "€/MWh", decimals: 2, data: rows.map(r => [r.t, r.eur]) });
      this.panel.setTitle("Day-ahead prices every 15 minutes", `${fmtPeriod(prev, day)} · €/MWh`);
      this.panel.render({
        xType: "time", xLabel: fmtDateTime, yName: "€/MWh", source: ENTSOE, zeroLine: true,
        markAreas: [{ from: parisMidnight(day), to: parisMidnight(addDays(day, 1)), label: day === today ? "Today" : "Tomorrow", colour: "--today" }],
        series: [line(pt, "PT", 1.3), line(fr, "FR", 1.5), line(all, "ES", 2.6)]
      });
    } catch (error) {
      console.error(error);
      this.headline.textContent = `Prices could not be loaded (${error.message}).`;
    }
  }

  refreshTheme() { this.panel.refreshTheme(); }
}

// ---------- Explorer: zones and spreads ----------

const other = z => (z === "ESFR" ? "FR" : z === "ESPT" ? "PT" : null);
const val = (r, z, key) => {
  const o = other(z);
  if (!o) return r[z + "_" + key];
  const a = r["ES_" + key];
  const b = r[o + "_" + key];
  return a == null || b == null ? null : a - b;
};
const zoneOnly = fn => (r, z) => (other(z) ? null : fn(r, z));
const pm = (key, label, short, extra = {}) => ({ label, short, unit: "€/MWh", decimals: 2, agg: "mean", zeroLine: true, daily: (r, z) => val(r, z, key), ...extra });
const PRICE_MEASURES = {
  base: pm("base", "Baseload price (or spread)", "baseload price"),
  peak: pm("peak", "Peak price (Mon–Fri 08:00–20:00)", "peak price", { peak: "peak" }),
  off: pm("off", "Off-peak price", "off-peak price", { peak: "off" }),
  min: pm("min", "Lowest price in each day", "lowest price", { agg: "min", intraday: false, daily: zoneOnly((r, z) => r[z + "_min"]) }),
  max: pm("max", "Highest price in each day", "highest price", { agg: "max", intraday: false, daily: zoneOnly((r, z) => r[z + "_max"]) }),
  range: { label: "Daily price range (high minus low)", short: "daily price range", unit: "€/MWh", decimals: 2, agg: "mean", intraday: false, daily: zoneOnly((r, z) => (r[z + "_max"] != null && r[z + "_min"] != null ? r[z + "_max"] - r[z + "_min"] : null)) },
  std: { label: "Volatility (standard deviation within the day)", short: "intraday volatility", unit: "€/MWh", decimals: 2, agg: "mean", intraday: false, daily: zoneOnly((r, z) => r[z + "_std"]) },
  neg: { label: "Hours with negative prices", short: "negative-price hours", unit: "h", decimals: 2, agg: "sum", intraday: false, daily: zoneOnly((r, z) => r[z + "_neg"]) },
  zero: { label: "Hours at zero", short: "zero-price hours", unit: "h", decimals: 2, agg: "sum", intraday: false, daily: zoneOnly((r, z) => r[z + "_zero"]) },
  negd: { label: "Negative-price depth (€/MWh·h)", short: "negative-price depth", unit: "€/MWh·h", decimals: 0, agg: "sum", intraday: false, daily: zoneOnly((r, z) => r[z + "_negd"]) },
  par: { label: "Same price as Spain (% of time; spreads only)", short: "share of time at the same price", unit: "%", decimals: 1, agg: "mean", intraday: false, daily: (r, z) => (other(z) ? r["par_" + other(z)] : null) },
  split: { label: "Prices split from Spain (% of time; spreads only)", short: "share of time with split prices", unit: "%", decimals: 1, agg: "mean", intraday: false, daily: (r, z) => (other(z) && r["par_" + other(z)] != null ? 100 - r["par_" + other(z)] : null) }
};

export function esPriceExplorer(root) {
  return new TimeExplorer(root, {
    key: "es/prices/explorer",
    hero: ["Explore day-ahead prices,", "since 2015.", "Spanish, French and Portuguese day-ahead prices and the Spain–France and Spain–Portugal spreads, from 15 minutes to a year, against last year, the average and range of earlier years, a chosen year or another series. Spreads also show how often prices were equal or split."],
    firstDate: PRICE_FIRST, source: ENTSOE, fine: "15m",
    subjects: [...Object.keys(ZONES).map(z => ({ value: z, label: ZONES[z].name })), { value: "ESFR", label: "Spain minus France" }, { value: "ESPT", label: "Spain minus Portugal" }],
    subjectLabel: "Series", compareSubjects: true, compareLabel: "Another series…",
    measures: PRICE_MEASURES,
    defaults: { measure: "base", subject: "ES", cmp: "FR", preset: "last30", res: "1d" },
    loadDaily: getPricesDaily, events: marketEventsBetween,
    loadRaw: async (z, from, to) => {
      const o = other(z);
      if (!o) return (await getPriceRaw(z, from, to)).map(p => ({ t: p.t, v: p.eur, min: p.min }));
      const got = await Promise.all([getPriceRaw("ES", from, to), getPriceRaw(o, from, to)]);
      const q = new Map();
      for (const p of got.at(1)) for (let k = 0; k < Math.max(1, p.min / 15); k++) q.set(p.t + mul(k, QUARTER), p.eur);
      const out = [];
      for (const p of got.at(0)) for (let k = 0; k < Math.max(1, p.min / 15); k++) {
        const t = p.t + mul(k, QUARTER);
        if (q.has(t)) out.push({ t, v: p.eur - q.get(t), min: 15 });
      }
      return out;
    },
    isPeak, hasQuarters: t => t >= QH_SWITCH, step: true,
    quarterNote: "Day-ahead prices were hourly until 30 Sep 2025; earlier hourly prices are repeated across their four quarter-hours.",
    fmt: (v, m) => fmtByUnit(v, m),
    sentenceSubject: (m, subj) => (subj.startsWith("Spain minus") ? `the ${subj.replace("Spain minus ", "Spain–")} ${m.short}` : `${ZONES[Object.keys(ZONES).find(z => ZONES[z].name === subj)]?.adj || subj} day-ahead ${m.short}`),
    notes: () => ["Peak is Monday–Friday 08:00–20:00 local time (the market standard). Spreads are Spain minus the neighbour; positive means Spain was dearer. Same price: the two prices within €0.01/MWh, measured every 15 minutes. Spain and Portugal form the Iberian market (MIBEL) and usually clear at the same price."]
  });
}

// ---------- Spreads ----------

export class EsSpreads extends Base {
  constructor(root) {
    super(root, "prices/spreads", { preset: "last90", res: "1d", measure: "base" });
    root.innerHTML = `
      ${heroHtml("Spain against", "its neighbours.", "The gap between the Spanish day-ahead price and France's and Portugal's (Spain minus neighbour, so a positive spread means Spain was dearer), and how often the prices were identical or split.")}
      <div class="toolbar">${periodHtml(PRICE_FIRST)}
        ${selectHtml("res", "Resolution", [["1d", "Daily"], ["1w", "Weekly"], ["1M", "Monthly"]])}
        ${selectHtml("measure", "Price", [["base", "Baseload"], ["peak", "Peak"], ["off", "Off-peak"]])}</div>
      ${headlineBlock()}
      <div data-cards></div><div data-a></div><div data-b></div>`;
    this.wire();
    this.spreadPanel = new ChartPanel(root.querySelector("[data-a]"), { title: "Spread", size: "tall", overview: true, source: ENTSOE });
    this.parityPanel = new ChartPanel(root.querySelector("[data-b]"), { title: "Same price", size: "short", source: ENTSOE });
    this.panels = [this.spreadPanel, this.parityPanel];
  }

  async render(id) {
    const s = this.state;
    const daily = await getPricesDaily();
    if (id !== this.renderId) return;
    const dates = dateRange(s.from < PRICE_FIRST ? PRICE_FIRST : s.from, s.to).filter(d => daily.byDate.get(d)?.ES_base != null);
    if (!dates.length) throw new Error("no prices in this period");
    const key = d => (s.res === "1w" ? weekStart(d) : s.res === "1M" ? d.slice(0, 7) + "-01" : d);
    const stat = (z, ds) => {
      const sp = [];
      const par = [];
      for (const d of ds) {
        const r = daily.byDate.get(d);
        if (!r) continue;
        const a = r["ES_" + s.measure];
        const b = r[z + "_" + s.measure];
        if (a != null && b != null) sp.push(a - b);
        if (r["par_" + z] != null) par.push(r["par_" + z]);
      }
      return { spread: meanOf(sp), abs: meanOf(sp.map(Math.abs)), parity: meanOf(par) };
    };
    const lyDates = dates.map(d => addDays(d, -364));
    const stats = NEIGHBOURS.map(z => ({ z, now: stat(z, dates), ly: stat(z, lyDates) }));
    const series = NEIGHBOURS.map(z => {
      const acc = new Map();
      for (const d of dates) {
        const r = daily.byDate.get(d);
        const a = r["ES_" + s.measure];
        const b = r[z + "_" + s.measure];
        if (a == null || b == null) continue;
        if (!acc.has(key(d))) acc.set(key(d), []);
        acc.get(key(d)).push(a - b);
      }
      return { name: "Spain minus " + ZONES[z].name, colour: ZONES[z].colour, type: "line", width: 1.8, unit: "€/MWh", decimals: 2,
        data: [...acc.keys()].sort().map(k => [parisMidnight(k), meanOf(acc.get(k))]) };
    });
    const label = { base: "baseload", peak: "peak", off: "off-peak" }[s.measure];
    const span = fmtFromTo(dates.at(0), dates.at(-1));
    const fr = stats.at(0).now;
    const pt = stats.at(1).now;
    const parTxt = v => (v == null ? "–" : fmtNumber(v, 0) + "%");
    this.headline.textContent = `${span.at(0).toUpperCase() + span.slice(1)}, Spanish ${label} prices were ${eur(Math.abs(fr.spread))}/MWh ${fr.spread >= 0 ? "above" : "below"} France's on average and equal to them ${parTxt(fr.parity)} of the time; Spain and Portugal cleared at the same price ${parTxt(pt.parity)} of the time and split ${parTxt(pt.parity == null ? null : 100 - pt.parity)}.`;
    this.root.querySelector("[data-cards]").innerHTML = cards(stats.flatMap(x => [
      card(`Spain minus ${ZONES[x.z].name}`, gap(x.now.spread), `Average gap ${eur(x.now.abs)} · last year ${gap(x.ly.spread)}`),
      card(`Same price as ${ZONES[x.z].name}`, x.now.parity != null ? fmtNumber(x.now.parity, 1) + "%" : "–", x.now.parity != null && x.ly.parity != null ? `${signed(x.now.parity - x.ly.parity, v => fmtNumber(v, 1) + " pp")} on the same dates last year` : "", x.z === "PT" ? " accent" : ""),
      card(`Split from ${ZONES[x.z].name}`, x.now.parity != null ? fmtNumber(100 - x.now.parity, 1) + "%" : "–", "Share of time the prices differed")
    ]));
    this.spreadPanel.setTitle(`Spain minus each neighbour, ${label} price`, `${fmtPeriod(dates.at(0), dates.at(-1))} · €/MWh · positive = Spain dearer`);
    this.spreadPanel.render({
      xType: "time", xLabel: s.res === "1M" ? fmtMonth : s.res === "1w" ? x => `Week of ${fmtDate(x)}` : fmtDate, axisLabel: s.res === "1M" ? fmtMonth : undefined,
      xHeader: "Date", yName: "€/MWh", series, zeroLine: true, source: ENTSOE,
      notes: [s.res !== "1d" ? "Each point is the average of the daily spreads in that period." : ""].filter(Boolean)
    });
    const months = [...new Set(dates.map(d => d.slice(0, 7)))];
    this.parityPanel.setTitle("Share of time at the same price as Spain, by month", `${fmtPeriod(dates.at(0), dates.at(-1))} · % of quarter-hours (the rest is split)`);
    this.parityPanel.render({
      xType: "category", categories: months.map(m => fmtMonth(parisMidnight(m + "-01"))), xLabel: x => x, xHeader: "Month", yName: "%", yMin: 0, yScale: false, source: ENTSOE,
      series: NEIGHBOURS.map(z => ({ name: ZONES[z].name, colour: ZONES[z].colour, type: months.length > 18 ? "line" : "bar", barWidth: 8, unit: "%", decimals: 1,
        data: months.map((m, i) => [i, meanOf(dates.filter(d => d.startsWith(m)).map(d => daily.byDate.get(d)["par_" + z]))]) })),
      notes: ["Same price: the Spanish and neighbouring day-ahead prices within €0.01/MWh, measured every 15 minutes (hourly prices before 30 Sep 2025 repeated). Split is the rest of the time, usually because the interconnector was full."]
    });
  }
}
