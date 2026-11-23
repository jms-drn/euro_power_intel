// Spain Hydro: the Daily profile tab, from data/es/hydro/profile.csv
// (average output by year, month and local hour) built by scripts/es_hydro.py.
// Code note: no asterisks here (chat formatting strips them when pasted).
import { ChartPanel } from "./chart.js";
import { card } from "./market-common.js";
import { fmtNumber, heroHtml } from "./util.js";
import { REE, getHydroProfile } from "./es-data.js";
import { Base, GW, MONTHS, cards, headlineBlock, heatSpec, meanOf, mul, selectHtml, signed } from "./es-common.js";
import { fillYears } from "./es-hydro.js";

const HOURS = Array.from({ length: 24 }, (x, h) => h);
const HOUR_LABELS = HOURS.map(h => String(h).padStart(2, "0") + ":00");
const EVENING = [19, 20, 21, 22];
const MIDDAY = [11, 12, 13, 14, 15, 16];
const SERIES = { net: "hydro output (net of pumping)", gross: "hydro output before pumping" };
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
    super(root, "hydro/profile", { year: "", month: "0", key: "net" }, false);
    root.innerHTML = `
      ${heroHtml("When hydro", "runs.", "The average shape of a day of Spanish hydro output, for any year and month, against last year and the five years before, and how far hydro has moved out of the solar hours into the evening.")}
      <div class="toolbar">
        <label class="field"><span>Year</span><select data-k="year"></select></label>
        ${selectHtml("month", "Months", [["0", "All months so far"], ...MONTHS.map((m, i) => [String(i + 1), m])])}
        ${selectHtml("key", "Series", [["net", "Hydro, net of pumping (all years)"], ["gross", "Hydro before pumping (from Dec 2024)"]])}</div>
      ${headlineBlock()}
      <div data-cards></div><div data-a></div><div data-b></div><div data-c></div>`;
    this.wire();
    this.dayPanel = new ChartPanel(root.querySelector("[data-a]"), { title: "Average day", size: "tall", source: REE });
    this.heatPanel = new ChartPanel(root.querySelector("[data-b]"), { title: "Against the 5-year average", size: "", source: REE });
    this.liftPanel = new ChartPanel(root.querySelector("[data-c]"), { title: "Evening lift by year", size: "short", source: REE });
    this.panels = [this.dayPanel, this.heatPanel, this.liftPanel];
  }

  async render(id) {
    const rows = await getHydroProfile();
    if (id !== this.renderId) return;
    if (!rows.length) throw new Error("no hydro profile data yet");
    const s = this.state;
    const key = s.key === "gross" ? "gross" : "net";
    const byYear = new Map();
    for (const r of rows) {
      if (!byYear.has(r.year)) byYear.set(r.year, []);
      byYear.get(r.year).push(r);
    }
    const years = [...byYear.keys()].filter(y => byYear.get(y).some(r => r[key] != null)).sort((a, b) => a - b);
    if (!years.length) throw new Error("hydro before pumping is only published from Dec 2024");
    const year = fillYears(this.root, years, s);
    const monthsY = new Set(byYear.get(year).filter(r => r[key] != null).map(r => r.month));
    const months = s.month === "0" ? monthsY : new Set([Number(s.month)]);
    const earlier = years.filter(y => y < year && y >= year - 5);
    const pY = profileOf(byYear, year, months, key);
    if (pY.every(v => v == null)) throw new Error("no data for that month yet");
    const pLy = profileOf(byYear, year - 1, months, key);
    const pE = earlier.map(y => profileOf(byYear, y, months, key));
    const avg = HOURS.map(h => meanOf(pE.map(p => p.at(h))));
    const price = profileOf(byYear, year, months, "price");
    const sorted = [...months].sort((a, b) => a - b);
    const monthText = sorted.length === 1 ? MONTHS.at(sorted.at(0) - 1) : MONTHS.at(sorted.at(0) - 1) + "–" + MONTHS.at(sorted.at(-1) - 1);
    const avgName = earlier.length ? `${earlier.at(0)}–${earlier.at(-1)} average` : "earlier years";
    const valid = pY.filter(v => v != null);
    const peakHour = pY.indexOf(Math.max(...valid));
    this.headline.textContent = `In ${year} (${monthText}), Spanish ${SERIES[key]} averaged ${GW(part(pY, EVENING))} in the evening (19:00–23:00) and ${GW(part(pY, MIDDAY))} at midday (11:00–17:00): an evening lift of ${GW(lift(pY))}, against ${GW(lift(pLy))} a year earlier and ${GW(lift(avg))} on the ${avgName}.`;
    this.root.querySelector("[data-cards]").innerHTML = cards([
      card("Average output", GW(meanOf(pY)), `${year - 1}: ${GW(meanOf(pLy))}`),
      card("Midday (11:00–17:00)", GW(part(pY, MIDDAY)), `${avgName}: ${GW(part(avg, MIDDAY))}`),
      card("Evening (19:00–23:00)", GW(part(pY, EVENING)), `${avgName}: ${GW(part(avg, EVENING))}`),
      card("Evening lift", GW(lift(pY)), `Evening minus midday · ${year - 1}: ${GW(lift(pLy))}`, " accent"),
      card("Peak hour", HOUR_LABELS.at(peakHour), "Average " + GW(pY.at(peakHour)))
    ]);
    const gw = v => (v == null ? null : v / 1000);
    this.dayPanel.setTitle(`Average day of Spanish ${SERIES[key]}, ${year} (${monthText})`, "GW by local hour (left), Spanish price €/MWh (right)");
    this.dayPanel.render({
      xType: "category", categories: HOUR_LABELS, xLabel: x => x, xHeader: "Hour", yName: "GW", zeroLine: true, source: REE,
      yAxis2: { name: "€/MWh", format: v => fmtNumber(v, 0) },
      series: [
        { name: "Range " + avgName.replace(" average", ""), colour: "--s-d2", type: "band", data: HOURS.map(h => { const xs = pE.map(p => p.at(h)).filter(v => v != null); return [h, xs.length ? Math.min(...xs) / 1000 : null, xs.length ? Math.max(...xs) / 1000 : null]; }) },
        { name: avgName, colour: "--s-d1", type: "line", dashed: true, width: 1.4, unit: "GW", decimals: 2, avg: false, data: HOURS.map(h => [h, gw(avg.at(h))]) },
        { name: String(year - 1), colour: "--s-ly", type: "line", width: 1.6, unit: "GW", decimals: 2, avg: false, data: HOURS.map(h => [h, gw(pLy.at(h))]) },
        { name: String(year), colour: "--s-actual", type: "line", width: 2.8, unit: "GW", decimals: 2, avg: false, data: HOURS.map(h => [h, gw(pY.at(h))]) },
        { name: "Spanish price " + year, colour: "--s-id", type: "line", dashed: true, width: 1.4, yAxis: 1, unit: "€/MWh", decimals: 2, avg: false, data: HOURS.map(h => [h, price.at(h)]) }
      ],
      notes: ["Comparisons use the same months in every year. Net of pumping, hydro can dip below zero in the hours when pumped storage consumes more than hydro plants produce."]
    });
    const rowsM = [...monthsY].sort((a, b) => a - b);
    const grid = rowsM.map(mo => {
      const one = new Set([mo]);
      const y = profileOf(byYear, year, one, key);
      const e = earlier.map(yr => profileOf(byYear, yr, one, key));
      return HOURS.map(h => { const a = meanOf(e.map(p => p.at(h))); const v = y.at(h); return v == null || a == null ? null : Math.round((v - a) / 10) / 100; });
    });
    this.heatPanel.setTitle(`${year} against the ${avgName}, by month and hour`, "GW difference · blue: more hydro than usual, red: less");
    this.heatPanel.render(heatSpec({ rows: rowsM.map(mo => MONTHS.at(mo - 1)), cols: HOURS.map(h => String(h).padStart(2, "0")), values: grid, label: "Difference", fmt: v => signed(v, x => fmtNumber(x, 2) + " GW"), source: REE, colours: ["#ef4444", "#111827", "#3b82f6"] }));
    const liftYears = years.filter(y => y <= year);
    this.liftPanel.setTitle(`Evening lift by year, ${monthText}`, "GW · average 19:00–23:00 minus average 11:00–17:00, same months each year");
    this.liftPanel.render({
      xType: "category", categories: liftYears.map(String), xLabel: x => x, xHeader: "Year", yName: "GW", zeroLine: true, source: REE,
      series: [{ name: "Evening lift", colour: "--f-hydro", type: "bar", unit: "GW", decimals: 2, avg: false, data: liftYears.map((y, i) => [i, gw(lift(profileOf(byYear, y, months, key)))]) }],
      notes: ["A rising lift means hydro is holding water back during the solar hours and releasing it in the evening, when prices are higher. " + (key === "net" ? "" : "Hydro before pumping exists only from Dec 2024.")]
    });
  }
}
