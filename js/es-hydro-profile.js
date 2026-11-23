// Spain Hydro: the Daily profile tab, from data/es/hydro/profile_types.csv
// (average output by year, month and local hour, by type).
// Code note: no asterisks here (chat formatting strips them when pasted).
import { ChartPanel } from "./chart.js";
import { card } from "./market-common.js";
import { fmtNumber, heroHtml } from "./util.js";
import { BOTH } from "./es-data.js";
import { Base, GW, MONTHS, cards, headlineBlock, heatSpec, meanOf, mul, selectHtml, signed } from "./es-common.js";
import { AVG_OPTIONS, fillYears } from "./es-hydro.js";
import { TYPES, TYPE_NOTE, TYPE_OPTIONS, getHydroProfileTypes } from "./es-hydro-data.js";

const HOURS = Array.from({ length: 24 }, (x, h) => h);
const HOUR_LABELS = HOURS.map(h => String(h).padStart(2, "0") + ":00");
const EVENING = [19, 20, 21, 22];
const MIDDAY = [11, 12, 13, 14, 15, 16];
const part = (p, hs) => meanOf(hs.map(h => p.at(h)));
const lift = p => { const e = part(p, EVENING); const m = part(p, MIDDAY); return e == null || m == null ? null : e - m; };

// Average by hour for one year over a set of months, weighted by hours.
function profileOf(byYear, year, months, key) {
  const rows = byYear.get(year) || [];
  return HOURS.map(h => {
    let w = 0;
    let s = 0;
    for (const r of rows) {
      if (r.hour !== h || !months.has(r.month) || r[key] == null) continue;
      s += mul(r[key], r.n);
      w += r.n;
    }
    return w ? s / w : null;
  });
}

export class EsHydroProfile extends Base {
  constructor(root) {
    super(root, "hydro/profile", { year: "", month: "0", type: "total", avg: "5" }, false);
    root.innerHTML = `
      ${heroHtml("When hydro", "runs.", "The average shape of a day of Spanish hydro output by type, for any year and month, against last year and the years before, and how far hydro has moved out of the solar hours into the evening.")}
      <div class="toolbar">
        <label class="field"><span>Year</span><select data-k="year"></select></label>
        ${selectHtml("month", "Months", [["0", "All months so far"], ...MONTHS.map((m, i) => [String(i + 1), m])])}
        ${selectHtml("type", "Type", TYPE_OPTIONS)}
        ${selectHtml("avg", "Average and range", AVG_OPTIONS)}</div>
      ${headlineBlock()}
      <div data-cards></div><div data-a></div><div data-b></div><div data-c></div>`;
    this.wire();
    this.dayPanel = new ChartPanel(root.querySelector("[data-a]"), { title: "Average day", size: "tall", source: BOTH });
    this.heatPanel = new ChartPanel(root.querySelector("[data-b]"), { title: "Against the average", size: "", source: BOTH });
    this.liftPanel = new ChartPanel(root.querySelector("[data-c]"), { title: "Evening lift by year", size: "short", source: BOTH });
    this.panels = [this.dayPanel, this.heatPanel, this.liftPanel];
  }

  async render(id) {
    const rows = await getHydroProfileTypes();
    if (id !== this.renderId) return;
    if (!rows.length) throw new Error("no hydro profile data yet: run the Spain hydro detail backfill");
    const s = this.state;
    const key = TYPES[s.type] ? s.type : "total";
    const name = TYPES[key].short;
    const N = s.avg === "10" ? 10 : 5;
    const byYear = new Map();
    for (const r of rows) {
      if (!byYear.has(r.year)) byYear.set(r.year, []);
      byYear.get(r.year).push(r);
    }
    const years = [...byYear.keys()].filter(y => byYear.get(y).some(r => r[key] != null && r[key] !== 0)).sort((a, b) => a - b);
    if (!years.length) throw new Error("no data for " + TYPES[key].label.toLowerCase() + " yet");
    const year = fillYears(this.root, years, s);
    const monthsY = new Set(byYear.get(year).filter(r => r[key] != null).map(r => r.month));
    const months = s.month === "0" ? monthsY : new Set([Number(s.month)]);
    const earlier = years.filter(y => y < year && y >= year - N);
    const pY = profileOf(byYear, year, months, key);
    if (pY.every(v => v == null)) throw new Error("no data for that month yet");
    const pLy = profileOf(byYear, year - 1, months, key);
    const pE = earlier.map(y => profileOf(byYear, y, months, key));
    const avg = HOURS.map(h => meanOf(pE.map(p => p.at(h))));
    const price = profileOf(byYear, year, months, "price");
    const sorted = [...months].sort((a, b) => a - b);
    const monthText = sorted.length === 1 ? MONTHS.at(sorted.at(0) - 1) : MONTHS.at(sorted.at(0) - 1) + "–" + MONTHS.at(sorted.at(-1) - 1);
    const avgName = !earlier.length ? "earlier years" : earlier.length === 1 ? `${earlier.at(0)} average` : `${earlier.at(0)}–${earlier.at(-1)} average`;
    const valid = pY.filter(v => v != null);
    const peakHour = pY.indexOf(Math.max(...valid));
    this.headline.textContent = `In ${year} (${monthText}), Spanish ${name} averaged ${GW(part(pY, EVENING))} in the evening (19:00–23:00) and ${GW(part(pY, MIDDAY))} at midday (11:00–17:00): an evening lift of ${GW(lift(pY))}, against ${GW(lift(pLy))} a year earlier and ${GW(lift(avg))} on the ${avgName}.`;
    this.root.querySelector("[data-cards]").innerHTML = cards([
      card("Average output", GW(meanOf(pY)), `${year - 1}: ${GW(meanOf(pLy))}`),
      card("Midday (11:00–17:00)", GW(part(pY, MIDDAY)), `${avgName}: ${GW(part(avg, MIDDAY))}`),
      card("Evening (19:00–23:00)", GW(part(pY, EVENING)), `${avgName}: ${GW(part(avg, EVENING))}`),
      card("Evening lift", GW(lift(pY)), `Evening minus midday · ${year - 1}: ${GW(lift(pLy))}`, " accent"),
      card("Peak hour", HOUR_LABELS.at(peakHour), "Average " + GW(pY.at(peakHour)))
    ]);
    const gw = v => (v == null ? null : v / 1000);
    this.dayPanel.setTitle(`Average day of Spanish ${name}, ${year} (${monthText})`, "GW by local hour (left), Spanish price €/MWh (right)");
    this.dayPanel.render({
      xType: "category", categories: HOUR_LABELS, xLabel: x => x, xHeader: "Hour", yName: "GW", zeroLine: true, source: BOTH,
      yAxis2: { name: "€/MWh", format: v => fmtNumber(v, 0) },
      series: [
        { name: "Range, " + avgName.replace(" average", ""), colour: "--s-band", type: "band", unit: "GW", data: HOURS.map(h => { const xs = pE.map(p => p.at(h)).filter(v => v != null); return [h, xs.length >= 2 ? Math.min(...xs) / 1000 : null, xs.length >= 2 ? Math.max(...xs) / 1000 : null]; }) },
        { name: avgName, colour: "--s-avg", type: "line", dashed: true, width: 1.4, unit: "GW", decimals: 2, avg: false, data: HOURS.map(h => [h, gw(avg.at(h))]) },
        { name: String(year - 1), colour: "--s-ly", type: "line", width: 1.5, unit: "GW", decimals: 2, avg: false, data: HOURS.map(h => [h, gw(pLy.at(h))]) },
        { name: String(year), colour: "--s-actual", type: "line", width: 2.6, z: 20, unit: "GW", decimals: 2, avg: false, data: HOURS.map(h => [h, gw(pY.at(h))]) },
        { name: "Spanish price " + year, colour: "--s-id", type: "line", dashed: true, width: 1.3, yAxis: 1, unit: "€/MWh", decimals: 2, avg: false, data: HOURS.map(h => [h, price.at(h)]) }
      ],
      notes: ["Comparisons use the same months in every year. " + TYPE_NOTE]
    });
    const rowsM = [...monthsY].sort((a, b) => a - b);
    const grid = rowsM.map(mo => {
      const one = new Set([mo]);
      const y = profileOf(byYear, year, one, key);
      const e = earlier.map(yr => profileOf(byYear, yr, one, key));
      return HOURS.map(h => { const a = meanOf(e.map(p => p.at(h))); const v = y.at(h); return v == null || a == null ? null : Math.round((v - a) / 10) / 100; });
    });
    this.heatPanel.setTitle(`${year} against the ${avgName}, by month and hour`, "GW difference · blue: more than usual, red: less");
    this.heatPanel.render(heatSpec({ rows: rowsM.map(mo => MONTHS.at(mo - 1)), cols: HOURS.map(h => String(h).padStart(2, "0")), values: grid, label: "Difference", fmt: v => signed(v, x => fmtNumber(x, 2) + " GW"), source: BOTH, colours: ["#c0675e", "#9aa3ad", "#5b8bc4"] }));
    const liftYears = years.filter(y => y <= year);
    this.liftPanel.setTitle(`Evening lift by year, ${monthText}`, "GW · average 19:00–23:00 minus average 11:00–17:00, same months each year");
    this.liftPanel.render({
      xType: "category", categories: liftYears.map(String), xLabel: x => x, xHeader: "Year", yName: "GW", zeroLine: true, source: BOTH,
      series: [{ name: "Evening lift", colour: "--s-actual", type: "bar", unit: "GW", decimals: 2, avg: false, data: liftYears.map((y, i) => [i, gw(lift(profileOf(byYear, y, months, key)))]) }],
      notes: ["A rising lift means hydro is holding water back during the solar hours and releasing it in the evening, when prices are higher."]
    });
  }
}
