// Spain: Generation (Today, Explorer) and Flows (Today, Explorer).
// Code note: no asterisks here (chat formatting strips them when pasted).
import { ChartPanel } from "./chart.js";
import { card } from "./market-common.js";
import { fmtByUnit } from "./market-data.js";
import { TimeExplorer } from "./time-explorer.js";
import { QUARTER, addDays, dateKey, fmtDateTime, fmtNumber, fmtPct, fmtPeriod, fmtTime, heroHtml, parisMidnight, todayParis, writeHash } from "./util.js";
import { ENTSOE, ES_FIRST, FUELS, REE, RENEWABLE, fuelValue, getFlowsDaily, getFlowsRaw, getMixDaily, getMixRaw, hydroGross, pumpValue, totalGen } from "./es-data.js";
import { GW, cards, headlineBlock, meanOf, mul, pct, wireHeadline } from "./es-common.js";

const VRE = ["wind", "solar_pv", "solar_thermal"];
const FOSSIL = ["ccgt", "coal", "fuel_gas", "chp_other"];
const shareOf = (list, set) => pct(list.reduce((s, r) => s + set.reduce((x, f) => x + (fuelValue(r, f) || 0), 0), 0), list.reduce((s, r) => s + totalGen(r), 0));
const fuelName = f => (f === "hydro" ? "Hydro (net of pumping)" : FUELS.find(x => x.value === f).label);

export class EsGenToday {
  constructor(root) {
    this.root = root;
    this.writesHash = true;
    this.state = { days: "2" };
    root.innerHTML = `
      ${heroHtml("Spanish generation,", "right now.", "Mainland output by technology every 15 minutes from REE's real-time data, today so far against the same hours on the same weekday last year. Pumped-storage pumping is shown below zero.")}
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
    writeHash("generation/today", this.state);
    this.root.querySelector("[data-days]").value = this.state.days;
    try {
      const today = todayParis();
      const from = addDays(today, 1 - Number(this.state.days));
      const mix = (await getMixRaw(from, today)).filter(r => r.wind != null);
      if (!mix.length) throw new Error("no generation data yet");
      const lastT = mix.at(-1).t;
      const day = dateKey(lastT);
      const offset = lastT - parisMidnight(day);
      const rows = mix.filter(r => dateKey(r.t) === day);
      const lyDay = addDays(day, -364);
      const ly = (await getMixRaw(lyDay, lyDay)).filter(r => r.wind != null && r.t - parisMidnight(lyDay) <= offset);
      const label = day === today ? "today" : "yesterday";
      const changes = [];
      const fuelCards = ["nuclear", "wind", "solar_pv", "hydro", "ccgt", "chp_other"].map(f => {
        const a = meanOf(rows.map(r => fuelValue(r, f)));
        const b = meanOf(ly.map(r => fuelValue(r, f)));
        const change = a != null && b ? pct(a - b, b) : null;
        if (change != null && Math.max(a, b) >= 1000) changes.push({ f, a, b, change });
        return card(fuelName(f), GW(a), b != null ? `${fmtPct(change, 0)} vs ${GW(b)} last year` : "");
      });
      const pumpNow = meanOf(rows.map(pumpValue));
      const grossNow = meanOf(rows.map(hydroGross));
      const ren = shareOf(rows, RENEWABLE);
      const renLy = shareOf(ly, RENEWABLE);
      const pp = (a, b) => (a != null && b != null ? `${a - b >= 0 ? "+" : "−"}${fmtNumber(Math.abs(a - b), 1)} pp vs last year` : "");
      this.root.querySelector("[data-cards]").innerHTML = cards([
        ...fuelCards,
        card("Pumping", pumpNow != null ? GW(-pumpNow) : "–", pumpNow != null ? `Average consumption · hydro before pumping ${GW(grossNow)}` : "Not published before Dec 2024"),
        card("Renewable share", ren != null ? fmtNumber(ren, 1) + "%" : "–", pp(ren, renLy), " accent"),
        card("Wind and solar share", fmtNumber(shareOf(rows, VRE), 1) + "%", ""),
        card("Fossil share", fmtNumber(shareOf(rows, FOSSIL), 1) + "%", "Gas, coal, fuel-gas and cogeneration")
      ]);
      changes.sort((x, y) => Math.abs(y.change) - Math.abs(x.change));
      const top = changes.at(0);
      let text = top ? `Spanish ${fuelName(top.f).toLowerCase()} output averaged ${GW(top.a)} ${label} to ${fmtTime(lastT + QUARTER)}, ${fmtNumber(Math.abs(top.change), 0)}% ${top.change >= 0 ? "above" : "below"} the same hours on the same weekday last year (${GW(top.b)}).` : "";
      if (ren != null) text += ` Renewables supplied ${fmtNumber(ren, 1)}% of generation${renLy != null ? `, against ${fmtNumber(renLy, 1)}% a year earlier` : ""}.`;
      this.headline.textContent = text.trim();
      // In this chart hydro is drawn before pumping, with pumping below zero,
      // so the stack shows what plants produced and what pumps consumed.
      const stackVal = (r, f) => (f === "hydro" ? (hydroGross(r) ?? fuelValue(r, f)) : fuelValue(r, f));
      const used = FUELS.filter(f => mix.some(r => (stackVal(r, f.value) || 0) > 0));
      const series = used.map(f => ({ name: f.label, colour: f.colour, type: "line", stack: "mix", unit: "GW", decimals: 2, width: 0.6, areaOpacity: 0.85, symbols: false, data: mix.map(r => [r.t, (stackVal(r, f.value) || 0) / 1000]) }));
      if (mix.some(r => pumpValue(r) != null)) series.push({ name: "Pumping", colour: "--s-ly", type: "line", stack: "pump", unit: "GW", decimals: 2, width: 0.6, areaOpacity: 0.6, symbols: false, data: mix.map(r => [r.t, (pumpValue(r) || 0) / 1000]) });
      this.panel.setTitle("Generation by technology, every 15 minutes", `${fmtPeriod(from, day)} · GW, stacked`);
      this.panel.render({
        xType: "time", xLabel: fmtDateTime, yName: "GW", source: REE, zeroLine: true,
        markAreas: [{ from: parisMidnight(today), to: parisMidnight(addDays(today, 1)), label: "Today", colour: "--today" }],
        series,
        notes: ["In this chart hydro is output before pumping (REE's net hydro figure plus pumping consumption, from Dec 2024) and pumping is shown below zero. Cards, shares and comparisons with earlier years use REE's net hydro figure for every year."]
      });
      this.sharePanel.setTitle("Renewable and wind-and-solar shares", "% of generation, every 15 minutes");
      this.sharePanel.render({
        xType: "time", xLabel: fmtDateTime, yName: "%", source: REE,
        series: [
          { name: "Wind and solar", colour: "--f-wind", type: "line", width: 1.6, unit: "%", decimals: 1, data: mix.map(r => [r.t, shareOf([r], VRE)]) },
          { name: "Renewables", colour: "--s-actual", type: "line", width: 2.2, unit: "%", decimals: 1, data: mix.map(r => [r.t, shareOf([r], RENEWABLE)]) }
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
  const groups = { total: FUELS.map(f => f.value), ren: RENEWABLE, vre: VRE, fossil: FOSSIL, solar: ["solar_pv", "solar_thermal"] };
  const val = (r, k) => {
    if (k === "pump") return r.pump_load == null ? null : -Math.min(0, r.pump_load);
    if (k === "hydro_gross") return hydroGross(r);
    return groups[k] ? groups[k].reduce((a, f) => a + (fuelValue(r, f) || 0), 0) : fuelValue(r, k);
  };
  return new TimeExplorer(root, {
    key: "es/generation/explorer",
    hero: ["Explore Spanish generation,", "since 2015.", "Output by technology from REE's real-time data, at any resolution from 15 minutes to a year, against last year, the average and range of earlier years, a chosen year or another technology."],
    firstDate: ES_FIRST, source: REE, fine: "15m",
    subjects: [
      ...FUELS.map(f => ({ value: f.value, label: fuelName(f.value), colour: f.colour })),
      { value: "solar", label: "Solar (PV and thermal)" }, { value: "total", label: "Total" }, { value: "ren", label: "Renewables" },
      { value: "vre", label: "Wind + solar" }, { value: "fossil", label: "Fossil and cogeneration" },
      { value: "hydro_gross", label: "Hydro before pumping (from Dec 2024)" }, { value: "pump", label: "Pumping consumption (from Dec 2024)" }
    ],
    subjectLabel: "Technology", compareSubjects: true, compareLabel: "Another technology…",
    measures: {
      mean: { label: "Average output", short: "average output", unit: "GW", scale: 1000, decimals: 2, agg: "mean", daily: (r, k) => val(r, k) },
      share: { label: "Share of generation", short: "share of generation", unit: "%", decimals: 1, agg: "mean", daily: (r, k) => (k === "pump" || k === "hydro_gross" ? null : pct(val(r, k), totalGen(r))) },
      energy: { label: "Energy (GWh)", short: "energy", unit: "GWh", decimals: 0, agg: "sum", intraday: false, daily: (r, k) => { const v = val(r, k); return v == null ? null : mul(v, 24) / 1000; } }
    },
    defaults: { measure: "mean", subject: "wind", preset: "last30", res: "1d" },
    loadDaily: getMixDaily,
    loadRaw: async (k, from, to, measure) => (await getMixRaw(from, to)).filter(r => r.wind != null).map(r => {
      const v = val(r, k);
      return { t: r.t, min: 15, v: measure === "share" ? (k === "pump" || k === "hydro_gross" ? null : pct(v, totalGen(r))) : v };
    }),
    hasQuarters: () => true,
    fmt: (v, m) => fmtByUnit(v, m),
    sentenceSubject: (m, subj) => `Spanish ${subj.toLowerCase()} ${m.short}`,
    notes: () => ["REE real-time generation for mainland Spain. Hydro is REE's real-time figure, net of pumped-storage consumption, for every year; hydro before pumping and pumping itself exist only from Dec 2024. Daily energy uses the day's average output over 24 hours."]
  });
}

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
      const lyDay = addDays(today, -364);
      const ly = await getFlowsRaw(lyDay, lyDay);
      const day = rows.filter(r => dateKey(r.t) === today && r.net != null);
      const last = [...rows].reverse().find(r => r.net != null);
      if (!last) throw new Error("no flow data yet");
      const offset = last.t - parisMidnight(dateKey(last.t));
      const a = col => meanOf(day.map(r => r[col]));
      const b = col => meanOf(ly.filter(r => r.t - parisMidnight(lyDay) <= offset).map(r => r[col]));
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
      const frNet = a("fr_net") || 0;
      const ptNet = a("pt_net") || 0;
      this.headline.textContent = net == null ? "No flow data for today yet." : `Spain has been a net ${net >= 0 ? "exporter" : "importer"} of ${GW(Math.abs(net))} on average today, with ${GW(Math.abs(frNet))} net ${frNet >= 0 ? "to" : "from"} France and ${GW(Math.abs(ptNet))} net ${ptNet >= 0 ? "to" : "from"} Portugal.`;
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
