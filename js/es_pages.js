// Spain pages: Overview, Demand, Prices, Generation and Flows. They follow
// the France pages: explorers use the shared TimeExplorer; the Today tabs are
// smaller views with a headline, cards and charts.
// Code note: no asterisks here (chat formatting strips them when pasted), so
// multiplication is written with mul().
import { ChartPanel } from "./chart.js";
import { marketEventsBetween } from "./events.js";
import { bindPeriod, card, periodHtml } from "./market-common.js";
import { QH_SWITCH, fmtByUnit, isPeak } from "./market-data.js";
import { TimeExplorer } from "./time-explorer.js";
import {
  QUARTER, addDays, copyText, dateKey, daysBetween, fmtDateTime, fmtFromTo, fmtLongDate, fmtNumber, fmtPct, fmtPeriod,
  fmtTime, heroHtml, parisMidnight, toWall, todayParis, writeHash
} from "./util.js";
import {
  ENTSOE, ES_FIRST, FUELS, REE, RENEWABLE, ZONES, fuelValue, getDemandDaily, getDemandRaw, getFlowsDaily, getFlowsRaw,
  getMixDaily, getMixRaw, getPriceRaw, getPricesDaily, mul, totalGen
} from "./es-data.js";

const GW = v => (v == null || !Number.isFinite(v) ? "–" : fmtNumber(v / 1000, 1) + " GW");
const EUR = v => (v == null || !Number.isFinite(v) ? "–" : "€" + fmtNumber(v, 2) + "/MWh");
const signed = (v, f) => (v == null || !Number.isFinite(v) ? "–" : (v >= 0 ? "+" : "−") + f(Math.abs(v)));
const meanOf = vs => { const f = vs.filter(v => v != null && Number.isFinite(v)); return f.length ? f.reduce((a, b) => a + b, 0) / f.length : null; };
const cards = list => `<div class="es-cards">${list.join("")}</div>`;
const linkCard = (href, html) => `<a class="es-card-link" href="${href}">${html}</a>`;

function headlineBlock() {
  return `<div class="headline es-headline"><p data-headline>Loading…</p><button class="btn ghost small" type="button" data-copy>Copy</button></div>`;
}
function wireHeadline(root) {
  const h = root.querySelector("[data-headline]");
  root.querySelector("[data-copy]").addEventListener("click", () => copyText(h.textContent));
  return h;
}
function localHour(t) {
  const w = new Date(toWall(t));
  return w.getUTCHours() + w.getUTCMinutes() / 60;
}
// Average of col over rows of day d up to the same time of day as cutoff.
function avgUpTo(rows, col, day, offset) {
  const start = parisMidnight(day);
  return meanOf(rows.filter(r => r.t >= start && r.t - start <= offset).map(r => r[col]));
}

// ======================================================================
// Overview
// ======================================================================

export class EsOverview {
  constructor(root) {
    this.root = root;
    root.innerHTML = `
      ${heroHtml("Spain today,", "at a glance.", "The latest demand, prices, generation and cross-border flows for mainland Spain. Click a card to open the data.")}
      ${headlineBlock()}
      <div data-cards></div>
      <div data-chart></div>`;
    this.headline = wireHeadline(root);
    this.panel = new ChartPanel(root.querySelector("[data-chart]"), { title: "Day-ahead baseload prices", size: "short", source: ENTSOE });
  }

  async activate() {
    try {
      const today = todayParis();
      const [dem, mix, flows, es, esY, fr, pt, daily] = await Promise.all([
        getDemandRaw(addDays(today, -1), today), getMixRaw(today, today), getFlowsRaw(today, today),
        getPriceRaw("ES", today, addDays(today, 1)), getPriceRaw("ES", addDays(today, -1), addDays(today, -1)),
        getPriceRaw("FR", today, today), getPriceRaw("PT", today, today), getPricesDaily()
      ]);
      const lyDem = await getDemandRaw(addDays(today, -364), addDays(today, -364));
      const last = [...dem].reverse().find(r => r.actual != null);
      const lyAt = last ? lyDem.find(r => r.t === last.t - mul(364, 86400000)) : null;
      const base = (rows, d) => meanOf(rows.filter(r => dateKey(r.t) === d).map(r => r.eur));
      const bToday = base(es, today);
      const bYest = base(esY, addDays(today, -1));
      const bTom = base(es, addDays(today, 1));
      const bFr = base(fr, today);
      const bPt = base(pt, today);
      const gen = mix.filter(r => r.wind != null);
      const ren = gen.length ? meanOf(gen.map(r => { const tot = totalGen(r); return tot ? 100 / tot / (1 / RENEWABLE.reduce((a, f) => a + (fuelValue(r, f) || 0), 0)) : null; })) : null;
      const solar = meanOf(gen.map(r => fuelValue(r, "solar_pv")));
      const wind = meanOf(gen.map(r => r.wind));
      const net = meanOf(flows.map(r => r.net));
      this.root.querySelector("[data-cards]").innerHTML = cards([
        linkCard("#es/demand/today", card("Demand now", last ? GW(last.actual) : "–", last ? `at ${fmtTime(last.t)}${lyAt?.actual ? ", " + fmtPct(100 / lyAt.actual / (1 / (last.actual - lyAt.actual)), 1) + " on last year" : ""}` : "")),
        linkCard("#es/prices/short", card("Baseload today", EUR(bToday), bYest != null && bToday != null ? signed(bToday - bYest, v => "€" + fmtNumber(v, 2)) + " on yesterday" : "", " accent")),
        linkCard("#es/prices/short", card("Baseload tomorrow", EUR(bTom), bTom == null ? "Published after the auction, around 13:00" : "")),
        linkCard("#es/prices/spreads", card("Spain minus France", bToday != null && bFr != null ? signed(bToday - bFr, v => "€" + fmtNumber(v, 2)) : "–", "Baseload today")),
        linkCard("#es/prices/spreads", card("Spain minus Portugal", bToday != null && bPt != null ? signed(bToday - bPt, v => "€" + fmtNumber(v, 2)) : "–", "Baseload today")),
        linkCard("#es/generation/today", card("Renewable share", ren != null ? fmtNumber(ren, 1) + "%" : "–", "Of generation today so far")),
        linkCard("#es/generation/today", card("Wind and solar", wind != null ? GW(wind + (solar || 0)) : "–", `Wind ${GW(wind)}, solar ${GW(solar)} on average today`)),
        linkCard("#es/flows/today", card("Net exports", GW(net), "Average today; negative means net imports"))
      ]);
      const parts = [];
      if (bToday != null) parts.push(`Spanish day-ahead baseload is ${EUR(bToday)} today${bYest != null ? `, ${signed(bToday - bYest, v => "€" + fmtNumber(v, 2))} on yesterday` : ""}${bFr != null ? `, ${bToday <= bFr ? "below" : "above"} France at ${EUR(bFr)}` : ""}.`);
      if (bTom != null) parts.push(`Tomorrow's auction cleared at ${EUR(bTom)}.`);
      if (ren != null) parts.push(`Renewables have supplied ${fmtNumber(ren, 1)}% of generation so far today.`);
      if (last) parts.push(`Demand was ${GW(last.actual)} at ${fmtTime(last.t)}.`);
      this.headline.textContent = parts.join(" ") || "No data yet today.";
      const from = addDays(today, -29);
      const rows = daily.rows.filter(r => r.date >= from && r.date <= addDays(today, 1));
      this.panel.setTitle("Day-ahead baseload prices, last 30 days", "€/MWh, daily");
      this.panel.render({
        xType: "time", xLabel: x => fmtLongDate(dateKey(x)), yName: "€/MWh", source: ENTSOE, zeroLine: true,
        series: Object.keys(ZONES).map(z => ({
          name: ZONES[z].name, colour: ZONES[z].colour, type: "line", unit: "€/MWh", decimals: 2, width: z === "ES" ? 2.4 : 1.5,
          data: rows.filter(r => r[z + "_base"] != null).map(r => [parisMidnight(r.date), r[z + "_base"]])
        }))
      });
    } catch (error) {
      console.error(error);
      this.headline.textContent = `The data could not be loaded (${error.message}).`;
    }
  }

  refreshTheme() { this.panel.refreshTheme(); }
}

// ======================================================================
// Demand
// ======================================================================

export class EsDemandToday {
  constructor(root) {
    this.root = root;
    this.writesHash = true;
    this.state = { days: "2" };
    root.innerHTML = `
      ${heroHtml("Spanish demand,", "right now.", "Mainland demand every 15 minutes from REE (averaged from its 5-minute data), against REE's forecast and the same weekday last year.")}
      <div class="toolbar"><label class="field"><span>Chart shows</span><select data-days><option value="1">Today</option><option value="2">Yesterday and today</option><option value="7">Last 7 days</option></select></label></div>
      ${headlineBlock()}
      <div data-cards></div>
      <div data-chart></div>`;
    this.headline = wireHeadline(root);
    root.querySelector("[data-days]").addEventListener("change", e => { this.state.days = e.target.value; this.activate(); });
    this.panel = new ChartPanel(root.querySelector("[data-chart]"), { title: "Demand", size: "tall", source: REE });
  }

  setParams(p) { if (p.has("days")) this.state.days = p.get("days"); }

  async activate() {
    writeHash("es/demand/today", this.state);
    this.root.querySelector("[data-days]").value = this.state.days;
    try {
      const today = todayParis();
      const from = addDays(today, 1 - Number(this.state.days));
      const rows = await getDemandRaw(from, addDays(today, 1));
      const ly = await getDemandRaw(addDays(from, -364), addDays(today, -363));
      const last = [...rows].reverse().find(r => r.actual != null);
      if (!last) throw new Error("no demand data yet");
      const day = dateKey(last.t);
      const offset = last.t - parisMidnight(day);
      const dayRows = rows.filter(r => dateKey(r.t) === day);
      const peak = dayRows.filter(r => r.actual != null).reduce((m, r) => (!m || r.actual > m.actual ? r : m), null);
      const fPeak = dayRows.filter(r => r.forecast != null).reduce((m, r) => (!m || r.forecast > m.forecast ? r : m), null);
      const avgNow = avgUpTo(rows, "actual", day, offset);
      const avgLy = avgUpTo(ly, "actual", addDays(day, -364), offset);
      const pct = avgNow != null && avgLy ? 100 / avgLy / (1 / (avgNow - avgLy)) : null;
      const tomorrow = meanOf(rows.filter(r => dateKey(r.t) === addDays(today, 1)).map(r => r.forecast));
      const miss = last.forecast != null ? last.actual - last.forecast : null;
      this.root.querySelector("[data-cards]").innerHTML = cards([
        card("Latest demand", GW(last.actual), `at ${fmtTime(last.t)}`, " accent"),
        card("Against REE's forecast", signed(miss, v => fmtNumber(v / 1000, 2) + " GW"), "Actual minus forecast, latest quarter-hour"),
        card(day === today ? "Peak so far today" : "Peak", peak ? GW(peak.actual) : "–", peak ? `at ${fmtTime(peak.t)}` : ""),
        card("Forecast peak", fPeak ? GW(fPeak.forecast) : "–", fPeak ? `at ${fmtTime(fPeak.t)}` : ""),
        card("Average so far", GW(avgNow), pct != null ? `${fmtPct(pct, 1)} on the same hours last year` : ""),
        card("Tomorrow (forecast)", GW(tomorrow), "Average of REE's forecast")
      ]);
      this.headline.textContent = `Spanish mainland demand averaged ${GW(avgNow)} ${day === today ? "today" : "on " + fmtLongDate(day)} to ${fmtTime(last.t + QUARTER)}${pct != null ? `, ${fmtNumber(Math.abs(pct), 1)}% ${pct >= 0 ? "above" : "below"} the same hours on the same weekday last year` : ""}. ${peak ? `It peaked at ${GW(peak.actual)} at ${fmtTime(peak.t)}.` : ""}`.trim();
      const shift = mul(364, 86400000);
      this.panel.setTitle("Demand every 15 minutes", `${fmtPeriod(from, addDays(today, 1))} · GW`);
      this.panel.render({
        xType: "time", xLabel: fmtDateTime, yName: "GW", source: REE,
        markAreas: [{ from: parisMidnight(today), to: parisMidnight(addDays(today, 1)), label: "Today", colour: "--today" }],
        series: [
          { name: "Same weekday last year", colour: "--s-ly", type: "line", width: 1.4, unit: "GW", decimals: 2, data: ly.filter(r => r.actual != null).map(r => [r.t + shift, r.actual / 1000]) },
          { name: "REE forecast", colour: "--s-d1", type: "line", dashed: true, width: 1.6, unit: "GW", decimals: 2, data: rows.filter(r => r.forecast != null).map(r => [r.t, r.forecast / 1000]) },
          { name: "Actual", colour: "--s-actual", type: "line", width: 2.6, z: 20, unit: "GW", decimals: 2, data: rows.filter(r => r.actual != null).map(r => [r.t, r.actual / 1000]) }
        ],
        notes: ["Mainland Spain (the Peninsula); the Balearic and Canary Islands, Ceuta and Melilla are not included."]
      });
    } catch (error) {
      console.error(error);
      this.headline.textContent = `Demand data could not be loaded (${error.message}).`;
    }
  }

  refreshTheme() { this.panel.refreshTheme(); }
}

export function esDemandExplorer(root) {
  const m = (label, short, daily, extra = {}) => ({ label, short, unit: "GW", scale: 1000, decimals: 2, agg: "mean", daily, ...extra });
  return new TimeExplorer(root, {
    key: "es/demand/explorer",
    hero: ["Explore Spanish demand,", "since 2015.", "Mainland demand from REE at any resolution from 15 minutes to a year, against last year, the average and range of earlier years, a chosen year or REE's forecast. Switch to a daily profile or a duration curve, or show the difference."],
    firstDate: ES_FIRST, source: REE, fine: "15m",
    subjects: [{ value: "actual", label: "Actual demand" }, { value: "forecast", label: "REE forecast" }],
    subjectLabel: "Series", compareSubjects: true, compareLabel: "Another series…",
    measures: {
      mean: m("Average demand", "average demand", (r, k) => (k === "forecast" ? r.forecast_mean : r.mean)),
      peak: m("Daily peak", "daily peak", (r, k) => (k === "actual" ? r.peak : null), { agg: "max", intraday: false }),
      min: m("Daily minimum", "daily minimum", (r, k) => (k === "actual" ? r.minimum : null), { agg: "min", intraday: false }),
      energy: { label: "Energy (GWh)", short: "energy", unit: "GWh", decimals: 0, agg: "sum", intraday: false, daily: (r, k) => (k === "actual" ? r.energy_gwh : null) }
    },
    defaults: { measure: "mean", subject: "actual", preset: "last30", res: "1d" },
    loadDaily: getDemandDaily,
    loadRaw: async (k, from, to) => (await getDemandRaw(from, to)).map(p => ({ t: p.t, v: p[k], min: 15 })),
    hasQuarters: () => true,
    fmt: (v, mm) => fmtByUnit(v, mm),
    sentenceSubject: (mm, subj) => (subj === "REE forecast" ? `REE's forecast ${mm.short}` : `Spanish ${mm.short}`),
    notes: () => ["Mainland Spain. Daily figures need at least 20 hours of data."]
  });
}

export class EsDemandAccuracy {
  constructor(root) {
    this.root = root;
    this.writesHash = true;
    this.state = { preset: "last30", from: "", to: "" };
    root.innerHTML = `
      ${heroHtml("How good is", "REE's forecast?", "REE's demand forecast against actual demand every 15 minutes: the average miss (MAE), the miss as a share of demand (MAPE) and the bias (forecast minus actual).")}
      <div class="toolbar">${periodHtml(ES_FIRST)}</div>
      ${headlineBlock()}
      <div data-cards></div>
      <div data-daily></div>
      <div data-hours></div>`;
    this.headline = wireHeadline(root);
    this.period = bindPeriod(root, this.state, () => this.activate());
    this.dailyPanel = new ChartPanel(root.querySelector("[data-daily]"), { title: "Daily forecast error", size: "short", source: REE });
    this.hourPanel = new ChartPanel(root.querySelector("[data-hours]"), { title: "Error by hour of day", size: "short", source: REE });
  }

  setParams(p) { for (const k of Object.keys(this.state)) if (p.has(k)) this.state[k] = p.get(k); }

  async activate() {
    if (this.state.preset !== "custom") this.period.apply(); else this.period.sync();
    writeHash("es/demand/accuracy", this.state);
    try {
      let from = this.state.from;
      const to = this.state.to < todayParis() ? this.state.to : todayParis();
      const notes = [];
      if (daysBetween(from, to) > 400) { from = addDays(to, -399); notes.push(`At most 400 days are compared, so this shows ${fmtPeriod(from, to)}.`); }
      const rows = (await getDemandRaw(from, to)).filter(r => r.actual != null && r.forecast != null);
      if (!rows.length) throw new Error("no matching forecasts and actuals for this period");
      const byDay = new Map();
      const byHour = Array.from({ length: 24 }, () => ({ abs: 0, n: 0 }));
      let abs = 0; let err = 0; let pct = 0;
      for (const r of rows) {
        const e = r.forecast - r.actual;
        abs += Math.abs(e); err += e; pct += Math.abs(e) / r.actual;
        const d = dateKey(r.t);
        if (!byDay.has(d)) byDay.set(d, { abs: 0, err: 0, pct: 0, n: 0 });
        const a = byDay.get(d);
        a.abs += Math.abs(e); a.err += e; a.pct += Math.abs(e) / r.actual; a.n += 1;
        const h = byHour[Math.floor(localHour(r.t))];
        h.abs += Math.abs(e); h.n += 1;
      }
      const n = rows.length;
      const days = [...byDay.entries()].map(e => ({ d: e.at(0), mae: e.at(1).abs / e.at(1).n, bias: e.at(1).err / e.at(1).n, mape: 100 / e.at(1).n / (1 / e.at(1).pct) }));
      const worst = days.reduce((m, x) => (!m || x.mae > m.mae ? x : m), null);
      const mape = 100 / n / (1 / pct);
      this.root.querySelector("[data-cards]").innerHTML = cards([
        card("MAE", fmtNumber(abs / n / 1000, 2) + " GW", "Average size of the miss", " accent"),
        card("MAPE", fmtNumber(mape, 2) + "%", "Miss as a share of demand"),
        card("Bias", signed(err / n, v => fmtNumber(v / 1000, 2) + " GW"), err >= 0 ? "REE over-forecast on average" : "REE under-forecast on average"),
        card("Biggest daily miss", worst ? fmtNumber(worst.mae / 1000, 2) + " GW" : "–", worst ? fmtLongDate(worst.d) : "")
      ]);
      this.headline.textContent = `REE's forecast missed mainland demand by ${fmtNumber(abs / n / 1000, 2)} GW (${fmtNumber(mape, 2)}%) on average ${fmtFromTo(from, to)}, and ${err >= 0 ? "over" : "under"}-forecast by ${fmtNumber(Math.abs(err / n) / 1000, 2)} GW on balance.`;
      this.dailyPanel.setTitle("Daily forecast error", `${fmtPeriod(from, to)} · GW and %`);
      this.dailyPanel.render({
        xType: "time", xLabel: x => fmtLongDate(dateKey(x)), yName: "GW", yAxis2: { name: "%", format: v => fmtNumber(v, 1) }, source: REE, zeroLine: true,
        series: [
          { name: "MAE", colour: "--s-actual", type: "line", width: 2.2, unit: "GW", decimals: 2, data: days.map(x => [parisMidnight(x.d), x.mae / 1000]) },
          { name: "Bias", colour: "--s-d1", type: "bar", unit: "GW", decimals: 2, data: days.map(x => [parisMidnight(x.d), x.bias / 1000]), colourFn: v => (v >= 0 ? "--s-d1" : "--s-ly") },
          { name: "MAPE", colour: "--s-id", type: "line", dashed: true, width: 1.4, yAxis: 1, unit: "%", decimals: 2, data: days.map(x => [parisMidnight(x.d), x.mape]) }
        ],
        notes: [...notes, "Error is forecast minus actual, compared every 15 minutes. REE revises its forecast during the day; the stored value is the latest one published for each quarter-hour."]
      });
      this.hourPanel.setTitle("Average miss by hour of day", `${fmtPeriod(from, to)} · GW, local time`);
      this.hourPanel.render({
        xType: "category", categories: byHour.map((x, h) => String(h).padStart(2, "0") + ":00"), xLabel: x => x, xHeader: "Hour", yName: "GW", source: REE,
        series: [{ name: "MAE", colour: "--s-actual", type: "bar", unit: "GW", decimals: 2, avg: false, data: byHour.map((x, h) => [h, x.n ? x.abs / x.n / 1000 : null]) }]
      });
    } catch (error) {
      console.error(error);
      this.headline.textContent = `The comparison could not be made (${error.message}).`;
    }
  }

  refreshTheme() { this.dailyPanel.refreshTheme(); this.hourPanel.refreshTheme(); }
}

// ======================================================================
// Prices
// ======================================================================

const zoneSubjects = Object.keys(ZONES).map(z => ({ value: z, label: ZONES[z].name }));
const pm = (key, label, short, extra = {}) => ({ label, short, unit: "€/MWh", decimals: 2, agg: "mean", zeroLine: true, daily: (r, z) => r[z + "_" + key], ...extra });
const PRICE_MEASURES = {
  base: pm("base", "Baseload price", "baseload price"),
  peak: pm("peak", "Peak price (Mon–Fri 08:00–20:00)", "peak price", { peak: "peak" }),
  off: pm("off", "Off-peak price", "off-peak price", { peak: "off" }),
  min: pm("min", "Lowest price in each day", "lowest price", { agg: "min", intraday: false }),
  max: pm("max", "Highest price in each day", "highest price", { agg: "max", intraday: false }),
  range: { label: "Daily price range (high minus low)", short: "daily price range", unit: "€/MWh", decimals: 2, agg: "mean", intraday: false, daily: (r, z) => (r[z + "_max"] != null && r[z + "_min"] != null ? r[z + "_max"] - r[z + "_min"] : null) },
  std: { label: "Volatility (standard deviation within the day)", short: "intraday volatility", unit: "€/MWh", decimals: 2, agg: "mean", intraday: false, daily: (r, z) => r[z + "_std"] },
  neg: { label: "Hours with negative prices", short: "negative-price hours", unit: "h", decimals: 2, agg: "sum", intraday: false, daily: (r, z) => r[z + "_neg"] },
  zero: { label: "Hours at zero", short: "zero-price hours", unit: "h", decimals: 2, agg: "sum", intraday: false, daily: (r, z) => r[z + "_zero"] },
  negd: { label: "Negative-price depth (€/MWh·h)", short: "negative-price depth", unit: "€/MWh·h", decimals: 0, agg: "sum", intraday: false, daily: (r, z) => r[z + "_negd"] }
};

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
    writeHash("es/prices/short", this.state);
    try {
      const today = todayParis();
      let day = this.state.day === "tomorrow" ? addDays(today, 1) : today;
      let es = await getPriceRaw("ES", day, day);
      let note = "";
      if (!es.length && day !== today) { note = "Tomorrow's prices are not published yet, so today is shown. "; day = today; es = await getPriceRaw("ES", day, day); }
      this.root.querySelectorAll("[data-day]").forEach(b => b.setAttribute("aria-pressed", String((b.dataset.day === "tomorrow") === (day !== today))));
      const prev = addDays(day, -1);
      const [esPrev, fr, pt] = await Promise.all([getPriceRaw("ES", prev, prev), getPriceRaw("FR", prev, day), getPriceRaw("PT", prev, day)]);
      if (!es.length) throw new Error("no prices for this day yet");
      const vals = es.map(r => r.eur);
      const base = meanOf(vals);
      const basePrev = meanOf(esPrev.map(r => r.eur));
      const peakVals = es.filter(r => isPeak(r.t)).map(r => r.eur);
      const offVals = es.filter(r => !isPeak(r.t)).map(r => r.eur);
      const lo = es.reduce((m, r) => (!m || r.eur < m.eur ? r : m), null);
      const hi = es.reduce((m, r) => (!m || r.eur > m.eur ? r : m), null);
      const negH = es.filter(r => r.eur < 0).reduce((a, r) => a + r.min / 60, 0);
      const zeroH = es.filter(r => r.eur === 0).reduce((a, r) => a + r.min / 60, 0);
      const ofDay = (rows, d) => rows.filter(r => dateKey(r.t) === d);
      const frB = meanOf(ofDay(fr, day).map(r => r.eur));
      const ptB = meanOf(ofDay(pt, day).map(r => r.eur));
      const ptMap = new Map(ofDay(pt, day).map(r => [r.t, r.eur]));
      const both = es.filter(r => ptMap.has(r.t));
      const parity = both.length ? 100 / both.length / (1 / both.filter(r => Math.abs(r.eur - ptMap.get(r.t)) < 0.01).length) : null;
      const label = day === today ? "today" : "tomorrow";
      this.root.querySelector("[data-cards]").innerHTML = cards([
        card("Baseload " + label, EUR(base), basePrev != null ? signed(base - basePrev, v => "€" + fmtNumber(v, 2)) + " on the day before" : "", " accent"),
        card("Peak", EUR(meanOf(peakVals)), peakVals.length ? "Mon–Fri 08:00–20:00" : "Weekend: no peak period"),
        card("Off-peak", EUR(meanOf(offVals)), ""),
        card("Lowest", lo ? EUR(lo.eur) : "–", lo ? `at ${fmtTime(lo.t)}` : ""),
        card("Highest", hi ? EUR(hi.eur) : "–", hi ? `at ${fmtTime(hi.t)}` : ""),
        card("Negative-price hours", fmtNumber(negH, 2) + " h", zeroH ? `plus ${fmtNumber(zeroH, 2)} h at zero` : "Below zero"),
        card("Spain minus France", frB != null ? signed(base - frB, v => "€" + fmtNumber(v, 2)) : "–", frB != null ? "France " + EUR(frB) : "No French price yet"),
        card("Spain minus Portugal", ptB != null ? signed(base - ptB, v => "€" + fmtNumber(v, 2)) : "–", parity != null ? `Same price ${fmtNumber(parity, 0)}% of the time` : "")
      ]);
      this.headline.textContent = `${note}The Spanish day-ahead baseload ${day === today ? "is" : "for tomorrow is"} ${EUR(base)}${basePrev != null ? `, ${signed(base - basePrev, v => "€" + fmtNumber(v, 2))} on the day before` : ""}. Prices range from ${lo ? EUR(lo.eur) : "–"} at ${lo ? fmtTime(lo.t) : "–"} to ${hi ? EUR(hi.eur) : "–"} at ${hi ? fmtTime(hi.t) : "–"}${negH ? `, with ${fmtNumber(negH, 2)} hours below zero` : ""}.`;
      const all = await getPriceRaw("ES", prev, day);
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

export function esPriceExplorer(root) {
  return new TimeExplorer(root, {
    key: "es/prices/explorer",
    hero: ["Explore day-ahead prices,", "since 2015.", "Spanish, French and Portuguese day-ahead prices at any resolution from 15 minutes to a year, against last year, the average and range of earlier years, a chosen year or another country."],
    firstDate: "2015-01-05", source: ENTSOE, fine: "15m",
    subjects: zoneSubjects, subjectLabel: "Bidding zone", compareSubjects: true, compareLabel: "Another zone…",
    measures: PRICE_MEASURES,
    defaults: { measure: "base", subject: "ES", cmp: "FR", preset: "last30", res: "1d" },
    loadDaily: getPricesDaily, events: marketEventsBetween,
    loadRaw: async (z, from, to) => (await getPriceRaw(z, from, to)).map(p => ({ t: p.t, v: p.eur, min: p.min })),
    isPeak, hasQuarters: t => t >= QH_SWITCH, step: true,
    quarterNote: "Day-ahead prices were hourly until 30 Sep 2025; earlier hourly prices are repeated across their four quarter-hours.",
    fmt: (v, m) => fmtByUnit(v, m),
    sentenceSubject: (m, subj) => `${subj === "Spain" ? "Spanish" : subj === "France" ? "French" : "Portuguese"} day-ahead ${m.short}`,
    notes: () => ["Peak is Monday–Friday 08:00–20:00 local time (the market standard); off-peak is every other period. Spain and Portugal form the Iberian market (MIBEL) and often clear at the same price."]
  });
}

export function esSpreadExplorer(root) {
  const sm = (key, label, short, extra = {}) => ({ label, short, unit: "€/MWh", decimals: 2, agg: "mean", zeroLine: true, daily: (r, z) => (r["ES_" + key] != null && r[z + "_" + key] != null ? r["ES_" + key] - r[z + "_" + key] : null), ...extra });
  return new TimeExplorer(root, {
    key: "es/prices/spreads",
    hero: ["Spain against", "its neighbours.", "The Spanish day-ahead price minus the French or Portuguese price: positive means Spain was dearer. At any resolution from 15 minutes to a year, against earlier years."],
    firstDate: "2015-01-05", source: ENTSOE, fine: "15m",
    subjects: [{ value: "FR", label: "Spain minus France" }, { value: "PT", label: "Spain minus Portugal" }],
    subjectLabel: "Spread", compareSubjects: true, compareLabel: "The other spread…",
    measures: {
      base: sm("base", "Baseload spread", "baseload spread"),
      peak: sm("peak", "Peak spread", "peak spread", { peak: "peak" }),
      off: sm("off", "Off-peak spread", "off-peak spread", { peak: "off" })
    },
    defaults: { measure: "base", subject: "FR", preset: "last90", res: "1w" },
    loadDaily: getPricesDaily, events: marketEventsBetween,
    loadRaw: async (z, from, to) => {
      const [es, other] = await Promise.all([getPriceRaw("ES", from, to), getPriceRaw(z, from, to)]);
      const q = new Map();
      for (const p of other) for (let k = 0; k < Math.max(1, p.min / 15); k++) q.set(p.t + mul(k, QUARTER), p.eur);
      const out = [];
      for (const p of es) for (let k = 0; k < Math.max(1, p.min / 15); k++) {
        const t = p.t + mul(k, QUARTER);
        if (q.has(t)) out.push({ t, v: p.eur - q.get(t), min: 15 });
      }
      return out;
    },
    isPeak, hasQuarters: t => t >= QH_SWITCH, step: true,
    fmt: (v, m) => fmtByUnit(v, m),
    sentenceSubject: (m, subj) => (subj === "Spain minus France" ? "the Spain–France " : "the Spain–Portugal ") + m.short,
    notes: () => ["Spread is Spain minus the neighbour; positive means Spain was dearer. When the interconnector is not congested, the two prices are equal and the spread is zero."]
  });
}

// ======================================================================
// Generation
// ======================================================================

export class EsGenToday {
  constructor(root) {
    this.root = root;
    this.writesHash = true;
    this.state = { days: "2" };
    root.innerHTML = `
      ${heroHtml("Spanish generation,", "right now.", "Mainland output by technology every 15 minutes from REE's real-time data, today so far against the same hours on the same weekday last year.")}
      <div class="toolbar"><label class="field"><span>Chart shows</span><select data-days><option value="1">Today</option><option value="2">Yesterday and today</option><option value="7">Last 7 days</option></select></label></div>
      ${headlineBlock()}
      <div data-cards></div>
      <div data-chart></div>
      <div data-share></div>`;
    this.headline = wireHeadline(root);
    root.querySelector("[data-days]").addEventListener("change", e => { this.state.days = e.target.value; this.activate(); });
    this.panel = new ChartPanel(root.querySelector("[data-chart]"), { title: "Generation mix", size: "tall", source: REE });
    this.sharePanel = new ChartPanel(root.querySelector("[data-share]"), { title: "Shares", size: "short", source: REE });
  }

  setParams(p) { if (p.has("days")) this.state.days = p.get("days"); }

  async activate() {
    writeHash("es/generation/today", this.state);
    this.root.querySelector("[data-days]").value = this.state.days;
    try {
      const today = todayParis();
      const from = addDays(today, 1 - Number(this.state.days));
      const mix = (await getMixRaw(from, today)).filter(r => r.wind != null);
      if (!mix.length) throw new Error("no generation data yet");
      const lastT = mix[mix.length - 1].t;
      const day = dateKey(lastT);
      const offset = lastT - parisMidnight(day);
      const rows = mix.filter(r => dateKey(r.t) === day);
      const ly = (await getMixRaw(addDays(day, -364), addDays(day, -364))).filter(r => r.wind != null && r.t - parisMidnight(addDays(day, -364)) <= offset);
      const label = day === today ? "today" : "yesterday";
      const main = ["nuclear", "wind", "solar_pv", "hydro", "ccgt", "chp_other"];
      const changes = [];
      const cardsA = main.map(f => {
        const a = meanOf(rows.map(r => fuelValue(r, f)));
        const b = meanOf(ly.map(r => fuelValue(r, f)));
        const pct = a != null && b ? 100 / b / (1 / (a - b)) : null;
        if (pct != null && Math.max(a, b) >= 1000) changes.push({ f, a, b, pct });
        return card(FUELS.find(x => x.value === f).label, GW(a), b != null ? `${fmtPct(pct, 0)} vs ${GW(b)} last year` : "");
      });
      const share = (list, set) => { const tot = list.reduce((s, r) => s + totalGen(r), 0); return tot ? 100 / tot / (1 / list.reduce((s, r) => s + set.reduce((x, f) => x + (fuelValue(r, f) || 0), 0), 0)) : null; };
      const ren = share(rows, RENEWABLE);
      const renLy = share(ly, RENEWABLE);
      const vre = share(rows, ["wind", "solar_pv", "solar_thermal"]);
      const fossil = share(rows, ["ccgt", "coal", "fuel_gas", "chp_other"]);
      const pp = (a, b) => (a != null && b != null ? `${a - b >= 0 ? "+" : "−"}${fmtNumber(Math.abs(a - b), 1)} pp vs last year` : "");
      this.root.querySelector("[data-cards]").innerHTML = cards([
        ...cardsA,
        card("Renewable share", ren != null ? fmtNumber(ren, 1) + "%" : "–", pp(ren, renLy), " accent"),
        card("Wind and solar share", vre != null ? fmtNumber(vre, 1) + "%" : "–", ""),
        card("Fossil share", fossil != null ? fmtNumber(fossil, 1) + "%" : "–", "Gas, coal, fuel-gas and cogeneration")
      ]);
      changes.sort((x, y) => Math.abs(y.pct) - Math.abs(x.pct));
      const top = changes.at(0);
      const name = f => FUELS.find(x => x.value === f).label.toLowerCase();
      let text = top ? `Spanish ${name(top.f)} output averaged ${GW(top.a)} ${label} to ${fmtTime(lastT + QUARTER)}, ${fmtNumber(Math.abs(top.pct), 0)}% ${top.pct >= 0 ? "above" : "below"} the same hours on the same weekday last year (${GW(top.b)}).` : "";
      if (ren != null) text += ` Renewables supplied ${fmtNumber(ren, 1)}% of generation${renLy != null ? `, against ${fmtNumber(renLy, 1)}% a year earlier` : ""}.`;
      this.headline.textContent = text.trim();
      const used = FUELS.filter(f => mix.some(r => (fuelValue(r, f.value) || 0) > 0));
      this.panel.setTitle("Generation by technology, every 15 minutes", `${fmtPeriod(from, day)} · GW, stacked`);
      this.panel.render({
        xType: "time", xLabel: fmtDateTime, yName: "GW", yMin: 0, source: REE,
        markAreas: [{ from: parisMidnight(today), to: parisMidnight(addDays(today, 1)), label: "Today", colour: "--today" }],
        series: used.map(f => ({ name: f.label, colour: f.colour, type: "line", stack: "mix", unit: "GW", decimals: 2, width: 0.6, areaOpacity: 0.85, symbols: false, data: mix.map(r => [r.t, (fuelValue(r, f.value) || 0) / 1000]) })),
        notes: ["Hydro is REE's real-time hydro figure; pumping consumption is not shown. Before the solar and cogeneration splits existed, solar and other generation are shown as totals."]
      });
      this.sharePanel.setTitle("Renewable and wind-and-solar shares", "% of generation, every 15 minutes");
      this.sharePanel.render({
        xType: "time", xLabel: fmtDateTime, yName: "%", source: REE,
        series: [
          { name: "Wind and solar", colour: "--f-wind", type: "line", width: 1.6, unit: "%", decimals: 1, data: mix.map(r => [r.t, share([r], ["wind", "solar_pv", "solar_thermal"])]) },
          { name: "Renewables", colour: "--s-actual", type: "line", width: 2.2, unit: "%", decimals: 1, data: mix.map(r => [r.t, share([r], RENEWABLE)]) }
        ]
      });
    } catch (error) {
      console.error(error);
      this.headline.textContent = `Generation data could not be loaded (${error.message}).`;
    }
  }

  refreshTheme() { this.panel.refreshTheme(); this.sharePanel.refreshTheme(); }
}

export function esGenExplorer(root) {
  const groups = { total: FUELS.map(f => f.value), ren: RENEWABLE, vre: ["wind", "solar_pv", "solar_thermal"], fossil: ["ccgt", "coal", "fuel_gas", "chp_other"] };
  const val = (r, k) => (groups[k] ? groups[k].reduce((a, f) => a + (fuelValue(r, f) || 0), 0) : fuelValue(r, k));
  return new TimeExplorer(root, {
    key: "es/generation/explorer",
    hero: ["Explore Spanish generation,", "since 2015.", "Output by technology from REE's real-time data, at any resolution from 15 minutes to a year, against last year, the average and range of earlier years, a chosen year or another technology."],
    firstDate: ES_FIRST, source: REE, fine: "15m",
    subjects: [
      ...FUELS.map(f => ({ value: f.value, label: f.label, colour: f.colour })),
      { value: "total", label: "Total" }, { value: "ren", label: "Renewables" }, { value: "vre", label: "Wind + solar" }, { value: "fossil", label: "Fossil and cogeneration" }
    ],
    subjectLabel: "Technology", compareSubjects: true, compareLabel: "Another technology…",
    measures: {
      mean: { label: "Average output", short: "average output", unit: "GW", scale: 1000, decimals: 2, agg: "mean", daily: (r, k) => val(r, k) },
      share: { label: "Share of generation", short: "share of generation", unit: "%", decimals: 1, agg: "mean", daily: (r, k) => { const t = totalGen(r); return t ? 100 / t / (1 / val(r, k)) : null; } },
      energy: { label: "Energy (GWh)", short: "energy", unit: "GWh", decimals: 0, agg: "sum", intraday: false, daily: (r, k) => { const v = val(r, k); return v == null ? null : mul(v, 24) / 1000; } }
    },
    defaults: { measure: "mean", subject: "wind", preset: "last30", res: "1d" },
    loadDaily: getMixDaily,
    loadRaw: async (k, from, to, measure) => (await getMixRaw(from, to)).filter(r => r.wind != null).map(r => {
      const v = val(r, k);
      const t = totalGen(r);
      return { t: r.t, min: 15, v: measure === "share" ? (t ? 100 / t / (1 / v) : null) : v };
    }),
    hasQuarters: () => true,
    fmt: (v, m) => fmtByUnit(v, m),
    sentenceSubject: (m, subj) => `Spanish ${subj.toLowerCase()} ${m.short}`,
    notes: () => ["REE real-time generation for mainland Spain. Daily energy uses the day's average output over 24 hours."]
  });
}

// ======================================================================
// Flows
// ======================================================================

export class EsFlowsToday {
  constructor(root) {
    this.root = root;
    root.innerHTML = `
      ${heroHtml("Spain's borders,", "right now.", "Physical flows with France and Portugal from the ENTSO-E Transparency Platform, from Spain's side: positive is power leaving Spain.")}
      ${headlineBlock()}
      <div data-cards></div>
      <div data-chart></div>`;
    this.headline = wireHeadline(root);
    this.panel = new ChartPanel(root.querySelector("[data-chart]"), { title: "Net exports by border", size: "tall", source: ENTSOE });
  }

  async activate() {
    try {
      const today = todayParis();
      const from = addDays(today, -6);
      const rows = await getFlowsRaw(from, today);
      const ly = await getFlowsRaw(addDays(today, -364), addDays(today, -364));
      const day = rows.filter(r => dateKey(r.t) === today && r.net != null);
      const last = [...rows].reverse().find(r => r.net != null);
      if (!last) throw new Error("no flow data yet");
      const offset = last.t - parisMidnight(dateKey(last.t));
      const a = col => meanOf(day.map(r => r[col]));
      const b = col => avgUpTo(ly, col, addDays(today, -364), offset);
      const sides = v => (v == null ? "" : v >= 0 ? "net exports" : "net imports");
      this.root.querySelector("[data-cards]").innerHTML = cards([
        card("Net exports now", GW(last.net), `at ${fmtTime(last.t)}`, " accent"),
        card("France border today", GW(a("fr_net")), `${sides(a("fr_net"))}; last year ${GW(b("fr_net"))}`),
        card("Portugal border today", GW(a("pt_net")), `${sides(a("pt_net"))}; last year ${GW(b("pt_net"))}`),
        card("Exports to France", GW(a("fr_exp")), "Average today"),
        card("Imports from France", GW(a("fr_imp")), "Average today"),
        card("Total net exports", GW(a("net")), `Same hours last year ${GW(b("net"))}`)
      ]);
      const net = a("net");
      this.headline.textContent = net == null ? "No flow data for today yet." : `Spain has been a net ${net >= 0 ? "exporter" : "importer"} of ${GW(Math.abs(net))} on average today, with ${GW(Math.abs(a("fr_net") || 0))} net ${(a("fr_net") || 0) >= 0 ? "to" : "from"} France and ${GW(Math.abs(a("pt_net") || 0))} net ${(a("pt_net") || 0) >= 0 ? "to" : "from"} Portugal.`;
      const ser = (name, col, colour, width) => ({ name, colour, type: "line", width, unit: "GW", decimals: 2, data: rows.filter(r => r[col] != null).map(r => [r.t, r[col] / 1000]) });
      this.panel.setTitle("Net exports by border, last 7 days", `${fmtPeriod(from, today)} · GW, positive = out of Spain`);
      this.panel.render({
        xType: "time", xLabel: fmtDateTime, yName: "GW", source: ENTSOE, zeroLine: true,
        series: [ser("France", "fr_net", "--z-fr", 1.6), ser("Portugal", "pt_net", "--z-pt", 1.6), ser("Total", "net", "--s-actual", 2.4)],
        notes: ["Physical (measured) flows; they can differ from the commercial exchanges agreed in the markets. Morocco and Andorra are not included."]
      });
    } catch (error) {
      console.error(error);
      this.headline.textContent = `Flow data could not be loaded (${error.message}).`;
    }
  }

  refreshTheme() { this.panel.refreshTheme(); }
}

export function esFlowsExplorer(root) {
  return new TimeExplorer(root, {
    key: "es/flows/explorer",
    hero: ["Explore Spain's", "cross-border flows.", "Physical flows with France and Portugal at any resolution from 15 minutes to a year, from Spain's side (positive is power leaving Spain), against earlier years or another border."],
    firstDate: ES_FIRST, source: ENTSOE, fine: "15m",
    subjects: [
      { value: "net", label: "Net exports, both borders" }, { value: "fr_net", label: "Net exports to France" }, { value: "pt_net", label: "Net exports to Portugal" },
      { value: "fr_exp", label: "Exports to France" }, { value: "fr_imp", label: "Imports from France" },
      { value: "pt_exp", label: "Exports to Portugal" }, { value: "pt_imp", label: "Imports from Portugal" }
    ],
    subjectLabel: "Flow", compareSubjects: true, compareLabel: "Another flow…",
    measures: {
      mean: { label: "Average flow", short: "average flow", unit: "GW", scale: 1000, decimals: 2, agg: "mean", zeroLine: true, daily: (r, k) => r[k] },
      energy: { label: "Energy (GWh)", short: "energy", unit: "GWh", decimals: 0, agg: "sum", intraday: false, zeroLine: true, daily: (r, k) => (r[k] == null ? null : mul(r[k], 24) / 1000) }
    },
    defaults: { measure: "mean", subject: "net", preset: "last90", res: "1d" },
    loadDaily: getFlowsDaily,
    loadRaw: async (k, from, to) => (await getFlowsRaw(from, to)).map(r => ({ t: r.t, v: r[k], min: 15 })),
    hasQuarters: () => true,
    fmt: (v, m) => fmtByUnit(v, m),
    sentenceSubject: (m, subj) => `${subj.toLowerCase()} ${m.short}`.replace(/^net/, "Spain's net"),
    notes: () => ["Physical flows from the ENTSO-E Transparency Platform. France–Spain flows come from the France data; Spain–Portugal from the Spain data."]
  });
}
