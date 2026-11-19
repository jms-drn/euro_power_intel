// Spain: Overview and Demand (Today, Explorer, Forecast accuracy).
// Code note: no asterisks here (chat formatting strips them when pasted).
import { ChartPanel } from "./chart.js";
import { bindPeriod, card, periodHtml } from "./market-common.js";
import { fmtByUnit } from "./market-data.js";
import { TimeExplorer } from "./time-explorer.js";
import { QUARTER, addDays, dateKey, daysBetween, fmtDateTime, fmtFromTo, fmtLongDate, fmtNumber, fmtPct, fmtPeriod, fmtTime, heroHtml, parisMidnight, todayParis, writeHash } from "./util.js";
import { ENTSOE, ES_FIRST, REE, RENEWABLE, ZONES, fuelValue, getDemandDaily, getDemandRaw, getFlowsRaw, getMixRaw, getPriceRaw, getPricesDaily, totalGen } from "./es-data.js";
import { EUR, GW, cards, headlineBlock, linkCard, localHour, meanOf, pct, signed, wireHeadline } from "./es-common.js";

const DAY364 = 31449600000;
// Average of col over the rows of day d up to the same time of day as offset.
function avgUpTo(rows, col, day, offset) {
  const start = parisMidnight(day);
  return meanOf(rows.filter(r => r.t >= start && r.t - start <= offset).map(r => r[col]));
}

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
      const got = await Promise.all([
        getDemandRaw(addDays(today, -1), today), getMixRaw(today, today), getFlowsRaw(today, today),
        getPriceRaw("ES", addDays(today, -1), addDays(today, 1)), getPriceRaw("FR", today, today), getPriceRaw("PT", today, today),
        getPricesDaily(), getDemandRaw(addDays(today, -364), addDays(today, -364))
      ]);
      const dem = got.at(0); const mix = got.at(1); const flows = got.at(2); const es = got.at(3);
      const fr = got.at(4); const pt = got.at(5); const daily = got.at(6); const lyDem = got.at(7);
      const last = [...dem].reverse().find(r => r.actual != null);
      const lyAt = last ? lyDem.find(r => r.t === last.t - DAY364) : null;
      const base = (rows, d) => meanOf(rows.filter(r => dateKey(r.t) === d).map(r => r.eur));
      const bToday = base(es, today);
      const bYest = base(es, addDays(today, -1));
      const bTom = base(es, addDays(today, 1));
      const bFr = base(fr, today);
      const bPt = base(pt, today);
      const gen = mix.filter(r => r.wind != null);
      const ren = gen.length ? meanOf(gen.map(r => pct(RENEWABLE.reduce((a, f) => a + (fuelValue(r, f) || 0), 0), totalGen(r)))) : null;
      const solar = meanOf(gen.map(r => (fuelValue(r, "solar_pv") || 0) + (fuelValue(r, "solar_thermal") || 0)));
      const wind = meanOf(gen.map(r => r.wind));
      const net = meanOf(flows.map(r => r.net));
      const lyPct = last && lyAt && lyAt.actual ? pct(last.actual - lyAt.actual, lyAt.actual) : null;
      const gap = v => signed(v, x => "€" + fmtNumber(x, 2));
      this.root.querySelector("[data-cards]").innerHTML = cards([
        linkCard("#es/demand/today", card("Demand now", last ? GW(last.actual) : "–", last ? `at ${fmtTime(last.t)}${lyPct != null ? ", " + fmtPct(lyPct, 1) + " on last year" : ""}` : "")),
        linkCard("#es/prices/short", card("Baseload today", EUR(bToday), bYest != null && bToday != null ? gap(bToday - bYest) + " on yesterday" : "", " accent")),
        linkCard("#es/prices/short", card("Baseload tomorrow", EUR(bTom), bTom == null ? "Published after the auction, around 13:00" : "")),
        linkCard("#es/prices/spreads", card("Spain minus France", bToday != null && bFr != null ? gap(bToday - bFr) : "–", "Baseload today")),
        linkCard("#es/prices/spreads", card("Spain minus Portugal", bToday != null && bPt != null ? gap(bToday - bPt) : "–", "Baseload today")),
        linkCard("#es/generation/today", card("Renewable share", ren != null ? fmtNumber(ren, 1) + "%" : "–", "Of generation today so far")),
        linkCard("#es/generation/today", card("Wind and solar", wind != null ? GW(wind + (solar || 0)) : "–", `Wind ${GW(wind)}, solar ${GW(solar)} on average today`)),
        linkCard("#es/flows/today", card("Net exports", GW(net), "Average today; negative means net imports"))
      ]);
      const parts = [];
      if (bToday != null) parts.push(`Spanish day-ahead baseload is ${EUR(bToday)} today${bYest != null ? `, ${gap(bToday - bYest)} on yesterday` : ""}${bFr != null ? `, ${bToday <= bFr ? "below" : "above"} France at ${EUR(bFr)}` : ""}.`);
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
    writeHash("demand/today", this.state);
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
      const change = avgNow != null && avgLy ? pct(avgNow - avgLy, avgLy) : null;
      const tomorrow = meanOf(rows.filter(r => dateKey(r.t) === addDays(today, 1)).map(r => r.forecast));
      const miss = last.forecast != null ? last.actual - last.forecast : null;
      this.root.querySelector("[data-cards]").innerHTML = cards([
        card("Latest demand", GW(last.actual), `at ${fmtTime(last.t)}`, " accent"),
        card("Against REE's forecast", signed(miss, v => fmtNumber(v / 1000, 2) + " GW"), "Actual minus forecast, latest quarter-hour"),
        card(day === today ? "Peak so far today" : "Peak", peak ? GW(peak.actual) : "–", peak ? `at ${fmtTime(peak.t)}` : ""),
        card("Forecast peak", fPeak ? GW(fPeak.forecast) : "–", fPeak ? `at ${fmtTime(fPeak.t)}` : ""),
        card("Average so far", GW(avgNow), change != null ? `${fmtPct(change, 1)} on the same hours last year` : ""),
        card("Tomorrow (forecast)", GW(tomorrow), "Average of REE's forecast")
      ]);
      this.headline.textContent = `Spanish mainland demand averaged ${GW(avgNow)} ${day === today ? "today" : "on " + fmtLongDate(day)} to ${fmtTime(last.t + QUARTER)}${change != null ? `, ${fmtNumber(Math.abs(change), 1)}% ${change >= 0 ? "above" : "below"} the same hours on the same weekday last year` : ""}. ${peak ? `It peaked at ${GW(peak.actual)} at ${fmtTime(peak.t)}.` : ""}`.trim();
      this.panel.setTitle("Demand every 15 minutes", `${fmtPeriod(from, addDays(today, 1))} · GW`);
      this.panel.render({
        xType: "time", xLabel: fmtDateTime, yName: "GW", source: REE,
        markAreas: [{ from: parisMidnight(today), to: parisMidnight(addDays(today, 1)), label: "Today", colour: "--today" }],
        series: [
          { name: "Same weekday last year", colour: "--s-ly", type: "line", width: 1.4, unit: "GW", decimals: 2, data: ly.filter(r => r.actual != null).map(r => [r.t + DAY364, r.actual / 1000]) },
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
  const m = (label, short, dailyFn, extra = {}) => ({ label, short, unit: "GW", scale: 1000, decimals: 2, agg: "mean", daily: dailyFn, ...extra });
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
    writeHash("demand/accuracy", this.state);
    try {
      let from = this.state.from;
      const to = this.state.to < todayParis() ? this.state.to : todayParis();
      const notes = [];
      if (daysBetween(from, to) > 400) { from = addDays(to, -399); notes.push(`At most 400 days are compared, so this shows ${fmtPeriod(from, to)}.`); }
      const rows = (await getDemandRaw(from, to)).filter(r => r.actual != null && r.forecast != null);
      if (!rows.length) throw new Error("no matching forecasts and actuals for this period");
      const byDay = new Map();
      const byHour = Array.from({ length: 24 }, () => ({ abs: 0, n: 0 }));
      let abs = 0; let err = 0; let rel = 0;
      for (const r of rows) {
        const e = r.forecast - r.actual;
        abs += Math.abs(e); err += e; rel += Math.abs(e) / r.actual;
        const d = dateKey(r.t);
        if (!byDay.has(d)) byDay.set(d, { abs: 0, err: 0, rel: 0, n: 0 });
        const a = byDay.get(d);
        a.abs += Math.abs(e); a.err += e; a.rel += Math.abs(e) / r.actual; a.n += 1;
        const h = byHour.at(localHour(r.t));
        h.abs += Math.abs(e); h.n += 1;
      }
      const n = rows.length;
      const days = [...byDay.entries()].map(e => ({ d: e.at(0), mae: e.at(1).abs / e.at(1).n, bias: e.at(1).err / e.at(1).n, mape: pct(e.at(1).rel, e.at(1).n) }));
      const worst = days.reduce((m, x) => (!m || x.mae > m.mae ? x : m), null);
      const mape = pct(rel, n);
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
          { name: "Bias", colour: "--s-d1", type: "bar", unit: "GW", decimals: 2, data: days.map(x => [parisMidnight(x.d), x.bias / 1000]) },
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
