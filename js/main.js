// Site shell: home page and market switcher, sidebar, tabs, page bar, data
// status and refresh. The pages are listed in site-pages.js, the bell is in
// site-bell.js, and the Display menu and side panels are in site-panels.js.
// Addresses: #home (or nothing) is the market picker. Every other address
// starts with its market: #fr/prices/explorer, #es/demand/today.
// Code note: no asterisks here (chat formatting strips them when pasted).
import { VERSION } from "./changelog-v5.js";
import { panelsWithin, setExportBrand } from "./chart.js";
import { CONFIG } from "./config.js";
import { dataVersion, getStatus, parseUtc, setDataVersion, setLiveOverride } from "./data.js";
import { flag } from "./flags.js";
import { MARKETS, MARKET_ORDER, SITE_ACCENT, SITE_LONG, SITE_NAME, rememberMarket } from "./markets.js";
import { apply } from "./settings.js";
import { bellLoaded, loadBell, resetBellTopic, setupBell, toggleBell } from "./site-bell.js";
import { HOME_PAGE, SITE, cfgOf, icon } from "./site-pages.js";
import { closeDrawer, setupPanels, toggleMenu } from "./site-panels.js";
import { copyText, dateKey, el, fmtDateTime, fmtLongDate, fmtTime, lastPeriod, parisOffset, setHashMarket, toast, writeHash } from "./util.js";
apply();

const MIN = 60000;

// ---------- Addresses ----------

const LEGACY_TABS = new Set(["today", "explorer", "accuracy", "outlook"]);
const HOME = { market: "home", page: "", tab: "", params: new URLSearchParams() };
function parseHash() {
  const raw = location.hash.replace(/^#/, "");
  const q = raw.indexOf("?");
  const path = q < 0 ? raw : raw.slice(0, q);
  const params = new URLSearchParams(q < 0 ? "" : raw.slice(q + 1));
  const segs = path.split("/").filter(Boolean);
  if (!segs.length || segs.at(0) === "home") return HOME;
  // Addresses without a market (older links) are read as France.
  const market = MARKETS[segs.at(0)] ? segs.shift() : "fr";
  if (!SITE[market]) return HOME;
  let page = segs.at(0) || "overview";
  let tab = segs.at(1) || "";
  if (market === "fr" && LEGACY_TABS.has(page)) { tab = page; page = "demand"; }
  return { market, page, tab, params };
}
const prefixOf = market => (MARKETS[market] ? MARKETS[market].prefix : "");

// ---------- Elements ----------

const root = document.documentElement;
const viewsRoot = document.getElementById("views");
const footer = viewsRoot.querySelector("footer");
const tabsEl = document.getElementById("tabs");
const titleEl = document.getElementById("page-title");
const sideNav = document.querySelector(".side-nav");
const views = {};
const pageBar = el("div", { class: "page-bar", id: "page-bar" });
viewsRoot.insertBefore(pageBar, viewsRoot.firstChild);
let current = null; // { market, page, tab, key }
let status = null;
const marketOnScreen = () => (current && current.market !== "home" ? current.market : "fr");

document.querySelectorAll(".side-brand, #page-brand").forEach(a => a.setAttribute("href", "#home"));
const brandText = document.querySelector(".side-brand-text b");
if (brandText) brandText.innerHTML = `${SITE_NAME} <em>${SITE_ACCENT}</em>`;

// Market switcher, top right.
const headerActions = document.querySelector(".header-actions");
const marketWrap = el("div", { class: "menu market-menu" });
marketWrap.innerHTML = '<button id="market-button" class="btn ghost market-button" type="button" aria-haspopup="true" aria-expanded="false" title="Switch market"></button><div id="market-menu" class="popover market-pop" hidden></div>';
headerActions.insertBefore(marketWrap, headerActions.firstChild);
const marketButton = document.getElementById("market-button");
const marketMenu = document.getElementById("market-menu");

function sectionFor(key) {
  const id = "view-" + key.replaceAll("/", "-");
  let section = document.getElementById(id);
  if (!section) {
    section = el("section", { id, "data-view": key, class: "hidden" });
    viewsRoot.insertBefore(section, document.querySelector(".tab-nav") || footer);
  }
  return section;
}
async function getView(key, loader) {
  if (!views[key]) views[key] = loader(sectionFor(key)).then(view => { view.setStatus?.(status); return view; });
  return views[key];
}

// ---------- Chrome: sidebar, header, tabs, footer ----------

function renderSideNav(market, page) {
  const pages = SITE[market];
  const m = MARKETS[market];
  sideNav.innerHTML = `<a class="side-link side-market-head" href="#home" title="All markets">${flag(m.code, m.name)}<span>${m.name}</span><span class="side-switch">All markets</span></a>`
    + Object.keys(pages).map(p => `<a class="side-link${p === page ? " active" : ""}" data-page="${p}" href="#${m.prefix}${p}" title="${pages[p].label}"${p === page ? ' aria-current="page"' : ""}>${icon(p)}<span>${pages[p].label}</span></a>`).join("");
}
function renderMarketMenu() {
  const here = current && current.market !== "home" ? current : null;
  marketMenu.innerHTML = `<div class="menu-label">Markets</div>` + MARKET_ORDER.map(k => {
    const m = MARKETS[k];
    if (!m.live) return `<span class="market-opt soon" aria-disabled="true">${flag(m.code, m.name)}<span>${m.name}</span><em>Coming soon</em></span>`;
    let target = m.prefix + "overview";
    const cfg = here ? cfgOf(k, here.page) : null;
    if (cfg) target = m.prefix + here.page + (cfg.tabs[here.tab] && Object.keys(cfg.tabs).length > 1 ? "/" + here.tab : "");
    return `<a class="market-opt${here && here.market === k ? " on" : ""}" href="#${target}">${flag(m.code, m.name)}<span>${m.name}</span><em>${m.code}</em></a>`;
  }).join("") + `<a class="market-opt all" href="#home">All markets</a>`;
}
function toggleMarketMenu(open) {
  const show = open ?? marketMenu.hidden;
  marketMenu.hidden = !show;
  marketButton.setAttribute("aria-expanded", show);
  if (show) renderMarketMenu();
}
marketButton.addEventListener("click", event => { event.stopPropagation(); toggleMenu(false); toggleBell(false); toggleMarketMenu(); });
marketMenu.addEventListener("click", event => { if (event.target.closest("a")) toggleMarketMenu(false); });
document.addEventListener("click", event => { if (!marketMenu.hidden && !marketMenu.contains(event.target)) toggleMarketMenu(false); });

function renderFooter(market) {
  footer.innerHTML = `<div><b>${SITE_LONG}</b> <span class="muted">v${VERSION} · by jms-drn</span><br>Data: ${MARKETS[market].sources}</div>
    <div class="footer-links"><button class="link" type="button" data-open="about">About the data</button>
      <button class="link" type="button" data-open="whatsnew">What's new</button>
      <a href="${CONFIG.repoUrl}" target="_blank" rel="noopener">Data files and code</a></div>`;
}

function renderChrome(market, page, tab) {
  if (market === "home") {
    root.dataset.view = "home";
    document.body.dataset.page = "home";
    document.body.dataset.market = "home";
    document.title = SITE_LONG;
    setExportBrand(`${SITE_LONG} by jms-drn`);
    tabsEl.hidden = true;
    tabsEl.innerHTML = "";
    renderTabNav(null);
    return;
  }
  delete root.dataset.view;
  renderSideNav(market, page);
  const m = MARKETS[market];
  marketButton.innerHTML = `${flag(m.code, m.name)}<span>${m.code}</span><span aria-hidden="true">▾</span>`;
  renderFooter(market);
  document.body.dataset.market = market;
  const config = cfgOf(market, page);
  titleEl.innerHTML = `${m.name} Power <em>${config.accent}</em>`;
  document.title = tab && Object.keys(config.tabs).length > 1 ? `${config.tabs[tab].label} · ${config.doc}` : config.doc;
  setExportBrand(`${config.doc} by jms-drn`);
  const names = Object.keys(config.tabs);
  tabsEl.hidden = names.length < 2;
  tabsEl.innerHTML = names.length < 2 ? "" : names.map((name, i) =>
    `<button class="tab" role="tab" data-tab="${name}" aria-selected="${name === tab}">${config.stepper ? `<span class="tab-n">${i + 1}</span>` : ""}${config.tabs[name].label}</button>`).join("");
  tabsEl.classList.toggle("stepper", !!config.stepper);
  document.body.dataset.page = page;
  tabsEl.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  renderTabNav(market, page, tab);
}

// A soft fade when a market is opened from the home page or the switcher.
function enter(section) {
  section.classList.remove("enter");
  void section.offsetWidth;
  section.classList.add("enter");
}

async function navigate(market, page, tab, params) {
  toggleMarketMenu(false);
  if (market === "home") {
    renderChrome("home");
    document.querySelectorAll("[data-view]").forEach(section => section.classList.toggle("hidden", section.dataset.view !== "home"));
    sectionFor("home").classList.remove("hidden");
    current = { market: "home", page: "", tab: "", key: "home" };
    pageBar.hidden = true;
    closeSidebar();
    window.scrollTo({ top: 0 });
    if (location.hash !== "#home") history.replaceState(null, "", "#home");
    await (await getView("home", HOME_PAGE.load)).activate();
    return;
  }
  const pages = SITE[market];
  if (!pages[page]) page = "overview";
  const tabs = Object.keys(pages[page].tabs);
  if (!tabs.includes(tab)) tab = tabs.at(0);
  const prefix = prefixOf(market);
  const key = `${prefix}${page}/${tab}`;
  const marketChanged = !current || current.market !== market;
  const pageChanged = marketChanged || current.page !== page;
  setHashMarket(market);
  renderChrome(market, page, tab);
  document.querySelectorAll("[data-view]").forEach(section => section.classList.toggle("hidden", section.dataset.view !== key));
  const section = sectionFor(key);
  section.classList.remove("hidden");
  if (marketChanged) enter(section);
  current = { market, page, tab, key };
  rememberMarket(market);
  if (marketChanged) resetBellTopic();
  closeSidebar();
  if (pageChanged) window.scrollTo({ top: 0 });
  const view = await getView(key, pages[page].tabs[tab].load);
  if (current.key !== key) return;
  if (params && [...params.keys()].length && view.setParams) view.setParams(params);
  else if (!pageChanged && pages[page].sharePeriod && keepPeriod() && view.applyPeriod) view.applyPeriod(lastPeriod(market + "/" + page));
  if (!view.writesHash) writeHash(prefix + (tabs.length > 1 ? `${page}/${tab}` : page), params ? Object.fromEntries(params) : null);
  await view.activate();
  if (current.key !== key) return;
  decorate(section);
  renderPageBar();
  requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
}

// ---------- Page bar: data freshness, shared period, pin, Excel ----------

function keepPeriod() {
  try { return localStorage.getItem("keepPeriod") !== "0"; } catch (error) { return true; }
}
async function freshness() {
  const { market, page } = current;
  const day = text => (text ? fmtLongDate(dateKey(parseUtc(text))).replace(/ \d{4}$/, "") : "–");
  try {
    if (market === "es") return (await import("./es-data.js")).freshness(page);
    if (page === "demand") return status?.series?.realised?.last_utc ? `Actual demand to ${fmtTime(parseUtc(status.series.realised.last_utc) + 900000)}` : "";
    if (["prices", "generation", "flows"].includes(page)) {
      const { getMarketIndex } = await import("./market-data.js");
      const ix = await getMarketIndex();
      const flows = Object.values(ix.latest_flow_utc || {}).filter(Boolean).sort();
      const mix = ix.latest_mix_utc ? `mix to ${fmtTime(parseUtc(ix.latest_mix_utc) + 900000)}` : "";
      const price = ix.latest_price_utc ? `prices to ${day(ix.latest_price_utc)}` : "";
      const flow = flows.length ? `flows to ${fmtTime(parseUtc(flows.at(0)) + 3600000)}` : "";
      const text = (page === "prices" ? [price, mix] : page === "generation" ? [mix] : [flow, price]).filter(Boolean).join(" · ");
      return text ? text.at(0).toUpperCase() + text.slice(1) : "";
    }
    if (page === "nuclear") {
      const { getLive } = await import("./power-data.js");
      const live = await getLive();
      return `Notices checked ${live.generated_utc ? fmtTime(parseUtc(live.generated_utc)) : "–"}`;
    }
  } catch (error) { console.error(error); }
  return "";
}

function pins() {
  try { return JSON.parse(localStorage.getItem("pins") || "[]"); } catch (error) { return []; }
}
function savePins(list) {
  try { localStorage.setItem("pins", JSON.stringify(list.slice(0, 30))); } catch (error) { void error; }
  renderPins();
}
function renderPins() {
  const box = document.getElementById("side-pins");
  const list = pins();
  box.hidden = !list.length;
  box.innerHTML = list.length ? `<div class="side-label pins-label">Pinned</div>${list.map((p, i) => `<div class="pin-row"><a class="side-link pin" href="${p.hash}" title="${p.title}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9Z"/></svg><span>${p.title}</span></a><button class="pin-x" type="button" data-unpin="${i}" title="Remove this pin" aria-label="Remove pin">×</button></div>`).join("")}` : "";
}
document.getElementById("side-pins").addEventListener("click", e => {
  const x = e.target.closest("[data-unpin]");
  if (!x) return;
  const list = pins();
  list.splice(Number(x.dataset.unpin), 1);
  savePins(list);
});
function viewTitle(section) {
  const panel = panelsWithin(section).at(0);
  const config = cfgOf(current.market, current.page);
  const short = config.accent.replace(" Intelligence", "") || "Overview";
  const lead = MARKETS[current.market].code + " · ";
  const base = Object.keys(config.tabs).length > 1 ? `${lead}${short} · ${config.tabs[current.tab].label}` : `${lead}${short}`;
  return panel?.title ? `${base}: ${panel.title}` : base;
}
async function renderPageBar() {
  if (!current || current.market === "home" || (current.page === "overview" && current.market === "fr")) { pageBar.hidden = true; return; }
  const config = cfgOf(current.market, current.page);
  pageBar.hidden = false;
  const pinned = pins().some(p => p.hash === location.hash);
  const short = config.accent.replace(" Intelligence", "");
  pageBar.innerHTML = `<span class="fresh" data-fresh></span><span class="bar-actions">
      ${config.sharePeriod ? `<label class="check small" title="When on, choosing a period on one ${short} tab applies it to the others"><input type="checkbox" data-keep ${keepPeriod() ? "checked" : ""}> Same period on every tab</label>` : ""}
      <button class="btn ghost small" type="button" data-pin aria-pressed="${pinned}" title="Pin this view to the sidebar (saved in this browser)">${pinned ? "★ Pinned" : "☆ Pin"}</button>
      <button class="btn ghost small" type="button" data-xlsx title="Download the data of every chart on this tab as one Excel file">Excel</button>
    </span>`;
  const text = await freshness();
  const f = pageBar.querySelector("[data-fresh]");
  if (f) f.innerHTML = text;
}
pageBar.addEventListener("change", e => {
  if (!e.target.matches("[data-keep]")) return;
  try { localStorage.setItem("keepPeriod", e.target.checked ? "1" : "0"); } catch (error) { void error; }
  toast(e.target.checked ? "Tabs on this page now share the period you pick" : "Each tab keeps its own period");
});
pageBar.addEventListener("click", async e => {
  const section = [...document.querySelectorAll("[data-view]")].find(x => !x.classList.contains("hidden"));
  if (e.target.closest("[data-pin]")) {
    const list = pins();
    const i = list.findIndex(p => p.hash === location.hash);
    if (i >= 0) list.splice(i, 1); else list.unshift({ hash: location.hash, title: viewTitle(section) });
    savePins(list);
    renderPageBar();
    toast(i >= 0 ? "Pin removed" : "Pinned to the sidebar");
  }
  if (e.target.closest("[data-xlsx]")) {
    const shown = panelsWithin(section);
    if (!shown.length) { toast("There is no chart data on this tab yet.", { error: true }); return; }
    const { workbook } = await import("./xlsx.js");
    const blob = workbook(shown.map(p => ({ name: p.title, ...p.tableData() })).filter(x => x.headers.length));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${document.title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").toLowerCase()}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
});

// Copy-link buttons next to headlines, and a "Settings" fold for toolbars on phones.
function decorate(section) {
  section.querySelectorAll(".headline").forEach(h => {
    if (h.querySelector("[data-link]")) return;
    const b = el("button", { class: "btn ghost small", type: "button", "data-link": "", title: "Copy a link to exactly this view" }, "Link");
    b.addEventListener("click", () => copyText(location.href));
    h.appendChild(b);
  });
  section.querySelectorAll(".toolbar").forEach(t => {
    if (t.previousElementSibling?.classList.contains("toolbar-toggle")) return;
    const b = el("button", { class: "btn ghost toolbar-toggle", type: "button", "aria-expanded": "false" }, "Settings <span aria-hidden=\"true\">▾</span>");
    b.addEventListener("click", () => { const open = t.classList.toggle("open"); b.setAttribute("aria-expanded", open); });
    t.parentNode.insertBefore(b, t);
  });
}

// "Previous / next tab" links at the foot of pages with many tabs.
const tabNav = el("nav", { class: "tab-nav", "aria-label": "More tabs on this page" });
viewsRoot.insertBefore(tabNav, footer);
function renderTabNav(market, page, tab) {
  viewsRoot.insertBefore(tabNav, footer);
  const config = market ? cfgOf(market, page) : null;
  tabNav.hidden = !config || !config.stepper;
  if (tabNav.hidden) return;
  const names = Object.keys(config.tabs);
  const i = names.indexOf(tab);
  const prefix = prefixOf(market);
  const prev = i > 0 ? names.at(i - 1) : null;
  const next = i < names.length - 1 ? names.at(i + 1) : null;
  tabNav.innerHTML = `${prev ? `<a href="#${prefix}${page}/${prev}" class="tab-nav-link prev"><span>← Previous</span><b>${config.tabs[prev].label}</b></a>` : "<span></span>"}
    <span class="tab-nav-pos">Tab ${i + 1} of ${names.length}</span>
    ${next ? `<a href="#${prefix}${page}/${next}" class="tab-nav-link next"><span>Next →</span><b>${config.tabs[next].label}</b></a>` : "<span></span>"}`;
}
tabsEl.addEventListener("click", event => {
  const tab = event.target.closest(".tab");
  if (!tab || !current) return;
  navigate(current.market, current.page, tab.dataset.tab);
  tab.blur();
});
window.addEventListener("hashchange", () => {
  const h = parseHash();
  if (h.market === "home") { if (!current || current.market !== "home") navigate("home"); return; }
  const pages = SITE[h.market];
  const tabs = pages[h.page] ? Object.keys(pages[h.page].tabs) : [];
  const key = `${prefixOf(h.market)}${h.page}/${tabs.includes(h.tab) ? h.tab : tabs.at(0)}`;
  if (!current || key !== current.key || [...h.params.keys()].length) navigate(h.market, h.page, h.tab, h.params);
});

// ---------- Sidebar ----------

const sidebar = document.getElementById("sidebar");
const scrim = document.querySelector(".sidebar-scrim");
function openSidebar() { sidebar.classList.add("open"); scrim.hidden = false; }
function closeSidebar() { sidebar.classList.remove("open"); scrim.hidden = true; }
document.getElementById("menu-button").addEventListener("click", openSidebar);
scrim.addEventListener("click", closeSidebar);
document.getElementById("collapse").addEventListener("click", () => {
  const collapsed = root.dataset.sidebar !== "collapsed";
  if (collapsed) root.dataset.sidebar = "collapsed"; else delete root.dataset.sidebar;
  try { localStorage.setItem("sidebar", collapsed ? "collapsed" : "open"); } catch (error) { void error; }
  setTimeout(() => window.dispatchEvent(new Event("resize")), 220);
});

// ---------- Data status and refresh ----------

const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");
const statusPill = document.getElementById("status-pill");
const refreshButton = document.getElementById("refresh");
function showStatus() {
  if (!status) return;
  const stamp = parseUtc(status.last_live_update_utc || status.generated_utc);
  const ageMinutes = (Date.now() - stamp) / MIN;
  statusDot.className = `status-dot ${ageMinutes < 90 ? "live" : ageMinutes < 360 ? "" : "error"}`;
  statusText.textContent = `Last updated ${fmtTime(stamp)} ${parisOffset(stamp) === 7200000 ? "CEST" : "CET"}`;
  const next = CONFIG.workerUrl ? ` New data is fetched every ${CONFIG.updateEveryMinutes} minutes.` : "";
  const problems = [...(status.last_errors || []), ...(status.power?.errors || []), ...(status.market?.errors || [])];
  statusPill.title = `Latest data update: ${fmtDateTime(stamp)} Central European time.${next}${problems.length ? `\nLast update problems: ${problems.join("; ")}` : ""}`;
}
// Re-read status.json; if there is a newer data update, reload the current view.
async function checkForNewData({ rerender = true } = {}) {
  try {
    status = await getStatus();
  } catch (error) {
    statusDot.className = "status-dot error";
    statusText.textContent = "Status unavailable";
    return false;
  }
  const changed = setDataVersion(status.generated_utc);
  for (const view of Object.values(views)) (await view).setStatus?.(status);
  showStatus();
  if (changed || !bellLoaded()) loadBell();
  if (changed && rerender && current) (await views[current.key])?.activate();
  return changed;
}
let pollTimer = null;
function watchForUpdate() {
  clearInterval(pollTimer);
  const started = Date.now();
  pollTimer = setInterval(async () => {
    const changed = await checkForNewData();
    if (changed) toast("New data loaded");
    if (changed || Date.now() - started > 300000) clearInterval(pollTimer);
  }, 20000);
}
refreshButton.addEventListener("click", async () => {
  refreshButton.disabled = true;
  refreshButton.classList.add("spinning");
  try {
    if (CONFIG.workerUrl) {
      const response = await fetch(`${CONFIG.workerUrl.replace(/\/$/, "")}/refresh`, { method: "POST" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json();
      if (body.live) setLiveOverride(body.live);
      const changed = await checkForNewData({ rerender: false });
      if (current) (await views[current.key])?.activate();
      toast(body.dispatched ? "Latest data loaded. The full archive update is running and will appear in a few minutes." : changed ? "New data loaded" : "Latest data loaded");
      watchForUpdate();
    } else {
      const changed = await checkForNewData();
      toast(changed ? "New data loaded" : `You have the latest published data (${statusText.textContent.toLowerCase()}).`);
    }
  } catch (error) {
    console.error(error);
    await checkForNewData();
    toast("Couldn't reach the refresh service, so the latest published data is shown.", { error: true });
  } finally {
    refreshButton.disabled = false;
    refreshButton.classList.remove("spinning");
  }
});

// ---------- Bell, Display menu and side panels ----------

setupBell(marketOnScreen, () => { toggleMenu(false); toggleMarketMenu(false); });
setupPanels(() => (current ? current.market : "fr"), async () => {
  if (current && views[current.key]) (await views[current.key]).refreshTheme?.();
}, () => { toggleBell(false); toggleMarketMenu(false); });
document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  closeDrawer();
  toggleMenu(false);
  toggleBell(false);
  toggleMarketMenu(false);
  closeSidebar();
});

// ---------- Start ----------

(async () => {
  renderPins();
  const start = parseHash();
  await checkForNewData({ rerender: false });
  if (!dataVersion()) setDataVersion(String(Date.now()));
  await navigate(start.market, start.page, start.tab, start.params);
  setInterval(() => checkForNewData(), 120000);
  setInterval(showStatus, MIN);
})();
