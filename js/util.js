// Shared helpers. Every page imports from this file; the code itself is in
// two shorter files so each can be pasted in one go:
//   util-time.js  Paris time, formatting, French public holidays
//   util-web.js   URL state, downloads, clipboard, small DOM helpers
export {
  DAY, HOUR, QUARTER, addDays, alignDate, csvDate, csvDateTime, dateKey, dateRange, daysBetween, fmtDate, fmtDateShort, fmtDateTime, fmtDayTime, fmtFromTo, fmtGW, fmtLongDate, fmtMonth, fmtNumber, fmtPct, fmtPeriod, fmtShortDate, fmtSignedGW, fmtTick, fmtTime, fromWall, holidayName, holidays, hoursInDay, isLeapDay, mean, monthKey, ordinal, parisMidnight, parisOffset, shiftYears, timeKey, toWall, todayParis, wall, weekStart, weekdayIndex
} from "./util-time.js";
export {
  copyText, cssVar, downloadBlob, el, heroHtml, lastPeriod, readHash, setHashMarket, slug, toCsv, toast, writeHash
} from "./util-web.js";
