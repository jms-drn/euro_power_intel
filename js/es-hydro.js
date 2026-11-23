// Spain Hydro: the Hydro year tab (calendar year, January to December), plus
// helpers shared by the other Hydro tabs.
// Code note: no asterisks here (chat formatting strips them when pasted).
import { ChartPanel } from "./chart.js";
import { card } from "./market-common.js";
import { addDays, fmtDate, fmtLongDate, fmtNumber, heroHtml, parisMidnight } from "./util.js";
import { MITECO, REE, getMixDaily, getReservoirs } from "./es-data.js";
import { Base, MONTHS, cards, headlineBlock, meanOf, mul, pct, selectHtml, signed } from "./es-common.js";
import { TYPES, TYPE_NOTE, TYPE_OPTIONS, getHydroTypes } from "./es-hydro-data.js";

export const SOURCE = "MITECO and REE";
export const AVG_OPTIONS = [["5", "5 years before"], ["10", "10 years before"]];
// The same day k years later (negative k: earlier); 29 Feb becomes 28 Feb.
export function shiftDate(d, years) {
  const md = d.slice(5) === "02-29" ? "02-28" : d.slice(5);
  return String(Number(d.slice(0, 4)) + years) + "-" + md;
}
// Value at the bulletin nearest a date (within 4 days), from a Map of date to value.
export function near(map, d) {
  for (const k of [0, -1, 1, -2, 2, -3, 3, -4, 4]) {
    const v = map.get(addDays(d, k));
    if (v != null) return v;
  }
  return null;
}
export const yearsBack = n => Array.from({ length: n }, (x, i) => i + 1);
// Fills a year drop-down (data-k="year") once and returns the chosen year.
export function fillYears(root, years, state) {
  const sel = root.querySelector('[data-k="year"]');
  if (sel && !sel.options.length) sel.innerHTML = [...years].reverse().map(y => `<option value="${y}">${y}</option>`).join("");
  const year = years.includes(Number(state.year)) ? Number(state.year) : years.at(-1);
  state.year = String(year);
  if (sel) sel.value = state.year;
  return year;
}
// Average MW of a type over some months of a year (from the monthly sums).
export function avgMw(types, ty, year, months) {
  let mwh = 0;
  let hours = 0;
  for (const m of months) {
    const r = types.get(ty, year, m);
    if (r && r.hours) { mwh += r.mwh; hours += r.hours; }
  }
  return hours ? mwh / hours : null;
}

const METRICS = {
  energy: { label: "Hydroelectric energy stored", short: "hydroelectric energy stored", unit: "TWh", v: r => r.energy, cap: r => r.energy_cap, scale: 1000, dec: 2 },
  hydro: { label: "Water in hydroelectric reservoirs", short: "water in hydroelectric reservoirs", unit: "hm³", v: r => r.hydro_water_hm3, cap: r => r.hydro_cap_hm3, scale: 1, dec: 0 },
  all: { label: "Water in all reservoirs", short: "water in all reservoirs", unit: "hm³", v: r => r.water_hm3, cap: r => r.cap_hm3, scale: 1, dec: 0 }
};

export class EsHydroYear extends Base {
  constructor(root) {
    super(root, "hydro/year", { metric: "energy", show: "pct", avg: "5", type: "total" }, false);
    root.innerHTML = `
      ${heroHtml("Spain's hydro", "this year.", "Reservoir levels from MITECO's weekly hydrological bulletin since 1988, January to December, against last year and the average and range of the five (or ten) years before, with hydro output by month and the inflow it implies.")}
      <div class="toolbar">
        ${selectHtml("metric", "Reserve", [["energy", "Hydroelectric energy (MITECO)"], ["hydro", "Water, hydroelectric reservoirs"], ["all", "Water, all reservoirs"]])}
        ${selectHtml("show", "Show", [["pct", "% full"], ["abs", "Amount"]])}
        ${selectHtml("avg", "Average and range", AVG_OPTIONS)}
        ${selectHtml("type", "Output", TYPE_OPTIONS)}</div>
      ${headlineBlock()}
      <div data-cards></div><div data-a></div><div data-b></div><div data-c></div>`;
    this.wire();
    this.resPanel = new ChartPanel(root.querySelector("[data-a]"), { title: "Reserves", size: "tall", source: MITECO });
    this.outPanel = new ChartPanel(root.querySelector("[data-b]"), { title: "Output by month", size: "short", source: "REE and ENTSO-E" });
    this.inPanel = new ChartPanel(root.querySelector("[data-c]"), { title: "Estimated inflow", size: "short", source: SOURCE });
    this.panels = [this.resPanel, this.outPanel, this.inPanel];
  }

  async render(id) {
    const s = this.state;
    const got = await Promise.all([getReservoirs(), getMixDaily(), getHydroTypes()]);
    if (id !== this.renderId) return;
    const res = got.at(0).rows.filter(r => r.date);
    const mix = got.at(1);
    const types = got.at(2);
    if (!res.length) throw new Error("no reservoir data yet");
    const m = METRICS[s.metric] || METRICS.energy;
    const K = yearsBack(s.avg === "10" ? 10 : 5);
    const N = K.length;
    const isPct = s.show === "pct";
    const val = r => { const v = m.v(r); const c = m.cap(r); if (v == null) return null; return isPct ? (c ? pct(v, c) : null) : v / m.scale; };
    const unit = isPct ? "%" : m.unit;
    const dec = isPct ? 1 : m.dec;
    const fmtV = v => (v == null ? "–" : fmtNumber(v, dec) + (isPct ? "%" : " " + unit));
    const word = isPct ? " pp" : " " + unit;
    const diff = v => signed(v, x => fmtNumber(x, dec) + word);
    const vs = (v, ref) => (v == null || ref == null ? "–" : fmtNumber(Math.abs(v - ref), dec) + word + (v >= ref ? " above " : " below "));
    const byDate = new Map(res.map(r => [r.date, val(r)]));
    const last = res.at(-1);
    const prev = res.at(-2);
    const lastD = last.date;
    const year = Number(lastD.slice(0, 4));
    const start = year + "-01-01";
    const end = year + "-12-31";
    const firstB = (res.find(r => r.date >= start) || { date: start }).date;
    const anchors = [];
    for (let d = firstB; d <= end; d = addDays(d, 7)) anchors.push(d);
    const at = (d, k) => near(byDate, shiftDate(d, -k));
    const avgK = (d, ks) => meanOf(ks.map(k => at(d, k)));
    const nowV = byDate.get(lastD);
    const lyV = at(lastD, 1);
    const a5 = avgK(lastD, yearsBack(5));
    const a10 = avgK(lastD, yearsBack(10));
    const weekChange = prev ? (val(last) ?? 0) - (val(prev) ?? 0) : null;
    const eChange = prev && last.energy != null && prev.energy != null ? last.energy - prev.energy : null;

    // Estimated inflow between bulletins: REE net hydro output plus the change in energy stored.
    const gwhOf = d => { const r = mix.byDate.get(d); return r && r.hydro != null ? mul(r.hydro, 24) / 1000 : null; };
    const inflow = new Map();
    for (let i = 1; i < res.length; i++) {
      const a = res.at(i - 1);
      const b = res.at(i);
      if (a.energy == null || b.energy == null) continue;
      let gen = 0;
      let ok = true;
      for (let d = addDays(a.date, 1); d <= b.date; d = addDays(d, 1)) {
        const g = gwhOf(d);
        if (g == null) { ok = false; break; }
        gen += g;
      }
      if (ok) inflow.set(b.date, gen + b.energy - a.energy);
    }
    const recentB = res.slice(-4).map(r => r.date);
    const in4 = recentB.reduce((acc, d) => acc + (inflow.get(d) ?? 0), 0);
    const in4avg = meanOf(K.map(k => { const xs = recentB.map(d => near(inflow, shiftDate(d, -k))); return xs.some(x => x == null) ? null : xs.reduce((p, q) => p + q, 0); }));

    // Output by month for the chosen type (average MW, so a part month compares fairly).
    const ty = TYPES[s.type] ? s.type : "total";
    const monthsNow = [];
    for (let mo = 1; mo <= 12; mo++) if ((types.get(ty, year, mo) || {}).hours) monthsNow.push(mo);
    const outNow = avgMw(types, ty, year, monthsNow);
    const outLy = avgMw(types, ty, year - 1, monthsNow);
    const span = monthsNow.length ? MONTHS.at(monthsNow.at(0) - 1) + "–" + MONTHS.at(monthsNow.at(-1) - 1) : "";

    this.headline.textContent = `In MITECO's bulletin of ${fmtLongDate(lastD)}, Spanish ${m.short} stood at ${fmtV(nowV)}${weekChange != null ? `, ${diff(weekChange)} on the week` : ""}: ${vs(nowV, lyV)}a year earlier and ${vs(nowV, avgK(lastD, K))}the ${N}-year average for the time of year.`;
    this.root.querySelector("[data-cards]").innerHTML = cards([
      card(m.label, fmtV(nowV), "MITECO bulletin of " + fmtLongDate(lastD), " accent"),
      card("Change on the week", diff(weekChange), eChange != null ? signed(eChange, x => fmtNumber(x, 0) + " GWh") + " of hydroelectric energy" : ""),
      card("Against a year earlier", diff(lyV == null ? null : nowV - lyV), "Same week last year " + fmtV(lyV)),
      card("Against the 5-year average", diff(a5 == null ? null : nowV - a5), "Average " + fmtV(a5)),
      card("Against the 10-year average", diff(a10 == null ? null : nowV - a10), "Average " + fmtV(a10)),
      card(TYPES[ty].label + ", " + year, outNow != null ? fmtNumber(outNow / 1000, 2) + " GW" : "–", outLy ? `Average ${span} · ${signed(pct(outNow - outLy, outLy), x => fmtNumber(x, 1) + "%")} on last year` : "Average " + span),
      card("Estimated inflow, last 4 weeks", fmtNumber(in4, 0) + " GWh", in4avg != null ? N + "-year average " + fmtNumber(in4avg, 0) + " GWh" : "")
    ]);

    const band = anchors.map(d => { const xs = K.map(k => at(d, k)).filter(v => v != null); return [parisMidnight(d), xs.length >= 2 ? Math.min(...xs) : null, xs.length >= 2 ? Math.max(...xs) : null]; });
    this.resPanel.setTitle(`${m.label}, ${year}`, `${isPct ? "% full" : unit} · weekly bulletins, earlier years on the same dates`);
    this.resPanel.render({
      xType: "time", xLabel: fmtDate, yName: isPct ? "%" : unit, yMin: 0, source: MITECO,
      series: [
        { name: `Range, ${N} years before`, colour: "--s-band", type: "band", data: band, unit },
        { name: `${N}-year average`, colour: "--s-avg", type: "line", dashed: true, width: 1.4, unit, decimals: dec, avg: false, data: anchors.map(d => [parisMidnight(d), avgK(d, K)]) },
        { name: "Last year", colour: "--s-ly", type: "line", width: 1.5, unit, decimals: dec, avg: false, data: anchors.map(d => [parisMidnight(d), at(d, 1)]) },
        { name: String(year), colour: "--s-actual", type: "line", width: 2.6, z: 20, unit, decimals: dec, avg: false, data: res.filter(r => r.date >= start).map(r => [parisMidnight(r.date), val(r)]) }
      ],
      notes: ["MITECO's weekly bulletin covers mainland reservoirs over 5 hm³. Hydroelectric energy is MITECO's calculation of the energy the stored water could produce. Earlier years are read at the bulletin nearest the same date."]
    });

    const idx = MONTHS.map((x, i) => i);
    const gw = v => (v == null ? null : v / 1000);
    const monthVal = (y, i) => { const r = types.get(ty, y, i + 1); return r && r.hours ? gw(r.mwh / r.hours) : null; };
    this.outPanel.setTitle(`${TYPES[ty].label}, average output by month, ${year}`, `GW · against last year and the ${N} years before`);
    this.outPanel.render({
      xType: "category", categories: MONTHS, xLabel: x => x, xHeader: "Month", yName: "GW", zeroLine: true, source: "REE and ENTSO-E",
      series: [
        { name: `Range, ${N} years before`, colour: "--s-band", type: "band", data: idx.map(i => { const xs = K.map(k => monthVal(year - k, i)).filter(v => v != null); return [i, xs.length >= 2 ? Math.min(...xs) : null, xs.length >= 2 ? Math.max(...xs) : null]; }), unit: "GW" },
        { name: `${N}-year average`, colour: "--s-avg", type: "line", dashed: true, width: 1.4, unit: "GW", decimals: 2, avg: false, data: idx.map(i => [i, meanOf(K.map(k => monthVal(year - k, i)))]) },
        { name: "Last year", colour: "--s-ly", type: "line", width: 1.5, unit: "GW", decimals: 2, avg: false, data: idx.map(i => [i, monthVal(year - 1, i)]) },
        { name: String(year), colour: "--s-actual", type: "bar", barWidth: 14, unit: "GW", decimals: 2, avg: false, data: idx.map(i => [i, monthVal(year, i)]) }
      ],
      notes: ["Average output over each month, so the current month to date compares fairly with full months in earlier years. " + TYPE_NOTE]
    });

    this.inPanel.setTitle(`Estimated weekly inflow, ${year}`, "GWh · REE net hydro output plus the change in hydroelectric energy stored");
    this.inPanel.render({
      xType: "time", xLabel: fmtDate, yName: "GWh", zeroLine: true, source: SOURCE,
      series: [
        { name: `${N}-year average`, colour: "--s-avg", type: "line", dashed: true, width: 1.4, unit: "GWh", decimals: 0, avg: false, data: anchors.map(d => [parisMidnight(d), meanOf(K.map(k => near(inflow, shiftDate(d, -k))))]) },
        { name: String(year), colour: "--s-actual", type: "bar", unit: "GWh", decimals: 0, avg: false, data: res.filter(r => r.date >= start && inflow.has(r.date)).map(r => [parisMidnight(r.date), inflow.get(r.date)]) }
      ],
      notes: ["The site's own estimate: REE's net hydro output between two bulletins plus the change in MITECO's hydroelectric energy stored. It ignores spills, evaporation and water released without generating, so it understates inflow in very wet weeks."]
    });
  }
}
