// Spain Hydro: the Value and Pumping tabs, from data/es/hydro/monthly_types.csv
// and profile_types.csv (scripts/es_hydro_types.py) and MITECO's reservoir
// levels.
// Code note: no asterisks here (chat formatting strips them when pasted).
import { ChartPanel } from "./chart.js";
import { card } from "./market-common.js";
import { fmtMonth, fmtNumber, heroHtml, parisMidnight } from "./util.js";
import { BOTH, getReservoirs } from "./es-data.js";
import { Base, EUR, MONTHS, cards, headlineBlock, meanOf, pct, selectHtml, signed } from "./es-common.js";
import { SOURCE, fillYears } from "./es-hydro.js";
import { TYPES, TYPE_NOTE, TYPE_OPTIONS, getHydroProfileTypes, getHydroTypes } from "./es-hydro-data.js";

const SUMS = ["hours", "psum", "pn", "mwh", "q", "qp", "qneg", "cfq", "cfqp", "topq", "allq", "corr_sum", "corr_n"];
const MS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const IDX = MS.map((m, i) => i);
const mk = (y, m) => y + "-" + String(m).padStart(2, "0");
const ratio = (a, b) => (b ? a / b : null);
const gap = v => signed(v, x => "€" + fmtNumber(x, 2));

function agg(types, ty, year, months) {
  const out = { months: 0 };
  for (const k of SUMS) out[k] = 0;
  for (const m of months) {
    const r = types.get(ty, year, m);
    if (!r || !r.hours) continue;
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
    gwh: a.q / 1000, negShare: a.q ? pct(a.qneg, a.q) : null, has: a.months > 0 && a.q > 0
  };
}
// Change in capture price from last year (l) to this year (t), split into the
// price level, the shape of prices through the day (last year's output on
// this year's prices) and when the plants ran (this year's output).
function split(t, l) {
  if (t.capture == null || l.capture == null || t.cf == null || t.base == null || l.base == null) return null;
  return { total: t.capture - l.capture, level: t.base - l.base, shape: (t.cf - t.base) - (l.capture - l.base), dispatch: t.capture - t.cf };
}
function spanText(year, months) {
  if (months.length === 12) return String(year);
  return `${year} (${MONTHS.at(months.at(0) - 1)}–${MONTHS.at(months.at(-1) - 1)})`;
}
const yearField = `<label class="field"><span>Year</span><select data-k="year"></select></label>`;

export class EsHydroValue extends Base {
  constructor(root) {
    super(root, "hydro/value", { year: "", type: "total" }, false);
    root.innerHTML = `
      ${heroHtml("What hydro", "earns.", "The price Spanish hydro output sold for by type, why it changed (the price level, the shape of prices through the day, or when the plants ran), how hard it chases the highest prices, and an estimate of the value operators put on their water.")}
      <div class="toolbar">${yearField}${selectHtml("type", "Type", TYPE_OPTIONS)}</div>
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
    const got = await Promise.all([getHydroTypes(), getReservoirs()]);
    if (id !== this.renderId) return;
    const types = got.at(0);
    const res = got.at(1).rows;
    if (!types.rows.length) throw new Error("no hydro summaries by type yet: run the Spain hydro detail backfill");
    const ty = TYPES[this.state.type] ? this.state.type : "total";
    const name = TYPES[ty].short;
    const years = [...new Set(types.rows.filter(r => r.type === ty && r.q > 0).map(r => r.year))].sort((a, b) => a - b);
    if (!years.length) throw new Error("no data for " + TYPES[ty].label.toLowerCase() + " yet");
    const year = fillYears(this.root, years, this.state);
    const monthsY = MS.filter(m => (types.get(ty, year, m) || {}).q > 0);
    const T = stats(agg(types, ty, year, monthsY));
    const L = stats(agg(types, ty, year - 1, monthsY));
    const d = split(T, L);
    const span = spanText(year, monthsY);
    const wvRows = types.rows.filter(r => r.type === ty && r.wv != null);
    const lastWv = wvRows.at(-1);
    this.headline.textContent = `In ${span}, Spanish ${name} earned ${EUR(T.capture)}, a capture rate of ${fmtNumber(T.rate, 1)}% of baseload` +
      (d ? `, ${gap(d.total)} on the same months of ${year - 1}. Of that change, ${gap(d.level)} came from the overall price level, ${gap(d.shape)} from the shape of prices through the day and ${gap(d.dispatch)} from when the plants ran.` : ".");
    this.root.querySelector("[data-cards]").innerHTML = cards([
      card("Capture price", EUR(T.capture), `${fmtNumber(T.rate, 1)}% of the ${EUR(T.base)} baseload · ${year - 1}: ${EUR(L.capture)}`, " accent"),
      card("From the price level", d ? gap(d.level) : "–", "Change in baseload on the same months"),
      card("From the price shape", d ? gap(d.shape) : "–", `${year - 1}'s output priced at ${year}'s prices`),
      card("From when the plants ran", d ? gap(d.dispatch) : "–", "This year's output against last year's, on this year's prices"),
      card("Output in top-quarter price hours", T.top != null ? fmtNumber(T.top, 1) + "%" : "–", `${year - 1}: ${L.top != null ? fmtNumber(L.top, 1) + "%" : "–"} · 25% if output ignored prices`),
      card("Output–price correlation", T.corr != null ? fmtNumber(T.corr, 2) : "–", `Average within each day · ${year - 1}: ${L.corr != null ? fmtNumber(L.corr, 2) : "–"}`),
      card("Implied water value", lastWv ? EUR(lastWv.wv) : "–", lastWv ? fmtMonth(parisMidnight(mk(lastWv.year, lastWv.month) + "-01")) + " · the site's estimate" : "")
    ]);
    const mY = MS.map(m => stats(agg(types, ty, year, [m])));
    const mL = MS.map(m => stats(agg(types, ty, year - 1, [m])));
    this.capPanel.setTitle(`${TYPES[ty].label}: capture price by month, ${year} against ${year - 1}`, "€/MWh (left), capture rate % of baseload (right)");
    this.capPanel.render({
      xType: "category", categories: MONTHS, xLabel: x => x, xHeader: "Month", yName: "€/MWh", zeroLine: true, source: BOTH,
      yAxis2: { name: "%", format: v => fmtNumber(v, 0) },
      series: [
        { name: "Capture rate " + year, colour: "--s-band", type: "bar", yAxis: 1, unit: "%", decimals: 1, avg: false, data: IDX.map(i => [i, mY.at(i).rate]) },
        { name: "Baseload " + year, colour: "--s-avg", type: "line", dashed: true, width: 1.4, unit: "€/MWh", decimals: 2, avg: false, data: IDX.map(i => [i, mY.at(i).base]) },
        { name: "Capture price " + (year - 1), colour: "--s-ly", type: "line", width: 1.5, unit: "€/MWh", decimals: 2, avg: false, data: IDX.map(i => [i, mL.at(i).capture]) },
        { name: "Capture price " + year, colour: "--s-actual", type: "line", width: 2.6, z: 20, unit: "€/MWh", decimals: 2, avg: false, data: IDX.map(i => [i, mY.at(i).capture]) }
      ],
      notes: [TYPE_NOTE]
    });
    const parts = IDX.map(i => split(mY.at(i), mL.at(i)));
    const piece = k => IDX.map(i => [i, parts.at(i) ? parts.at(i)[k] : null]);
    this.splitPanel.setTitle(`Why the capture price changed, ${year} against ${year - 1}`, "€/MWh by month · the three parts add up to the total change");
    this.splitPanel.render({
      xType: "category", categories: MONTHS, xLabel: x => x, xHeader: "Month", yName: "€/MWh", zeroLine: true, source: BOTH,
      series: [
        { name: "Price level", colour: "--s-avg", type: "bar", stack: "d", unit: "€/MWh", decimals: 2, avg: false, data: piece("level") },
        { name: "Price shape", colour: "--s-ly", type: "bar", stack: "d", unit: "€/MWh", decimals: 2, avg: false, data: piece("shape") },
        { name: "When the plants ran", colour: "--f-hydro", type: "bar", stack: "d", unit: "€/MWh", decimals: 2, avg: false, data: piece("dispatch") },
        { name: "Total change", colour: "--s-actual", type: "line", width: 2.4, unit: "€/MWh", decimals: 2, avg: false, data: piece("total") }
      ],
      notes: ["Price level: the change in the monthly baseload. Price shape: how last year's output would have fared on this year's prices, against the baseload. When the plants ran: this year's output against last year's, both on this year's prices. Last year's output is matched by weekday, 364 days earlier."]
    });
    const earlierYears = years.filter(y => y < year - 1 && y >= year - 6);
    this.chasePanel.setTitle("Share of output in each day's top-quarter price hours", `% by month · ${year}, ${year - 1} and the years before`);
    this.chasePanel.render({
      xType: "category", categories: MONTHS, xLabel: x => x, xHeader: "Month", yName: "%", source: BOTH,
      series: [
        ...(earlierYears.length ? [{ name: `Average ${earlierYears.at(0)}–${earlierYears.at(-1)}`, colour: "--s-avg", type: "line", dashed: true, width: 1.4, unit: "%", decimals: 1, avg: false, data: IDX.map(i => [i, meanOf(earlierYears.map(y => stats(agg(types, ty, y, [i + 1])).top))]) }] : []),
        { name: String(year - 1), colour: "--s-ly", type: "line", width: 1.5, unit: "%", decimals: 1, avg: false, data: IDX.map(i => [i, mL.at(i).top]) },
        { name: String(year), colour: "--s-actual", type: "line", width: 2.6, unit: "%", decimals: 1, avg: false, data: IDX.map(i => [i, mY.at(i).top]) }
      ],
      notes: ["If output were the same in every hour, 25% of it would fall in the top quarter of each day's price hours. The higher the share, the more water is being saved for the dearest hours. Run-of-river can do little of this."]
    });
    const fills = new Map();
    for (const r of res) {
      if (r.energy == null || !r.energy_cap) continue;
      const k = r.date.slice(0, 7);
      if (!fills.has(k)) fills.set(k, []);
      fills.get(k).push(pct(r.energy, r.energy_cap));
    }
    this.wvPanel.setTitle("Implied water value against reservoir fill, by month", `${TYPES[ty].label} · €/MWh (left), hydroelectric energy stored % full (right)`);
    this.wvPanel.render({
      xType: "time", xLabel: fmtMonth, axisLabel: fmtMonth, yName: "€/MWh", source: SOURCE,
      yAxis2: { name: "% full", format: v => fmtNumber(v, 0) },
      series: [
        { name: "Reservoir fill", colour: "--s-avg", type: "line", yAxis: 1, width: 1.4, unit: "%", decimals: 1, avg: false, data: [...fills.keys()].filter(k => k >= "2015").sort().map(k => [parisMidnight(k + "-01"), meanOf(fills.get(k))]) },
        { name: "Implied water value", colour: "--s-actual", type: "line", width: 2.2, unit: "€/MWh", decimals: 2, avg: false, data: wvRows.map(r => [parisMidnight(mk(r.year, r.month) + "-01"), r.wv]) }
      ],
      notes: ["The site's own estimate, not a published figure: the median Spanish price in the hours of each month when output was in its top quarter, a guide to the price at which operators chose to release water. It moves with the general price level, so read it against baseload."]
    });
  }
}

export class EsHydroPumping extends Base {
  constructor(root) {
    super(root, "hydro/pumping", { year: "", month: "" }, false);
    root.innerHTML = `
      ${heroHtml("Pumped", "storage.", "What Spain's pumped-storage plants paid to pump water uphill and earned generating with it, the spread between the two, and how much pumping happens when prices are at or below zero. From ENTSO-E, since 2015.")}
      <div class="toolbar">${yearField}
        <label class="field"><span>Daily profile for</span><select data-k="month">${MS.map(m => `<option value="${m}">${MONTHS.at(m - 1)}</option>`).join("")}</select></label></div>
      ${headlineBlock()}
      <div data-cards></div><div data-a></div><div data-b></div><div data-c></div>`;
    this.wire();
    this.energyPanel = new ChartPanel(root.querySelector("[data-a]"), { title: "Pumping and generation", size: "short", source: "ENTSO-E" });
    this.pricePanel = new ChartPanel(root.querySelector("[data-b]"), { title: "Prices and spread", size: "short", source: BOTH });
    this.dayPanel = new ChartPanel(root.querySelector("[data-c]"), { title: "Average day", size: "short", source: BOTH });
    this.panels = [this.energyPanel, this.pricePanel, this.dayPanel];
  }

  async render(id) {
    const got = await Promise.all([getHydroTypes(), getHydroProfileTypes()]);
    if (id !== this.renderId) return;
    const types = got.at(0);
    const prof = got.at(1);
    const years = [...new Set(types.rows.filter(r => r.type === "pump" && r.q > 0).map(r => r.year))].sort((a, b) => a - b);
    if (!years.length) throw new Error("no pumping data yet: run the Spain hydro detail backfill");
    const s = this.state;
    const year = fillYears(this.root, years, s);
    const monthsY = MS.filter(m => (types.get("pump", year, m) || {}).q > 0);
    const P = stats(agg(types, "pump", year, monthsY));
    const S = stats(agg(types, "ps", year, monthsY));
    const PL = stats(agg(types, "pump", year - 1, monthsY));
    const SL = stats(agg(types, "ps", year - 1, monthsY));
    const spread = S.has && P.capture != null ? S.capture - P.capture : null;
    const spreadL = SL.has && PL.capture != null ? SL.capture - PL.capture : null;
    const span = spanText(year, monthsY);
    const month = monthsY.includes(Number(s.month)) ? Number(s.month) : monthsY.at(-1);
    s.month = String(month);
    const msel = this.root.querySelector('[data-k="month"]');
    if (msel) msel.value = s.month;
    const hasL = PL.has;
    const lastTxt = (v, f) => (hasL ? `${year - 1}: ${f(v)}` : "No earlier year to compare");
    this.headline.textContent = `In ${span}, Spanish pumped-storage plants used ${fmtNumber(P.gwh, 0)} GWh pumping at an average ${EUR(P.capture)}` +
      (S.has ? ` and generated ${fmtNumber(S.gwh, 0)} GWh at ${EUR(S.capture)}, a spread of ${gap(spread)}.` : ". Their output is not reported separately for this year.") +
      ` ${fmtNumber(P.negShare, 1)}% of the pumping was in hours at or below zero.`;
    this.root.querySelector("[data-cards]").innerHTML = cards([
      card("Energy used pumping", fmtNumber(P.gwh, 0) + " GWh", lastTxt(PL.gwh, v => fmtNumber(v, 0) + " GWh")),
      card("Pumped-storage output", S.has ? fmtNumber(S.gwh, 0) + " GWh" : "–", S.has ? `${fmtNumber(pct(S.gwh, P.gwh), 0)}% of the energy used pumping` : "Included in reservoir output this year"),
      card("Average pumping price", EUR(P.capture), lastTxt(PL.capture, EUR)),
      card("Average generating price", S.has ? EUR(S.capture) : "–", SL.has ? `${year - 1}: ${EUR(SL.capture)}` : ""),
      card("Spread", gap(spread), spreadL != null ? `${year - 1}: ${gap(spreadL)}` : "Generating minus pumping price", " accent"),
      card("Pumping at or below zero", P.negShare != null ? fmtNumber(P.negShare, 1) + "%" : "–", hasL && PL.negShare != null ? `${year - 1}: ${fmtNumber(PL.negShare, 1)}%` : "Share of energy used pumping")
    ]);
    const mP = MS.map(m => stats(agg(types, "pump", year, [m])));
    const mS = MS.map(m => stats(agg(types, "ps", year, [m])));
    const mPL = MS.map(m => stats(agg(types, "pump", year - 1, [m])));
    const mSL = MS.map(m => stats(agg(types, "ps", year - 1, [m])));
    const opt = (v, ok) => (ok ? v : null);
    this.energyPanel.setTitle(`Pumping and pumped-storage output by month, ${year}`, "GWh · pumping below zero");
    this.energyPanel.render({
      xType: "category", categories: MONTHS, xLabel: x => x, xHeader: "Month", yName: "GWh", zeroLine: true, source: "ENTSO-E",
      series: [
        { name: "Pumping " + year, colour: "--s-ly", type: "bar", stack: "e", unit: "GWh", decimals: 0, avg: false, data: IDX.map(i => [i, opt(-mP.at(i).gwh, mP.at(i).has)]) },
        { name: "Output " + year, colour: "--s-actual", type: "bar", stack: "e", unit: "GWh", decimals: 0, avg: false, data: IDX.map(i => [i, opt(mS.at(i).gwh, mS.at(i).has)]) },
        ...(hasL ? [
          { name: "Pumping " + (year - 1), colour: "--s-avg", type: "line", dashed: true, width: 1.3, unit: "GWh", decimals: 0, avg: false, data: IDX.map(i => [i, opt(-mPL.at(i).gwh, mPL.at(i).has)]) },
          { name: "Output " + (year - 1), colour: "--s-avg", type: "line", width: 1.3, unit: "GWh", decimals: 0, avg: false, data: IDX.map(i => [i, opt(mSL.at(i).gwh, mSL.at(i).has)]) }] : [])
      ],
      notes: ["Spain reports pumped-storage output separately only from about 2021; before that it is included in reservoir output, so output bars are missing for earlier years."]
    });
    this.pricePanel.setTitle(`Pumping and generating prices by month, ${year}`, "€/MWh · spread = generating minus pumping price");
    this.pricePanel.render({
      xType: "category", categories: MONTHS, xLabel: x => x, xHeader: "Month", yName: "€/MWh", zeroLine: true, source: BOTH,
      series: [
        { name: "Spread", colour: "--s-band", type: "bar", unit: "€/MWh", decimals: 2, avg: false, data: IDX.map(i => [i, mS.at(i).has && mP.at(i).capture != null ? mS.at(i).capture - mP.at(i).capture : null]) },
        { name: "Pumping price", colour: "--s-ly", type: "line", width: 1.6, unit: "€/MWh", decimals: 2, avg: false, data: IDX.map(i => [i, mP.at(i).capture]) },
        { name: "Generating price", colour: "--s-actual", type: "line", width: 2.4, unit: "€/MWh", decimals: 2, avg: false, data: IDX.map(i => [i, mS.at(i).has ? mS.at(i).capture : null]) }
      ],
      notes: ["Prices are weighted by the energy pumped or generated each hour. The spread ignores round-trip losses: pumped storage gets back roughly three-quarters of the energy it uses, and water pumped in one month may be released in a later one."]
    });
    const day = prof.filter(r => r.year === year && r.month === month);
    const at = (h, k) => { const r = day.find(x => x.hour === h); return r && r[k] != null ? r[k] : null; };
    const hours = Array.from({ length: 24 }, (x, h) => h);
    this.dayPanel.setTitle(`Average day of pumped storage, ${MONTHS.at(month - 1)} ${year}`, "GW by local hour (left), Spanish price €/MWh (right)");
    this.dayPanel.render({
      xType: "category", categories: hours.map(h => String(h).padStart(2, "0") + ":00"), xLabel: x => x, xHeader: "Hour", yName: "GW", zeroLine: true, source: BOTH,
      yAxis2: { name: "€/MWh", format: v => fmtNumber(v, 0) },
      series: [
        { name: "Pumping", colour: "--s-ly", type: "bar", stack: "p", unit: "GW", decimals: 2, avg: false, data: hours.map(h => [h, at(h, "pump") == null ? null : -at(h, "pump") / 1000]) },
        { name: "Pumped-storage output", colour: "--s-actual", type: "bar", stack: "p", unit: "GW", decimals: 2, avg: false, data: hours.map(h => [h, at(h, "ps") == null ? null : at(h, "ps") / 1000]) },
        { name: "Spanish price", colour: "--s-id", type: "line", dashed: true, width: 1.8, yAxis: 1, unit: "€/MWh", decimals: 2, avg: false, data: hours.map(h => [h, at(h, "price")]) }
      ]
    });
  }
}
