// Spain Hydro: the Hydro year tab, plus helpers shared by the other Hydro
// tabs (es-hydro-profile.js, es-hydro-value.js).
// Code note: no asterisks here (chat formatting strips them when pasted).
import { ChartPanel } from "./chart.js";
import { card } from "./market-common.js";
import { addDays, fmtDate, fmtLongDate, fmtNumber, heroHtml, parisMidnight, todayParis } from "./util.js";
import { MITECO, REE, getMixDaily, getReservoirs } from "./es-data.js";
import { Base, cards, headlineBlock, meanOf, mul, pct, selectHtml, signed } from "./es-common.js";

export const SOURCE = "MITECO and REE";
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
// First calendar year of the hydro year (1 Oct to 30 Sep) containing a date.
export const hydroYear = d => (Number(d.slice(5, 7)) >= 10 ? Number(d.slice(0, 4)) : Number(d.slice(0, 4)) - 1);
export const hyLabel = y => y + "/" + String(y + 1).slice(2);
// Fills a year drop-down (data-k="year") once and returns the chosen year.
export function fillYears(root, years, state) {
  const sel = root.querySelector('[data-k="year"]');
  if (sel && !sel.options.length) sel.innerHTML = [...years].reverse().map(y => `<option value="${y}">${y}</option>`).join("");
  const year = years.includes(Number(state.year)) ? Number(state.year) : years.at(-1);
  state.year = String(year);
  if (sel) sel.value = state.year;
  return year;
}

const METRICS = {
  energy: { label: "Hydroelectric energy stored", short: "hydroelectric energy stored", unit: "TWh", v: r => r.energy, cap: r => r.energy_cap, scale: 1000, dec: 2 },
  hydro: { label: "Water in hydroelectric reservoirs", short: "water in hydroelectric reservoirs", unit: "hm³", v: r => r.hydro_water_hm3, cap: r => r.hydro_cap_hm3, scale: 1, dec: 0 },
  all: { label: "Water in all reservoirs", short: "water in all reservoirs", unit: "hm³", v: r => r.water_hm3, cap: r => r.cap_hm3, scale: 1, dec: 0 }
};
const K5 = [1, 2, 3, 4, 5];
const K10 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export class EsHydroYear extends Base {
  constructor(root) {
    super(root, "hydro/year", { metric: "energy", show: "pct" }, false);
    root.innerHTML = `
      ${heroHtml("Spain's hydro", "year.", "Reservoir levels from MITECO's weekly hydrological bulletin since 1988, through the hydro year (October to September) against last year and the 5- and 10-year average and range, with hydro output since 1 October and the inflow it implies.")}
      <div class="toolbar">
        ${selectHtml("metric", "Reserve", [["energy", "Hydroelectric energy (MITECO)"], ["hydro", "Water, hydroelectric reservoirs"], ["all", "Water, all reservoirs"]])}
        ${selectHtml("show", "Show", [["pct", "% full"], ["abs", "Amount"]])}</div>
      ${headlineBlock()}
      <div data-cards></div><div data-a></div><div data-b></div><div data-c></div>`;
    this.wire();
    this.resPanel = new ChartPanel(root.querySelector("[data-a]"), { title: "Reserves", size: "tall", source: MITECO });
    this.cumPanel = new ChartPanel(root.querySelector("[data-b]"), { title: "Output since 1 October", size: "short", source: REE });
    this.inPanel = new ChartPanel(root.querySelector("[data-c]"), { title: "Estimated inflow", size: "short", source: SOURCE });
    this.panels = [this.resPanel, this.cumPanel, this.inPanel];
  }

  async render(id) {
    const s = this.state;
    const got = await Promise.all([getReservoirs(), getMixDaily()]);
    if (id !== this.renderId) return;
    const res = got.at(0).rows.filter(r => r.date);
    const mix = got.at(1);
    if (!res.length) throw new Error("no reservoir data yet");
    const m = METRICS[s.metric] || METRICS.energy;
    const isPct = s.show === "pct";
    const val = r => { const v = m.v(r); const c = m.cap(r); if (v == null) return null; return isPct ? (c ? pct(v, c) : null) : v / m.scale; };
    const unit = isPct ? "%" : m.unit;
    const dec = isPct ? 1 : m.dec;
    const fmtV = v => (v == null ? "–" : fmtNumber(v, dec) + (isPct ? "%" : " " + unit));
    const diffWord = isPct ? " pp" : " " + unit;
    const diff = v => signed(v, x => fmtNumber(x, dec) + diffWord);
    const vs = (v, ref) => (v == null || ref == null ? "–" : fmtNumber(Math.abs(v - ref), dec) + diffWord + (v >= ref ? " above " : " below "));
    const byDate = new Map(res.map(r => [r.date, val(r)]));
    const last = res.at(-1);
    const prev = res.at(-2);
    const lastD = last.date;
    const hy = hydroYear(lastD);
    const start = hy + "-10-01";
    const end = (hy + 1) + "-09-30";
    const firstB = (res.find(r => r.date >= start) || { date: start }).date;
    const anchors = [];
    for (let d = firstB; d <= end; d = addDays(d, 7)) anchors.push(d);
    const at = (d, k) => near(byDate, shiftDate(d, -k));
    const avgK = (d, ks) => meanOf(ks.map(k => at(d, k)));
    const nowV = byDate.get(lastD);
    const lyV = at(lastD, 1);
    const a5 = avgK(lastD, K5);
    const a10 = avgK(lastD, K10);
    const weekChange = prev ? (val(last) ?? 0) - (val(prev) ?? 0) : null;
    const eChange = prev && last.energy != null && prev.energy != null ? last.energy - prev.energy : null;

    // Hydro output (REE net figure) by day, GWh, and cumulative from 1 Oct.
    const gwhOf = d => { const r = mix.byDate.get(d); return r && r.hydro != null ? mul(r.hydro, 24) / 1000 : null; };
    const today = todayParis();
    const cum = y => {
      const out = [];
      let acc = 0;
      for (let i = 0; i < 365; i++) {
        const d = addDays(y + "-10-01", i);
        if (d > today) break;
        const g = gwhOf(d);
        if (g != null) acc += g;
        out.push(acc);
      }
      return out;
    };
    const cNow = cum(hy);
    const cLy = hy - 1 >= 2015 ? cum(hy - 1) : [];
    const cPrev = K5.map(k => hy - k).filter(y => y >= 2015).map(cum);
    const n = cNow.length;
    const outNow = n ? cNow.at(n - 1) : null;
    const outLy = cLy.length >= n && n ? cLy.at(n - 1) : null;

    // Estimated inflow between bulletins: hydro output plus the change in energy stored.
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
    const in4avg = meanOf(K5.map(k => { const xs = recentB.map(d => near(inflow, shiftDate(d, -k))); return xs.some(x => x == null) ? null : xs.reduce((p, q) => p + q, 0); }));

    this.headline.textContent = `In MITECO's bulletin of ${fmtLongDate(lastD)}, Spanish ${m.short} stood at ${fmtV(nowV)}${weekChange != null ? `, ${diff(weekChange)} on the week` : ""}: ${vs(nowV, lyV)}a year earlier and ${vs(nowV, a10)}the 10-year average for the time of year.`;
    this.root.querySelector("[data-cards]").innerHTML = cards([
      card(m.label, fmtV(nowV), "MITECO bulletin of " + fmtLongDate(lastD), " accent"),
      card("Change on the week", diff(weekChange), eChange != null ? signed(eChange, x => fmtNumber(x, 0) + " GWh") + " of hydroelectric energy" : ""),
      card("Against a year earlier", diff(lyV == null ? null : nowV - lyV), "Same week last year " + fmtV(lyV)),
      card("Against the 5-year average", diff(a5 == null ? null : nowV - a5), "Average " + fmtV(a5)),
      card("Against the 10-year average", diff(a10 == null ? null : nowV - a10), "Average " + fmtV(a10)),
      card("Hydro output this hydro year", outNow != null ? fmtNumber(outNow / 1000, 2) + " TWh" : "–", outLy ? signed(pct(outNow - outLy, outLy), x => fmtNumber(x, 1) + "%") + " on the same days last year" : "Since 1 Oct, net of pumping"),
      card("Estimated inflow, last 4 weeks", fmtNumber(in4, 0) + " GWh", in4avg != null ? "5-year average " + fmtNumber(in4avg, 0) + " GWh" : "")
    ]);

    const band = anchors.map(d => { const xs = K10.map(k => at(d, k)).filter(v => v != null); return [parisMidnight(d), xs.length ? Math.min(...xs) : null, xs.length ? Math.max(...xs) : null]; });
    this.resPanel.setTitle(`${m.label}, hydro year ${hyLabel(hy)}`, `${isPct ? "% full" : unit} · weekly bulletins, earlier years on the same dates`);
    this.resPanel.render({
      xType: "time", xLabel: fmtDate, yName: isPct ? "%" : unit, yMin: 0, source: MITECO,
      series: [
        { name: "Range, 10 years before", colour: "--s-d2", type: "band", data: band },
        { name: "10-year average", colour: "--s-d2", type: "line", dashed: true, width: 1.4, unit, decimals: dec, avg: false, data: anchors.map(d => [parisMidnight(d), avgK(d, K10)]) },
        { name: "5-year average", colour: "--s-d1", type: "line", dashed: true, width: 1.4, unit, decimals: dec, avg: false, data: anchors.map(d => [parisMidnight(d), avgK(d, K5)]) },
        { name: "Last year", colour: "--s-ly", type: "line", width: 1.6, unit, decimals: dec, avg: false, data: anchors.map(d => [parisMidnight(d), at(d, 1)]) },
        { name: hyLabel(hy), colour: "--s-actual", type: "line", width: 2.8, unit, decimals: dec, avg: false, data: res.filter(r => r.date >= start).map(r => [parisMidnight(r.date), val(r)]) }
      ],
      notes: ["MITECO's weekly bulletin covers mainland reservoirs over 5 hm³. Hydroelectric energy is MITECO's calculation of the energy the stored water could produce. Earlier years are read at the bulletin nearest the same date."]
    });

    const days = Array.from({ length: 365 }, (x, i) => addDays(start, i));
    this.cumPanel.setTitle(`Hydro output since 1 October, hydro year ${hyLabel(hy)}`, "TWh, cumulative · REE real-time hydro, net of pumping");
    this.cumPanel.render({
      xType: "time", xLabel: fmtDate, yName: "TWh", yMin: 0, source: REE,
      series: [
        { name: "5-year average", colour: "--s-d1", type: "line", dashed: true, width: 1.4, unit: "TWh", decimals: 2, avg: false, data: days.map((d, i) => [parisMidnight(d), cPrev.length ? (meanOf(cPrev.map(c => c.at(i))) ?? NaN) / 1000 : null]).filter(p => Number.isFinite(p.at(1))) },
        { name: "Last year", colour: "--s-ly", type: "line", width: 1.6, unit: "TWh", decimals: 2, avg: false, data: cLy.map((v, i) => [parisMidnight(days.at(i)), v / 1000]) },
        { name: hyLabel(hy), colour: "--s-actual", type: "line", width: 2.6, unit: "TWh", decimals: 2, avg: false, data: cNow.map((v, i) => [parisMidnight(days.at(i)), v / 1000]) }
      ]
    });

    this.inPanel.setTitle(`Estimated weekly inflow, hydro year ${hyLabel(hy)}`, "GWh · hydro output plus the change in hydroelectric energy stored");
    this.inPanel.render({
      xType: "time", xLabel: fmtDate, yName: "GWh", zeroLine: true, source: SOURCE,
      series: [
        { name: hyLabel(hy), colour: "--f-hydro", type: "bar", unit: "GWh", decimals: 0, avg: false, data: res.filter(r => r.date >= start && inflow.has(r.date)).map(r => [parisMidnight(r.date), inflow.get(r.date)]) },
        { name: "5-year average", colour: "--s-d1", type: "line", dashed: true, width: 1.6, unit: "GWh", decimals: 0, avg: false, data: anchors.map(d => [parisMidnight(d), meanOf(K5.map(k => near(inflow, shiftDate(d, -k))))]) }
      ],
      notes: ["The site's own estimate: REE's net hydro output between two bulletins plus the change in MITECO's hydroelectric energy stored. It ignores spills, evaporation and water released without generating, so it understates inflow in very wet weeks."]
    });
  }
}
