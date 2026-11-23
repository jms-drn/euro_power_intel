// Spain Hydro: the Value and Pumping tabs, from data/es/hydro/monthly.csv and
// profile.csv (scripts/es_hydro.py) and MITECO's reservoir levels.
// Code note: no asterisks here (chat formatting strips them when pasted).
import { ChartPanel } from "./chart.js";
import { card } from "./market-common.js";
import { fmtMonth, fmtNumber, heroHtml, parisMidnight } from "./util.js";
import { BOTH, getHydroMonthly, getHydroProfile, getReservoirs } from "./es-data.js";
import { Base, EUR, MONTHS, cards, headlineBlock, meanOf, pct, signed } from "./es-common.js";
import { SOURCE, fillYears } from "./es-hydro.js";

const SUMS = ["hours", "psum", "pn", "net_mwh", "q", "qp", "cfq", "cfqp", "gq", "gqp", "pump_mwh", "pq", "pp", "pneg",
  "turb_mwh", "tq", "tp", "topq", "allq", "corr_sum", "corr_n"];
const MS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const mk = (y, m) => y + "-" + String(m).padStart(2, "0");
const ratio = (a, b) => (b ? a / b : null);
const gap = v => signed(v, x => "€" + fmtNumber(x, 2));

function agg(byKey, year, months) {
  const out = { months: 0 };
  for (const k of SUMS) out[k] = 0;
  for (const m of months) {
    const r = byKey.get(mk(year, m));
    if (!r) continue;
    out.months += 1;
    for (const k of SUMS) out[k] += r[k] || 0;
  }
  return out;
}
function stats(a) {
  const capture = ratio(a.qp, a.q);
  const base = ratio(a.psum, a.pn);
  return {
    capture, base, rate: capture != null && base ? pct(capture, base) : null, cf: ratio(a.cfqp, a.cfq),
    top: a.allq ? pct(a.topq, a.allq) : null, corr: ratio(a.corr_sum, a.corr_n),
    pumpPrice: ratio(a.pp, a.pq), turbPrice: ratio(a.tp, a.tq), pumpGwh: a.pump_mwh / 1000, turbGwh: a.turb_mwh / 1000,
    negShare: a.pump_mwh ? pct(a.pneg, a.pump_mwh) : null, has: a.months > 0
  };
}
// Change in capture price from last year (l) to this year (t), split into the
// price level, the shape of prices through the day (last year's output on
// this year's prices) and when hydro ran (this year's output).
function split(t, l) {
  if (t.capture == null || l.capture == null || t.cf == null || t.base == null || l.base == null) return null;
  return { total: t.capture - l.capture, level: t.base - l.base, shape: (t.cf - t.base) - (l.capture - l.base), dispatch: t.capture - t.cf };
}
function spanText(year, months) {
  if (months.length === 12) return String(year);
  return `${year} (${MONTHS.at(months.at(0) - 1)}–${MONTHS.at(months.at(-1) - 1)})`;
}
const toolbarYear = `<div class="toolbar"><label class="field"><span>Year</span><select data-k="year"></select></label>`;

export class EsHydroValue extends Base {
  constructor(root) {
    super(root, "hydro/value", { year: "" }, false);
    root.innerHTML = `
      ${heroHtml("What hydro", "earns.", "The price Spanish hydro output sold for, why it changed (the price level, the shape of prices through the day, or when hydro ran), how hard hydro chases the highest prices, and an estimate of the value operators put on their water.")}
      ${toolbarYear}</div>
      ${headlineBlock()}
      <div data-cards></div><div data-a></div><div data-b></div><div data-c></div><div data-d></div>`;
    this.wire();
    this.capPanel = new ChartPanel(root.querySelector("[data-a]"), { title: "Capture price", size: "short", source: BOTH });
    this.splitPanel = new ChartPanel(root.querySelector("[data-b]"), { title: "Why it changed", size: "short", source: BOTH });
    this.chasePanel = new ChartPanel(root.querySelector("[data-c]"), { title: "Price chasing", size: "short", source: BOTH });
    this.wvPanel = new ChartPanel(root.querySelector("[data-d]"), { title: "Water value", size: "short", source: SOURCE });
    this.panels = [this.capPanel, this.splitPanel, this.chasePanel, this.wvPanel];
  }

  async render(id) {
    const got = await Promise.all([getHydroMonthly(), getReservoirs()]);
    if (id !== this.renderId) return;
    const mon = got.at(0);
    const res = got.at(1).rows;
    if (!mon.rows.length) throw new Error("no hydro summaries yet");
    const years = [...new Set(mon.rows.map(r => r.year))].sort((a, b) => a - b);
    const year = fillYears(this.root, years, this.state);
    const monthsY = MS.filter(m => (mon.byKey.get(mk(year, m)) || {}).q > 0);
    if (!monthsY.length) throw new Error("no hydro output in " + year);
    const T = stats(agg(mon.byKey, year, monthsY));
    const L = stats(agg(mon.byKey, year - 1, monthsY));
    const d = split(T, L);
    const span = spanText(year, monthsY);
    const wvRows = mon.rows.filter(r => r.wv != null);
    const lastWv = wvRows.at(-1);
    this.headline.textContent = `In ${span}, Spanish hydro output (net of pumping) earned ${EUR(T.capture)}, a capture rate of ${fmtNumber(T.rate, 1)}% of baseload` +
      (d ? `, ${gap(d.total)} on the same months of ${year - 1}. Of that change, ${gap(d.level)} came from the overall price level, ${gap(d.shape)} from the shape of prices through the day and ${gap(d.dispatch)} from when hydro ran.` : ".");
    this.root.querySelector("[data-cards]").innerHTML = cards([
      card("Capture price", EUR(T.capture), `${fmtNumber(T.rate, 1)}% of the ${EUR(T.base)} baseload · ${year - 1}: ${EUR(L.capture)}`, " accent"),
      card("From the price level", d ? gap(d.level) : "–", "Change in baseload on the same months"),
      card("From the price shape", d ? gap(d.shape) : "–", `${year - 1}'s hydro output priced at ${year}'s prices`),
      card("From when hydro ran", d ? gap(d.dispatch) : "–", "This year's output against last year's, on this year's prices"),
      card("Output in top-quarter price hours", T.top != null ? fmtNumber(T.top, 1) + "%" : "–", `${year - 1}: ${L.top != null ? fmtNumber(L.top, 1) + "%" : "–"} · 25% if output ignored prices`),
      card("Output–price correlation", T.corr != null ? fmtNumber(T.corr, 2) : "–", `Average within each day · ${year - 1}: ${L.corr != null ? fmtNumber(L.corr, 2) : "–"}`),
      card("Implied water value", lastWv ? EUR(lastWv.wv) : "–", lastWv ? fmtMonth(parisMidnight(mk(lastWv.year, lastWv.month) + "-01")) + " · the site's estimate" : "")
    ]);
    const mY = MS.map(m => stats(agg(mon.byKey, year, [m])));
    const mL = MS.map(m => stats(agg(mon.byKey, year - 1, [m])));
    const idx = MS.map((m, i) => i);
    this.capPanel.setTitle(`Hydro capture price by month, ${year} against ${year - 1}`, "€/MWh (left), capture rate % of baseload (right)");
    this.capPanel.render({
      xType: "category", categories: MONTHS, xLabel: x => x, xHeader: "Month", yName: "€/MWh", zeroLine: true, source: BOTH,
      yAxis2: { name: "%", format: v => fmtNumber(v, 0) },
      series: [
        { name: "Baseload " + year, colour: "--s-d2", type: "line", dashed: true, width: 1.4, unit: "€/MWh", decimals: 2, avg: false, data: idx.map(i => [i, mY.at(i).base]) },
        { name: "Capture price " + (year - 1), colour: "--s-ly", type: "line", width: 1.6, unit: "€/MWh", decimals: 2, avg: false, data: idx.map(i => [i, mL.at(i).capture]) },
        { name: "Capture price " + year, colour: "--s-actual", type: "line", width: 2.6, unit: "€/MWh", decimals: 2, avg: false, data: idx.map(i => [i, mY.at(i).capture]) },
        { name: "Capture rate " + year, colour: "--f-hydro", type: "bar", yAxis: 1, unit: "%", decimals: 1, avg: false, data: idx.map(i => [i, mY.at(i).rate]) }
      ]
    });
    const parts = idx.map(i => split(mY.at(i), mL.at(i)));
    const piece = k => idx.map(i => [i, parts.at(i) ? parts.at(i)[k] : null]);
    this.splitPanel.setTitle(`Why the hydro capture price changed, ${year} against ${year - 1}`, "€/MWh by month · the three parts add up to the total change");
    this.splitPanel.render({
      xType: "category", categories: MONTHS, xLabel: x => x, xHeader: "Month", yName: "€/MWh", zeroLine: true, source: BOTH,
      series: [
        { name: "Price level", colour: "--s-d2", type: "bar", stack: "d", unit: "€/MWh", decimals: 2, avg: false, data: piece("level") },
        { name: "Price shape", colour: "--s-d1", type: "bar", stack: "d", unit: "€/MWh", decimals: 2, avg: false, data: piece("shape") },
        { name: "When hydro ran", colour: "--f-hydro", type: "bar", stack: "d", unit: "€/MWh", decimals: 2, avg: false, data: piece("dispatch") },
        { name: "Total change", colour: "--s-actual", type: "line", width: 2.4, unit: "€/MWh", decimals: 2, avg: false, data: piece("total") }
      ],
      notes: ["Price level: the change in the monthly baseload. Price shape: how last year's hydro output would have fared on this year's prices, against the baseload. When hydro ran: this year's output against last year's, both on this year's prices. Last year's output is matched by weekday, 364 days earlier."]
    });
    const earlierYears = years.filter(y => y < year - 1);
    this.chasePanel.setTitle("Share of hydro output in each day's top-quarter price hours", `% by month · ${year}, ${year - 1} and the average of earlier years`);
    this.chasePanel.render({
      xType: "category", categories: MONTHS, xLabel: x => x, xHeader: "Month", yName: "%", source: BOTH,
      series: [
        ...(earlierYears.length ? [{ name: `Average ${earlierYears.at(0)}–${earlierYears.at(-1)}`, colour: "--s-d2", type: "line", dashed: true, width: 1.4, unit: "%", decimals: 1, avg: false, data: idx.map(i => [i, meanOf(earlierYears.map(y => stats(agg(mon.byKey, y, [i + 1])).top))]) }] : []),
        { name: String(year - 1), colour: "--s-ly", type: "line", width: 1.6, unit: "%", decimals: 1, avg: false, data: idx.map(i => [i, mL.at(i).top]) },
        { name: String(year), colour: "--s-actual", type: "line", width: 2.6, unit: "%", decimals: 1, avg: false, data: idx.map(i => [i, mY.at(i).top]) }
      ],
      notes: ["If hydro ran the same in every hour, 25% of its output would fall in the top quarter of each day's price hours. The higher the share, the more hydro is being saved for the dearest hours."]
    });
    const fills = new Map();
    for (const r of res) {
      if (r.energy == null || !r.energy_cap) continue;
      const k = r.date.slice(0, 7);
      if (!fills.has(k)) fills.set(k, []);
      fills.get(k).push(pct(r.energy, r.energy_cap));
    }
    this.wvPanel.setTitle("Implied water value against reservoir fill, by month", "€/MWh (left), hydroelectric energy stored % full (right)");
    this.wvPanel.render({
      xType: "time", xLabel: fmtMonth, axisLabel: fmtMonth, yName: "€/MWh", source: SOURCE,
      yAxis2: { name: "% full", format: v => fmtNumber(v, 0) },
      series: [
        { name: "Reservoir fill", colour: "--f-hydro", type: "line", yAxis: 1, width: 1.4, unit: "%", decimals: 1, avg: false, data: [...fills.keys()].filter(k => k >= "2015").sort().map(k => [parisMidnight(k + "-01"), meanOf(fills.get(k))]) },
        { name: "Implied water value", colour: "--s-actual", type: "line", width: 2.2, unit: "€/MWh", decimals: 2, avg: false, data: wvRows.map(r => [parisMidnight(mk(r.year, r.month) + "-01"), r.wv]) }
      ],
      notes: ["The site's own estimate, not a published figure: the median Spanish price in the hours of each month when net hydro output was in its top quarter, a guide to the price at which operators chose to release water. It tends to rise when reservoirs are low and water is scarce."]
    });
  }
}

export class EsHydroPumping extends Base {
  constructor(root) {
    super(root, "hydro/pumping", { year: "", month: "" }, false);
    root.innerHTML = `
      ${heroHtml("Pumped", "storage.", "What Spain's pumped-storage plants paid to pump water uphill and earned generating with it, the spread between the two, and how much pumping happens when prices are at or below zero. REE publishes pumping from 30 Dec 2024.")}
      ${toolbarYear}
        <label class="field"><span>Daily profile for</span><select data-k="month">${MS.map(m => `<option value="${m}">${MONTHS.at(m - 1)}</option>`).join("")}</select></label></div>
      ${headlineBlock()}
      <div data-cards></div><div data-a></div><div data-b></div><div data-c></div>`;
    this.wire();
    this.energyPanel = new ChartPanel(root.querySelector("[data-a]"), { title: "Pumping and generation", size: "short", source: BOTH });
    this.pricePanel = new ChartPanel(root.querySelector("[data-b]"), { title: "Prices and spread", size: "short", source: BOTH });
    this.dayPanel = new ChartPanel(root.querySelector("[data-c]"), { title: "Average day", size: "short", source: BOTH });
    this.panels = [this.energyPanel, this.pricePanel, this.dayPanel];
  }

  async render(id) {
    const got = await Promise.all([getHydroMonthly(), getHydroProfile()]);
    if (id !== this.renderId) return;
    const mon = got.at(0);
    const prof = got.at(1);
    const years = [...new Set(mon.rows.filter(r => r.pump_mwh > 0).map(r => r.year))].sort((a, b) => a - b);
    if (!years.length) throw new Error("pumping is only published from Dec 2024");
    const s = this.state;
    const year = fillYears(this.root, years, s);
    const monthsY = MS.filter(m => (mon.byKey.get(mk(year, m)) || {}).pump_mwh > 0);
    const T = stats(agg(mon.byKey, year, monthsY));
    const L = stats(agg(mon.byKey, year - 1, monthsY));
    const hasL = L.pumpGwh > 0;
    const spread = T.turbPrice != null && T.pumpPrice != null ? T.turbPrice - T.pumpPrice : null;
    const spreadL = hasL && L.turbPrice != null && L.pumpPrice != null ? L.turbPrice - L.pumpPrice : null;
    const span = spanText(year, monthsY);
    const month = monthsY.includes(Number(s.month)) ? Number(s.month) : monthsY.at(-1);
    s.month = String(month);
    const msel = this.root.querySelector('[data-k="month"]');
    if (msel) msel.value = s.month;
    const last = (v, f) => (hasL ? `${year - 1}: ${f(v)}` : "No earlier year to compare");
    this.headline.textContent = `In ${span}, Spanish pumped-storage plants consumed ${fmtNumber(T.pumpGwh, 0)} GWh pumping at an average ${EUR(T.pumpPrice)} and generated ${fmtNumber(T.turbGwh, 0)} GWh at ${EUR(T.turbPrice)}, a spread of ${gap(spread)}. ${fmtNumber(T.negShare, 1)}% of the pumping was in hours at or below zero.`;
    this.root.querySelector("[data-cards]").innerHTML = cards([
      card("Energy used pumping", fmtNumber(T.pumpGwh, 0) + " GWh", last(L.pumpGwh, v => fmtNumber(v, 0) + " GWh")),
      card("Pumped-storage output", fmtNumber(T.turbGwh, 0) + " GWh", `${fmtNumber(T.pumpGwh ? pct(T.turbGwh, T.pumpGwh) : null, 0)}% of the energy used pumping`),
      card("Average pumping price", EUR(T.pumpPrice), last(L.pumpPrice, EUR)),
      card("Average generating price", EUR(T.turbPrice), last(L.turbPrice, EUR)),
      card("Spread", gap(spread), hasL ? `${year - 1}: ${gap(spreadL)}` : "Generating minus pumping price", " accent"),
      card("Pumping at or below zero", T.negShare != null ? fmtNumber(T.negShare, 1) + "%" : "–", hasL && L.negShare != null ? `${year - 1}: ${fmtNumber(L.negShare, 1)}%` : "Share of energy used pumping")
    ]);
    const mY = MS.map(m => stats(agg(mon.byKey, year, [m])));
    const mL = MS.map(m => stats(agg(mon.byKey, year - 1, [m])));
    const idx = MS.map((m, i) => i);
    const opt = (v, ok) => (ok ? v : null);
    this.energyPanel.setTitle(`Pumping and pumped-storage output by month, ${year}`, "GWh · pumping below zero");
    this.energyPanel.render({
      xType: "category", categories: MONTHS, xLabel: x => x, xHeader: "Month", yName: "GWh", zeroLine: true, source: BOTH,
      series: [
        { name: "Pumping " + year, colour: "--s-ly", type: "bar", unit: "GWh", decimals: 0, avg: false, data: idx.map(i => [i, opt(-mY.at(i).pumpGwh, mY.at(i).has)]) },
        { name: "Output " + year, colour: "--f-hydro", type: "bar", unit: "GWh", decimals: 0, avg: false, data: idx.map(i => [i, opt(mY.at(i).turbGwh, mY.at(i).has)]) },
        ...(hasL ? [
          { name: "Pumping " + (year - 1), colour: "--s-d2", type: "line", dashed: true, width: 1.4, unit: "GWh", decimals: 0, avg: false, data: idx.map(i => [i, opt(-mL.at(i).pumpGwh, mL.at(i).has)]) },
          { name: "Output " + (year - 1), colour: "--s-d1", type: "line", dashed: true, width: 1.4, unit: "GWh", decimals: 0, avg: false, data: idx.map(i => [i, opt(mL.at(i).turbGwh, mL.at(i).has)]) }] : [])
      ]
    });
    this.pricePanel.setTitle(`Pumping and generating prices by month, ${year}`, "€/MWh · spread = generating minus pumping price");
    this.pricePanel.render({
      xType: "category", categories: MONTHS, xLabel: x => x, xHeader: "Month", yName: "€/MWh", zeroLine: true, source: BOTH,
      series: [
        { name: "Spread " + year, colour: "--f-hydro", type: "bar", unit: "€/MWh", decimals: 2, avg: false, data: idx.map(i => [i, mY.at(i).turbPrice != null && mY.at(i).pumpPrice != null ? mY.at(i).turbPrice - mY.at(i).pumpPrice : null]) },
        { name: "Pumping price", colour: "--s-ly", type: "line", width: 1.8, unit: "€/MWh", decimals: 2, avg: false, data: idx.map(i => [i, mY.at(i).pumpPrice]) },
        { name: "Generating price", colour: "--s-actual", type: "line", width: 2.4, unit: "€/MWh", decimals: 2, avg: false, data: idx.map(i => [i, mY.at(i).turbPrice]) }
      ],
      notes: ["Prices are weighted by the energy pumped or generated each hour. The spread ignores round-trip losses: pumped storage gets back roughly three-quarters of the energy it uses."]
    });
    const day = prof.filter(r => r.year === year && r.month === month);
    const at = (h, k) => { const r = day.find(x => x.hour === h); return r && r[k] != null ? r[k] : null; };
    const hours = Array.from({ length: 24 }, (x, h) => h);
    this.dayPanel.setTitle(`Average day of pumped storage, ${MONTHS.at(month - 1)} ${year}`, "GW by local hour (left), Spanish price €/MWh (right)");
    this.dayPanel.render({
      xType: "category", categories: hours.map(h => String(h).padStart(2, "0") + ":00"), xLabel: x => x, xHeader: "Hour", yName: "GW", zeroLine: true, source: BOTH,
      yAxis2: { name: "€/MWh", format: v => fmtNumber(v, 0) },
      series: [
        { name: "Pumping", colour: "--s-ly", type: "bar", unit: "GW", decimals: 2, avg: false, data: hours.map(h => [h, at(h, "pump") == null ? null : Math.min(0, at(h, "pump")) / 1000]) },
        { name: "Pumped-storage output", colour: "--f-hydro", type: "bar", unit: "GW", decimals: 2, avg: false, data: hours.map(h => [h, at(h, "turb") == null ? null : at(h, "turb") / 1000]) },
        { name: "Spanish price", colour: "--s-actual", type: "line", dashed: true, width: 2, yAxis: 1, unit: "€/MWh", decimals: 2, avg: false, data: hours.map(h => [h, at(h, "price")]) }
      ]
    });
  }
}
