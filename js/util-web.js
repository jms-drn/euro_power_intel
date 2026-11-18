// Shared helpers, part 2: URL state, downloads and small DOM helpers.
// Code note: no asterisks here (chat formatting strips them when pasted).

// ---------- URL state ----------
// The address bar holds "#market/page/tab?key=value&…" so any view can be
// shared: #fr/prices/explorer?from=..., #es/demand/today. Pages without tabs
// are just #fr/hydro. Views write their address without the market, as in
// writeHash("prices/explorer", params); the market of the page on screen,
// set by the site with setHashMarket(), is added in front.
const MARKET_KEYS = new Set(["fr", "es", "de"]);
const LEGACY_TABS = new Set(["today", "explorer", "accuracy", "outlook"]);
let hashMarket = "fr";
export function setHashMarket(market) {
  hashMarket = market;
}
export function readHash() {
  const raw = location.hash.replace(/^#/, "");
  const q = raw.indexOf("?");
  const segs = (q < 0 ? raw : raw.slice(0, q)).split("/");
  if (MARKET_KEYS.has(segs.at(0))) segs.shift();
  let page = segs.at(0) || "";
  let tab = segs.at(1) || "";
  if (LEGACY_TABS.has(page)) { tab = page; page = "demand"; }
  return { page: page || "overview", tab, params: new URLSearchParams(q < 0 ? "" : raw.slice(q + 1)) };
}
// The last period chosen on each page of each market (preset/from/to), so
// the tabs of one page can share it. Keys look like "fr/prices"; a key with
// no market ("prices") is read as the market on screen.
const lastPeriods = {};
export function lastPeriod(key) {
  const full = key.includes("/") ? key : hashMarket + "/" + key;
  return lastPeriods[full] || null;
}
export function writeHash(path, params) {
  const full = MARKET_KEYS.has(path.split("/").at(0)) ? path : hashMarket + "/" + path;
  const segs = full.split("/");
  if (params && params.from && params.to) lastPeriods[segs.at(0) + "/" + segs.at(1)] = { preset: params.preset || "custom", from: params.from, to: params.to };
  const query = new URLSearchParams(params || {}).toString();
  const hash = "#" + full + (query ? "?" + query : "");
  if (location.hash !== hash) history.replaceState(null, "", hash);
}

// ---------- Downloads, clipboard, DOM ----------

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function toCsv(headers, rows) {
  const escape = value => {
    const text = value == null ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return [headers, ...rows].map(row => row.map(escape).join(",")).join("\n");
}
export function slug(text) {
  return text.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
export function el(tag, attrs = {}, html = "") {
  const node = document.createElement(tag);
  for (const entry of Object.entries(attrs)) {
    const key = entry.at(0);
    const value = entry.at(1);
    if (key === "class") node.className = value;
    else node.setAttribute(key, value);
  }
  if (html) node.innerHTML = html;
  return node;
}
export function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
let toastTimer = null;
// Small notification at the bottom of the screen.
export function toast(message, { error = false } = {}) {
  let node = document.getElementById("toast");
  if (!node) {
    node = el("div", { id: "toast", role: "status", "aria-live": "polite" });
    document.body.appendChild(node);
  }
  node.textContent = message;
  node.className = `toast show${error ? " error" : ""}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { node.className = "toast"; }, 3200);
}
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied to clipboard");
  } catch (error) {
    toast("Your browser blocked copying. Select the text and copy it instead.", { error: true });
  }
}
// A tab's title and one-line description.
export function heroHtml(title, accent, description) {
  return `<div class="hero"><div><h1>${title} <span>${accent}</span></h1><p>${description}</p></div></div>`;
}
