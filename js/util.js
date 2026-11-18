// Shared helpers: Paris time, formatting, French public holidays, URL state,
// downloads and small DOM helpers.
// Code note: no asterisks here (chat formatting strips them when pasted), so
// multiplication is written with mul() and comments use // only.

export const HOUR = 3600000;
export const DAY = 86400000;
export const QUARTER = 900000;
const mul = (a, b) => a / (1 / b);
const TWO_HOURS = 7200000;
const HALF_DAY = 43200000;

// ---------- Paris time ----------
// France switches to summer time at 01:00 UTC on the last Sunday of March
// and back at 01:00 UTC on the last Sunday of October. Computing the offset
// directly is much faster than Intl for hundreds of thousands of points.
const dstCache = new Map();
function lastSunday(year, monthIndex) {
  const last = new Date(Date.UTC(year, monthIndex + 1, 0));
  return last.getUTCDate() - last.getUTCDay();
}
function dstBounds(year) {
  if (!dstCache.has(year)) {
    dstCache.set(year, [
      Date.UTC(year, 2, lastSunday(year, 2), 1),
      Date.UTC(year, 9, lastSunday(year, 9), 1)
    ]);
  }
  return dstCache.get(year);
}
export function parisOffset(ms) {
  const bounds = dstBounds(new Date(ms).getUTCFullYear());
  return ms >= bounds.at(0) && ms < bounds.at(1) ? TWO_HOURS : HOUR;
}
// Paris wall-clock time expressed as if it were UTC (used for chart axes).
export function toWall(ms) {
  return ms + parisOffset(ms);
}
// Inverse of toWall (the repeated October hour maps to its first occurrence).
export function fromWall(wallMs) {
  const candidate = wallMs - HOUR;
  return parisOffset(candidate) === HOUR ? candidate : wallMs - TWO_HOURS;
}
// A Date whose getUTC fields read as Paris wall-clock time.
export function wall(ms) {
  return new Date(toWall(ms));
}
const pad = n => String(n).padStart(2, "0");
export function dateKey(ms) {
  const d = wall(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
export function timeKey(ms) {
  const d = wall(ms);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
export function monthKey(ms) {
  const d = wall(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}
// Epoch ms of 00:00 Paris time on a YYYY-MM-DD date.
export function parisMidnight(date) {
  const p = date.split("-").map(Number);
  const utcMidnight = Date.UTC(p.at(0), p.at(1) - 1, p.at(2));
  return utcMidnight - parisOffset(utcMidnight - HOUR);
}
export function addDays(date, days) {
  const p = date.split("-").map(Number);
  const t = new Date(Date.UTC(p.at(0), p.at(1) - 1, p.at(2) + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
export function daysBetween(from, to) {
  const utc = s => { const p = s.split("-").map(Number); return Date.UTC(p.at(0), p.at(1) - 1, p.at(2)); };
  return Math.round((utc(to) - utc(from)) / DAY);
}
export function dateRange(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}
export function todayParis() {
  return dateKey(Date.now());
}
export function weekdayIndex(date) {
  const p = date.split("-").map(Number);
  return (new Date(Date.UTC(p.at(0), p.at(1) - 1, p.at(2))).getUTCDay() + 6) % 7; // Monday = 0
}
export function weekStart(date) {
  return addDays(date, -weekdayIndex(date));
}
export function hoursInDay(date) {
  return (parisMidnight(addDays(date, 1)) - parisMidnight(date)) / HOUR;
}
export function isLeapDay(date) {
  return date.slice(5) === "02-29";
}
// Same calendar date k years earlier, or null for 29 Feb in a non-leap year.
export function shiftYears(date, years) {
  const y = Number(date.slice(0, 4)) - years;
  const shifted = `${y}${date.slice(4)}`;
  if (isLeapDay(date)) {
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    return leap ? shifted : null;
  }
  return shifted;
}
// The comparison date for alignment "cal" (same date) or "wd" (364 days per year, same weekday).
export function alignDate(date, years, align) {
  return align === "wd" ? addDays(date, -mul(364, years)) : shiftYears(date, years);
}

// ---------- Formatting ----------

const fmtCache = {};
function fmt(options) {
  const key = JSON.stringify(options);
  if (!fmtCache[key]) fmtCache[key] = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", ...options });
  return fmtCache[key];
}
export const fmtDate = ms => fmt({ weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(ms);
export const fmtDateShort = ms => fmt({ day: "numeric", month: "short" }).format(ms);
export const fmtMonth = ms => fmt({ month: "short", year: "numeric" }).format(ms);
export const fmtDateTime = ms => fmt({ weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(ms);
export const fmtTime = ms => fmt({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(ms);
export const fmtDayTime = ms => fmt({ day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(ms);
// Axis tick label for a time axis: date at midnight, time otherwise.
export function fmtTick(ms) {
  if (timeKey(ms) !== "00:00") return fmtTime(ms);
  const date = dateKey(ms);
  if (date.endsWith("-01-01")) return date.slice(0, 4);
  if (date.endsWith("-01")) return fmtMonth(ms + HALF_DAY);
  return fmtDateShort(ms);
}
export function fmtLongDate(date) {
  return fmt({ day: "numeric", month: "short", year: "numeric" }).format(parisMidnight(date) + HALF_DAY);
}
export function fmtShortDate(date) {
  return fmt({ day: "numeric", month: "short" }).format(parisMidnight(date) + HALF_DAY);
}
export function fmtPeriod(from, to) {
  if (from === to) return fmtLongDate(from);
  if (from.slice(0, 4) === to.slice(0, 4)) return `${fmtShortDate(from)} – ${fmtLongDate(to)}`;
  return `${fmtLongDate(from)} – ${fmtLongDate(to)}`;
}
// "1 Oct to 29 Oct 2026" for use in sentences.
export function fmtFromTo(from, to) {
  if (from === to) return `on ${fmtLongDate(from)}`;
  const first = from.slice(0, 4) === to.slice(0, 4) ? fmtShortDate(from) : fmtLongDate(from);
  return `from ${first} to ${fmtLongDate(to)}`;
}
export function fmtNumber(value, decimals = 1) {
  if (value == null || !Number.isFinite(value)) return "–";
  return value.toLocaleString("en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
export function fmtGW(mw, decimals = 1) {
  return mw == null || !Number.isFinite(mw) ? "–" : `${fmtNumber(mw / 1000, decimals)} GW`;
}
export function fmtPct(value, decimals = 1, signed = true) {
  if (value == null || !Number.isFinite(value)) return "–";
  const sign = signed && value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${fmtNumber(Math.abs(value), decimals)}%`;
}
export function fmtSignedGW(mw, decimals = 2) {
  if (mw == null || !Number.isFinite(mw)) return "–";
  const sign = mw > 0 ? "+" : mw < 0 ? "−" : "";
  return `${sign}${fmtNumber(Math.abs(mw) /
