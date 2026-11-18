// Site shell: home page and market switcher, sidebar pages, per-page tabs and
// titles, Display menu, What's new and About panels, data status, automatic
// refresh, the Refresh button and the notification bell.
// Addresses: #home (or nothing) is the market picker. Every other address
// starts with its market: #fr/prices/explorer, #es/demand/today.
// Code note: no asterisks here (chat formatting strips them when pasted).
import { CHANGELOG, VERSION } from "./changelog.js";
import { panelsWithin, refreshAllCharts, setExportBrand } from "./chart.js";
import { CONFIG } from "./config.js";
import { dataVersion, getStatus, parseUtc, setDataVersion, setLiveOverride } from "./data.js";
import { flag } from "./flags.js";
import { MARKETS, MARKET_ORDER, SITE_ACCENT, SITE_LONG, SITE_NAME, rememberMarket } from "./markets.js";
import { PALETTES, apply, settings, updateSettings } from "./settings.js";
import { copyText, dateKey, el, fmtDateTime, fmtLongDate, fmtTime, lastPeriod, parisOffset, setHashMarket, toast, writeHash } from "./util.js";
apply();

const MIN = 60000;

// ---------- Pages of each market ----------
// Each page: sidebar label, header accent (after "France Power"), document
// title, tabs and loaders.

const FR_PAGES = {
  overview: {
    label: "Overview", accent: "Intelligence", doc: "France Power Intelligence",
    tabs: { main: { label: "Overview", load: async root => new (await import("./overview.js")).Overview(root) } }
  },
  demand: {
    label: "Demand", accent: "Demand Intelligence", doc: "France Power Demand Intelligence",
    tabs: {
      today: { label: "Today", load: async root => new (await import("./today.js")).Today(root) },
      explorer: { label: "Explorer", load: async root => new (await import("./explorer.js")).Explorer(root) },
      accuracy: { label: "Forecast accuracy", load: async root => new (await import("./accuracy.js")).Accuracy(root) },
      outlook: { label: "Outlook", load: async root => new (await import("./outlook.js")).Outlook(root) }
    }
  },
  nuclear: {
    label: "Nuclear availability", accent: "Nuclear Availability Intelligence", doc: "France Power Nuclear Availability Intelligence",
    tabs: {
      today: { label: "Today", load: async root => new (await import("./nuclear-today.js")).NuclearToday(root) },
      explorer: { label: "Explorer", load: async root => new (await import("./nuclear-explorer.js")).NuclearExplorer(root) },
      outages: { label: "Outages", load: async root => new (await import("./nuclear-outages.js")).NuclearOutages(root) },
      outlook: { label: "Outlook", load: async root => new (await import("./nuclear-outlook.js")).NuclearOutlook(root) }
    }
  },
  hydro: {
    label: "Hydro reserves", accent: "Hydro Intelligence", doc: "France Power Hydro Intelligence",
    tabs: { main: { label: "Reservoirs", load: async root => new (await import("./hydro.js")).Hydro(root) } }
  },
  prices: {
    label: "Prices", accent: "Price Intelligence", doc: "France Power Price Intelligence", stepper: true, sharePeriod: true,
    tabs: {
      short: { label: "Short term", load: async root => new (await import("./prices-short.js")).PriceShort(root) },
      explorer: { label: "Explorer", load: async root => (await import("./prices-explorer.js")).priceExplorer(root) },
      spreads: { label: "Spreads", load: async root => new (await import("./prices-analysis.js")).PriceSpreads(root) },
      mix: { label: "Mix & Price", load: async root => new (await import("./prices-analysis.js")).MixPrice(root) },
      negative: { label: "Negative Prices", load: async root => new (await import("./prices-analysis.js")).NegativePrices(root) },
      capture: { label: "Capture Prices", load: async root => new (await import("./prices-explorer.js")).CapturePrices(root) },
      residual: { label: "Residual Demand", load: async root => new (await import("./prices-explorer.js")).ResidualDemand(root) },
      modulation: { label: "Nuclear Modulation", load: async root => new (await import("./prices-analysis.js")).NuclearModulation(root) }
    }
  },
  generation: {
    label: "Generation", accent: "Generation Intelligence", doc: "France Power Generation Intelligence",
    tabs: {
      today: { label: "Today", load: async root => new (await import("./generation.js")).GenToday(root) },
      explorer: { label: "Explorer", load: async root => (await import("./generation.js")).genExplorer(root) },
      records: { label: "Records", load: async root => new (await import("./generation.js")).GenRecords(root) }
    }
  },
  flows: {
    label: "Flows", accent: "Flows Intelligence", doc: "France Power Flows Intelligence",
    tabs: {
      today: { label: "Live map", load: async root => new (await import("./flows.js")).FlowsMap(root) },
      explorer: { label: "Explorer", load: async root => (await import("./flows.js")).flowsExplorer(root) },
      prices: { label: "Flows and prices", load: async root => new (await import("./flows.js")).FlowsPrices(root) }
    }
  }
};

const es = async () => import("./es-pages.js");
const ES_PAGES = {
  overview: {
    label: "Overview", accent: "Intelligence", doc: "Spain Power Intelligence",
    tabs: { main: { label: "Overview", load: async root => new (await es()).EsOverview(root) } }
  },
  demand: {
    label: "Demand", accent: "Demand Intelligence", doc: "Spain Power Demand Intelligence",
    tabs: {
      today: { label: "Today", load: async root => new (await es()).EsDemandToday(root) },
      explorer: { label: "Explorer", load: async root => (await es()).esDemandExplorer(root) },
      accuracy: { label: "Forecast accuracy", load: async root => new (await es()).EsDemandAccuracy(root) }
    }
  },
  prices: {
    label: "Prices", accent: "Price Intelligence", doc: "Spain Power Price Intelligence", stepper: true, sharePeriod: true,
    tabs: {
      short: { label: "Short term", load: async root => new (await es()).EsPricesShort(root) },
      explorer: { label: "Explorer", load: async root => (await es()).esPriceExplorer(root) },
      spreads: { label: "Spreads", load: async root => (await es()).esSpreadExplorer(root) }
    }
  },
  generation: {
    label: "Generation", accent: "Generation Intelligence", doc: "Spain Power Generation Intelligence",
    tabs: {
      today: { label: "Today", load: async root => new (await es()).EsGenToday(root) },
      explorer: { label: "Explorer", load: async root => (await es()).esGenExplorer(root) }
    }
  },
  flows: {
    label: "Flows", accent: "Flows Intelligence", doc: "Spain Power Flows Intelligence",
    tabs: {
      today: { label: "Today", load: async root => new (await es()).EsFlowsToday(root) },
      explorer: { label: "Explorer", load: async root => (await es()).esFlowsExplorer(root) }
    }
  }
};

const SITE = { fr: FR_PAGES, es: ES_PAGES };
// The settings of one page of one market (or null).
function cfgOf(market, page) {
  const pages = SITE[market];
  return pages ? pages[page] || null : null;
}
const HOME_PAGE = { load: async root => new (await import("./home.js")).Home(root) };

const ICONS = {
  overview: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/>',
  demand: '<path d="M3 13h3.5l2.5-6 4 11 2.8-7H21"/>',
  nuclear: '<circle cx="12" cy="12" r="1.7"/><ellipse cx="12" cy="12" rx="9" ry="3.6"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)"/>',
  hydro: '<path d="M12 3.2c3.3 4.2 6 7.6 6 10.8a6 6 0 0 1-12 0c0-3.2 2.7-6.6 6-10.8Z"/><path d="M9 15a3 3 0 0 0 3 3"/>',
  prices: '<path d="M17.5 6.5A6.5 6.5 0 1 0 17.5 17.5"/><path d="M4.5 10.5h9M4.5 13.5h9"/>',
  generation: '<path d="M13 2.5 5 13.5h6l-1 8 8-11h-6l1-8Z"/>',
  flows: '<path d="M4 8.5h14M14.5 5l3.5 3.5-3.5 3.5M20 15.5H6M9.5 12 6 15.5 9.5 19"/>'
};
const icon = key => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[key] || ICONS.overview}</svg>`;

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

// The site name in the sidebar and header leads home.
document.querySelectorAll(".side-brand, #page-brand").forEach(a => a.setAttribute("href", "#home"));
const brandText = document.querySelector(".side-brand-text b");
if (brandText) brandText.innerHTML = `${SITE_NAME} <em>${SITE_ACCENT}</em>`;
document.querySelector(".side-brand")?.setAttribute("title", `${SITE_LONG}: all markets`);

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
  if (!views[key]) {
    views[key] = loader(sectionFor(key)).then(view => {
      view.setStatus?.(status);
      return view;
    });
  }
  return views[key];
}

// ---------- Chrome: sidebar, header, tabs, footer ----------

function renderSideNav(market, page) {
  const pages = SITE[market];
  const m = MARKETS[market];
  sideNav.innerHTML = `<a class="side-link side-market-head" href="#home" title="All markets">${flag(m.code, m.name)}<span>${m.name}</span><span class="side-switch">All markets</span></a>`
    + Object.keys(pages).map(p => `<a class="side-link${p === page ? " active" : ""}" data-page="${p}" href="#${m.prefix}${p}" title="${pages[p].label}"${p === page ? ' aria-current="page"' : ""}>${icon(p)}<span>${pages[p].label}</span></a>`).join("");
}

function renderMarketButton(market) {
  const m = MARKETS[market];
  marketButton.innerHTML = m ? `${flag(m.code, m.name)}<span>${m.code}</span><span aria-hidden="true">▾</span>` : `<span>Markets</span><span aria-hidden="true">▾</span>`;
}

function renderMarketMenu() {
  const here = current && current.market !== "home" ? current : null;
  marketMenu.innerHTML = `<div class="menu-label">Markets</div>` + MARKET_ORDER.map(k => {
    const m = MARKETS[k];
    if (!m.live) return `<span class="market-opt soon" aria-disabled="true">${flag(m.code, m.name)}<span>${m.name}</span><em>Coming soon</em></span>`;
    let target = m.prefix + "overview";
    if (here && cfgOf(k, here.page)) {
      const tabs = cfgOf(k, here.page).tabs;
      target = m.prefix + here.page + (tabs[here.tab] && Object.keys(tabs).length > 1 ? "/" + here.tab : "");
    }
    const on = here && here.market === k;
    return `<a class="market-opt${on ? " on" : ""}" href="#${target}">${flag(m.code, m.name)}<span>${m.name}</span><em>${m.code}</em></a>`;
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
  const m = MARKETS[market];
  footer.innerHTML = `<div>
      <b>${SITE_LONG}</b> <span class="muted">v${VERSION} · by jms-drn</span><br>
      Data: ${m.sources}
    </div>
    <div class="footer-links">
      <button class="link" type="button" data-open="about">About the data</button>
      <button class="link" type="button" data-open="whatsnew">What's new</button>
      <a href="${CONFIG.repoUrl}" target="_blank" rel="noopener">Data files and code</a>
    </div>`;
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
  renderMarketButton(market);
  renderFooter(market);
  document.body.dataset.market = market;
  const config = cfgOf(market, page);
  const m = MARKETS[market];
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
    const key = "home";
    document.querySelectorAll("[data-view]").forEach(section => section.classList.toggle("hidden", section.dataset.view !== key));
    sectionFor(key).classList.remove("hidden");
    current = { market: "home", page: "", tab: "", key };
    pageBar.hidden = true;
    closeSidebar();
    window.scrollTo({ top: 0 });
    if (location.hash !== "#home") history.replaceState(null, "", "#home");
    const view = await getView(key, HOME_PAGE.load);
    await view.activate();
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
  if (marketChanged) { bellTopic = "all"; renderBell(); }
  closeSidebar();
  if (pageChanged) window.scrollTo({ top: 0 });
  const view = await getView(key, pages[page].tabs[tab].load);
  if (current.key !== key) return;
  const hasParams = params && [...params.keys()].length;
  if (hasParams && view.setParams) view.setParams(params);
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
    if (market === "es") {
      const d = await import("./es-data.js");
      const text = await d.freshness(page);
      return d.usingMock() ? `<span class="mock-tag" title="Spain's history is still being downloaded. Real figures replace these automatically when it is in.">Sample data</span> ${text}` : text;
    }
    if (page === "demand") return status?.series?.realised?.last_utc ? `Actual demand to ${fmtTime(parseUtc(status.series.realised.last_utc) + 900000)}` : "";
    if (["prices", "generation", "flows"].includes(page)) {
      const { getMarketIndex } = await import("./market-data.js");
      const ix = await getMarketIndex();
      const flows = Object.values(ix.latest_flow_utc || {}).filter(Boolean).sort();
      const mix = ix.latest_mix_utc ? `mix to ${fmtTime(parseUtc(ix.latest_mix_utc) + 900000)}` : "";
      const price = ix.latest_price_utc ? `prices to ${day(ix.latest_price_utc)}` : "";
      const flow = flows.length ? `flows to ${fmtTime(parseUtc(flows.at(0)) + 3600000)}` : "";
      const parts = page === "prices" ? [price, mix] : page === "generation" ? [mix] : [flow, price];
      const text = parts.filter(Boolean).join(" · ");
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
  const tab = config.tabs[current.tab].label;
  const short = config.accent.replace(" Intelligence", "") || "Overview";
  const lead = MARKETS[current.market].code + " · ";
  const base = Object.keys(config.tabs).length > 1 ? `${lead}${short} · ${tab}` : `${lead}${short}`;
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
    const sheets = shown.map(p => ({ name: p.title, ...p.tableData() })).filter(x => x.headers.length);
    const blob = workbook(sheets);
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
  const { market, page, tab, params } = parseHash();
  if (market === "home") { if (!current || current.market !== "home") navigate("home"); return; }
  const pages = SITE[market];
  const tabs = pages[page] ? Object.keys(pages[page].tabs) : [];
  const key = `${prefixOf(market)}${page}/${tabs.includes(tab) ? tab : tabs.at(0)}`;
  if (!current || key !== current.key || [...params.keys()].length) navigate(market, page, tab, params);
});

// ---------- Sidebar ----------

const sidebar = document.getElementById("sidebar");
const scrim = document.querySelector(".sidebar-scrim");
function openSidebar() {
  sidebar.classList.add("open");
  scrim.hidden = false;
}
function closeSidebar() {
  sidebar.classList.remove("open");
  scrim.hidden = true;
}
document.getElementById("menu-button").addEventListener("click", openSidebar);
scrim.addEventListener("click", closeSidebar);
document.getElementById("collapse").addEventListener("click", () => {
  const collapsed = root.dataset.sidebar !== "collapsed";
  if (collapsed) root.dataset.sidebar = "collapsed";
  else delete root.dataset.sidebar;
  try { localStorage.setItem("sidebar", collapsed ? "collapsed" : "open"); } catch (error) { void error; }
  setTimeout(() => window.dispatchEvent(new Event("resize")), 220);
});

// ---------- Data status and refresh ----------

const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");
const statusPill = document.getElementById("status-pill");
const refreshButton = document.getElementById("refresh");
refreshButton.title = "Get the latest data";

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
  if (changed || !bellLoaded) loadBell();
  if (changed && rerender && current) (await views[current.key])?.activate();
  return changed;
}

let pollTimer = null;
// After triggering an update, look for it every 20 seconds for up to 5 minutes.
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
      toast(body.dispatched
        ? "Latest data loaded. The full archive update is running and will appear in a few minutes."
        : changed ? "New data loaded" : "Latest data loaded");
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

// ---------- Notification bell ----------
// Notable events from data/alerts.json, for the market on screen only. An
// alert belongs to a market by the start of its link ("es/..."; links with
// no market are France's). All of the market's events show by default; the
// topic buttons narrow them, and a topic can be muted. A count and a glow
// show unseen ones; there is no sound and no pop-up. Seen alerts and muted
// topics are remembered in this browser.

const bellButton = document.getElementById("bell");
const bellPanel = document.getElementById("bell-panel");
const bellCount = bellButton.querySelector(".bell-count");
let bellLoaded = false;
let alerts = [];
function seenAlerts() {
  try { return new Set(JSON.parse(localStorage.getItem("seenAlerts") || "[]")); } catch (error) { return new Set(); }
}
const TOPICS = { prices: "Prices", generation: "Generation", nuclear: "Nuclear", flows: "Flows", demand: "Demand" };
let bellTopic = "all";
const marketOf = a => { const s = a.link.split("/").at(0); return MARKETS[s] ? s : "fr"; };
const pathOf = a => (MARKETS[a.link.split("/").at(0)] ? a.link.slice(a.link.indexOf("/") + 1) : a.link);
const topicOf = a => pathOf(a).split(/[/?]/).at(0);
const hrefOf = a => "#" + marketOf(a) + "/" + pathOf(a);
const bellMarket = () => (current && current.market !== "home" ? current.market : "fr");
function muted() {
  try { return new Set(JSON.parse(localStorage.getItem("mutedTopics") || "[]")); } catch (error) { return new Set(); }
}
function recentAlerts({ includeMuted = false } = {}) {
  const cutoff = new Date(Date.now() - 345600000).toISOString().slice(0, 10);
  const off = muted();
  const m = bellMarket();
  return alerts.filter(a => a.date >= cutoff && marketOf(a) === m && (includeMuted || !off.has(topicOf(a))));
}
function renderBell() {
  const seen = seenAlerts();
  const unseen = recentAlerts().filter(a => !seen.has(a.id)).length;
  bellCount.textContent = unseen > 9 ? "9+" : String(unseen);
  bellCount.hidden = !unseen;
  bellButton.classList.toggle("glow", unseen > 0);
  const name = MARKETS[bellMarket()].name;
  bellButton.title = unseen ? `${unseen} new notable ${unseen === 1 ? "event" : "events"} in ${name}` : `Notable events in ${name}`;
}
async function loadBell() {
  try {
    const { getAlerts } = await import("./market-data.js");
    alerts = (await getAlerts()).alerts || [];
    bellLoaded = true;
    renderBell();
    if (!bellPanel.hidden) renderBellPanel();
  } catch (error) { console.error(error); }
}
const LEVEL = { record: "Record", month: "Month record", since: "Highest/lowest since", event: "Event" };
function renderBellPanel() {
  const seen = seenAlerts();
  const off = muted();
  const m = MARKETS[bellMarket()];
  const all = recentAlerts({ includeMuted: true });
  const topics = [...new Set(all.map(topicOf))].filter(t => TOPICS[t]);
  const list = all.filter(a => (bellTopic === "all" ? !off.has(topicOf(a)) : topicOf(a) === bellTopic));
  const isMuted = bellTopic !== "all" && off.has(bellTopic);
  const empty = m.code === "FR" ? "Nothing notable in the past four days." : `Nothing notable for ${m.name} in the past four days.`;
  bellPanel.innerHTML = `<div class="bell-head"><b>Notable events · ${m.name}</b><span class="muted">Past 4 days</span></div>
    ${topics.length > 1 || off.size ? `<div class="bell-filters">${["all", ...topics].map(t => `<button type="button" data-topic="${t}" aria-pressed="${bellTopic === t}">${t === "all" ? "All" : TOPICS[t]}${off.has(t) ? " (muted)" : ""}</button>`).join("")}
      ${bellTopic !== "all" ? `<button type="button" class="bell-mute" data-mute="${bellTopic}">${isMuted ? "Unmute" : "Mute"} ${TOPICS[bellTopic]}</button>` : ""}</div>` : ""}
    ${list.length ? `<ul class="bell-list">${list.map(a => `<li><a href="${hrefOf(a)}" class="${seen.has(a.id) ? "" : "unseen"}"><span class="bell-level ${a.level}">${LEVEL[a.level] || ""}</span><b>${a.title}</b><span>${a.detail}</span><span class="muted">${fmtDateShortIso(a.date)} · open the data →</span></a></li>`).join("")}</ul>`
      : `<p class="muted bell-empty">${empty}</p>`}
    <p class="bell-foot muted">Records, the highest or lowest values for a while (at least a week for prices, a month for generation), negative prices${m.code === "FR" ? " and new unplanned nuclear outages" : ""}.</p>`;
}
function fmtDateShortIso(d) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(Date.parse(`${d}T12:00:00Z`));
}
function toggleBell(open) {
  const show = open ?? bellPanel.hidden;
  bellPanel.hidden = !show;
  bellButton.setAttribute("aria-expanded", show);
  if (show) {
    renderBellPanel();
    try { localStorage.setItem("seenAlerts", JSON.stringify([...new Set([...seenAlerts(), ...recentAlerts().map(a => a.id)])].slice(-300))); } catch (error) { void error; }
    renderBell();
  }
}
bellButton.addEventListener("click", event => { event.stopPropagation(); toggleMenu(false); toggleMarketMenu(false); toggleBell(); });
bellPanel.addEventListener("click", event => {
  event.stopPropagation();
  const topic = event.target.closest("[data-topic]");
  if (topic) { bellTopic = topic.dataset.topic; renderBellPanel(); return; }
  const mute = event.target.closest("[data-mute]");
  if (mute) {
    const off = muted();
    if (off.has(mute.dataset.mute)) off.delete(mute.dataset.mute); else off.add(mute.dataset.mute);
    try { localStorage.setItem("mutedTopics", JSON.stringify([...off])); } catch (error) { void error; }
    renderBellPanel();
    renderBell();
    return;
  }
  if (event.target.closest("a")) toggleBell(false);
});
document.addEventListener("click", () => { if (!bellPanel.hidden) toggleBell(false); });

// ---------- Display menu ----------

const displayButton = document.getElementById("display-button");
const displayMenu = document.getElementById("display-menu");
function swatches(palette, theme) {
  const c = palette[theme];
  return ["actual", "d1", "id", "d2", "ly"].map(r => `<i style="background:${c[r]}"></i>`).join("");
}
function renderDisplayMenu() {
  const s = settings();
  const theme = root.dataset.theme;
  const seg = (key, options) => `<div class="segmented" role="group">${options.map(o =>
    `<button type="button" data-set="${key}" data-value="${o.at(0)}" aria-pressed="${String(s[key]) === o.at(0)}">${o.at(1)}</button>`).join("")}</div>`;
  displayMenu.innerHTML = `
    <div class="menu-section"><div class="menu-label">Theme</div>${seg("theme", [["dark", "Dark"], ["light", "Light"]])}</div>
    <div class="menu-section"><div class="menu-label">Line colours</div>
      <div class="palette-list">${Object.entries(PALETTES).map(e => { const key = e.at(0); const p = e.at(1); return `
        <button type="button" class="palette${s.palette === key ? " selected" : ""}" data-set="palette" data-value="${key}" aria-pressed="${s.palette === key}">
          <span class="swatches">${swatches(p, theme)}</span><span>${p.name}</span>
        </button>`; }).join("")}
      </div>
    </div>
    <div class="menu-section"><div class="menu-label">Line thickness</div>${seg("thickness", [["thin", "Thin"], ["normal", "Normal"], ["thick", "Thick"]])}</div>
    <div class="menu-section"><label class="check"><input type="checkbox" data-set="markers" ${s.markers ? "checked" : ""}> Show a marker on each data point</label></div>`;
}
async function setDisplay(patch) {
  updateSettings(patch);
  renderDisplayMenu();
  refreshAllCharts();
  if (current && current.page !== "demand" && views[current.key]) (await views[current.key]).refreshTheme?.();
}
displayMenu.addEventListener("click", event => {
  event.stopPropagation(); // the menu redraws itself; don't treat this as an outside click
  const button = event.target.closest("button[data-set]");
  if (!button) return;
  const patch = {};
  patch[button.dataset.set] = button.dataset.value;
  setDisplay(patch);
});
displayMenu.addEventListener("change", event => {
  if (event.target.matches('input[data-set="markers"]')) setDisplay({ markers: event.target.checked });
});
function toggleMenu(open) {
  const show = open ?? displayMenu.hidden;
  displayMenu.hidden = !show;
  displayButton.setAttribute("aria-expanded", show);
  if (show) renderDisplayMenu();
}
displayButton.addEventListener("click", event => { event.stopPropagation(); if (!bellPanel.hidden) toggleBell(false); toggleMarketMenu(false); toggleMenu(); });
document.addEventListener("click", event => {
  if (!displayMenu.hidden && !displayMenu.contains(event.target)) toggleMenu(false);
});

// ---------- Drawers: What's new, About ----------

const drawer = document.getElementById("drawer");
const backdrop = document.querySelector(".drawer-backdrop");
const whatsNewButton = document.getElementById("whats-new");
const newDot = whatsNewButton.querySelector(".new-dot");
function seenVersion() {
  try { return localStorage.getItem("seenVersion"); } catch (error) { return VERSION; }
}
newDot.hidden = seenVersion() === VERSION;

function whatsNewHtml() {
  return CHANGELOG.map(v => `
    <section class="release">
      <div class="release-head"><span class="release-tag">v${v.version}</span><span class="muted">${v.date}</span></div>
      <h3>${v.title}</h3>
      ${v.sections.map(sec => `<h4>${sec.heading}</h4><ul>${sec.items.map(i => `<li>${i}</li>`).join("")}</ul>`).join("")}
    </section>`).join("");
}

const term = (t, d) => `<dt>${t}</dt><dd>${d}</dd>`;
function aboutSpainHtml() {
  return `
    <h3>Spain</h3>
    <p>Spanish figures cover mainland Spain (the Peninsula); the Balearic and Canary Islands, Ceuta and Melilla are left out. Demand, its forecast and the generation mix come from REE, the Spanish transmission system operator, through its ESIOS platform: REE publishes them every 5 minutes and the site averages them to quarter-hours. Day-ahead prices for Spain, France and Portugal and physical flows on the French and Portuguese borders come from the ENTSO-E Transparency Platform. Mainland Spain and France share the same clock, so times are Central European time.</p>
    <dl class="glossary">
      ${term("Demand", "REE's real-time mainland demand (Demanda real).")}
      ${term("REE forecast", "REE's demand forecast (Demanda prevista), revised through the day; the latest value for each quarter-hour is kept.")}
      ${term("Generation", "REE's real-time generation by technology. Hydro is REE's real-time hydro figure. The split of solar into PV and solar thermal, and of other generation into cogeneration and renewable thermal, starts later than 2015; before it, totals are shown.")}
      ${term("Renewable share", "Wind, solar, hydro and renewable thermal as a share of total generation.")}
      ${term("Flows", "Physical (measured) flows, from Spain's side: positive means power leaving Spain. Morocco and Andorra are not included.")}
      ${term("Sample data", "While Spain's history is being downloaded the Spain pages show generated sample data, labelled under the tabs. Real data replaces it automatically.")}
    </dl>`;
}

function aboutHtml() {
  const fr = `
    <h3>France</h3>
    <p>Figures come from RTE, the French transmission system operator, through its public APIs (consumption, actual generation and unavailability notices), and from the ENTSO-E Transparency Platform (day-ahead prices and cross-border flows). They cover mainland France. Times are Paris time.</p>
    <h3>Demand</h3>
    <p>Demand includes grid losses and excludes pumping at hydropower plants. It is average power over each interval, in MW or GW.</p>
    <h4>Forecasts</h4>
    <dl class="glossary">
      ${term("Actual", "Measured demand (RTE calls it \"realised\"), every 15 minutes.")}
      ${term("Intraday", "RTE's forecast for today, revised through the day.")}
      ${term("D-1", "Day-ahead forecast, made the day before (published around 19:30 Paris time).")}
      ${term("D-2", "Forecast made two days before (published around 07:00).")}
      ${term("Week-ahead", "Forecasts for 3 to 9 days ahead, published on weekdays, with the expected daily peak and RTE's temperature assumption.")}
      ${term("Annual forecast", "RTE's forecast for each week of the next year: a demand range and the expected supply margin.")}
      ${term("Lead time", "How far ahead a forecast was made.")}
    </dl>
    <h4>Accuracy measures</h4>
    <dl class="glossary">
      ${term("Error", "Forecast minus actual. Positive means RTE expected more demand than happened. Forecasts are compared every half-hour.")}
      ${term("MAE", "Mean absolute error: the average size of the miss in GW, ignoring direction.")}
      ${term("MAPE", "Mean absolute percentage error: the same, as a share of demand. Best for comparing seasons.")}
      ${term("Bias", "Average error keeping its sign: shows whether RTE tends to over- or under-forecast.")}
      ${term("Peak error", "Forecast daily maximum minus actual daily maximum.")}
    </dl>
    <h4>Comparisons</h4>
    <dl class="glossary">
      ${term("Calendar date", "Compares the same dates in earlier years (1–29 Oct with 1–29 Oct).")}
      ${term("Weekday", "Compares each day with the same weekday 52 weeks (364 days) earlier, so weekends line up.")}
      ${term("Like-for-like", "Percentage comparisons only use the days and times available this year, so a month to date is compared with the same days.")}
      ${term("Min–max range", "The band between the lowest and highest earlier year at each point.")}
      ${term("Daily profile", "The average shape of a day across the selected period, e.g. the typical October day.")}
      ${term("Forecast ahead", "In the Explorer, periods can run past today: after the last actual value the line continues with RTE's best available forecast.")}
    </dl>
    <h4>Data notes</h4>
    <ul>
      <li>History runs from 17 Dec 2012. The data updates automatically during the day.</li>
      <li>RTE time-stamps historical D-1 forecasts after the day they cover, so values before 26 Oct 2026 can't be confirmed as the versions published the day before. From that date the site records the version published in advance.</li>
      <li>RTE's D-1 data for 2–14 Oct 2019 contains corrupt values (around 0.7 GW) and is excluded.</li>
      <li>Clock-change days have 23 or 25 hours; daily figures account for this.</li>
    </ul>
    <h3 style="margin-top:22px">Nuclear availability</h3>
    <p>EDF publishes a notice for every planned or unplanned reduction in a reactor's available capacity, and a new version whenever it changes. The site stores every version since December 2010.</p>
    <dl class="glossary">
      ${term("Available capacity", "Installed capacity minus the unavailable capacity in the notices covering that moment. Where notices overlap on one reactor, the largest reduction counts (they are not added up).")}
      ${term("Planned / unplanned", "As declared by EDF: planned outages (refuelling, maintenance, ten-yearly inspections) are announced in advance; unplanned ones (failures, other incidents) are not. Modulation to follow demand is not an outage.")}
      ${term("Offline / partially available", "Offline means the notices leave less than 10% of the reactor's capacity available; partially available means between 10% and 90%.")}
      ${term("Modulating", "Online, but producing less than 80% of its available capacity in the latest hour, usually to follow demand or prices.")}
      ${term("Output", "Measured nuclear generation from RTE's actual generation data, hourly (fleet since 15 Dec 2014; per reactor for the past week).")}
      ${term("Load factor", "Output divided by installed capacity.")}
      ${term("Outlook as of a date", "The availability (and unavailability, split into planned and unplanned) implied by the latest version of each notice published by the end of that day (Paris time), for each of the next 540 days. Comparing outlooks from different dates shows how expectations moved.")}
      ${term("First announced end", "The end date in the first version of a notice. The change against it shows extensions and early returns.")}
    </dl>
    <ul>
      <li>Fessenheim 1 and 2 leave the fleet when they closed (22 Feb and 30 Jun 2020); Flamanville 3 joins at its first grid connection (21 Dec 2024). EDF filed Fessenheim's closure as an outage to 2099 and later cancelled it, so closures come from the site's own reactor list.</li>
      <li>Notices before 2015, when the EU's REMIT transparency rules took full effect, may be less complete.</li>
      <li>Outlooks only contain outages already announced, so they are usually above what happens.</li>
    </ul>
    <h3 style="margin-top:22px">Hydro reservoirs</h3>
    <p>RTE's weekly figure for the energy stored in the hydro reservoirs it monitors, in MWh (shown as TWh), since December 2014. Fill level is that figure as a share of the reservoirs' total capacity of 3,591 GWh (RTE); differences in fill level are in percentage points (pp). Weeks are compared by ISO week number.</p>
    <h3 style="margin-top:22px">Prices</h3>
    <p>Day-ahead auction prices from the ENTSO-E Transparency Platform, in €/MWh, for France, Germany (DE-LU; DE-AT-LU before 1 Oct 2018), Belgium, Switzerland, Italy North and Spain, from 5 Jan 2015. The European day-ahead market moved from hourly to 15-minute prices for delivery from 30 Sep 2025; Switzerland stays hourly.</p>
    <dl class="glossary">
      ${term("Baseload", "Average of every period in the Paris day, each weighted by its length.")}
      ${term("Peak / off-peak", "Peak is Monday–Friday 08:00–20:00 Paris time (the market standard); off-peak is every other period.")}
      ${term("Spread", "France minus the neighbour: positive means France was dearer.")}
      ${term("Parity", "Share of periods when the two prices differ by less than €0.01/MWh, usually because the interconnector between them was not congested.")}
      ${term("Negative-price hours", "Time with a price below zero (a 15-minute period counts as 0.25 hours). Zero-priced periods can be included with a switch.")}
      ${term("Negative-price depth", "How far below zero (or below the chosen threshold) each period was, times its length, added up, in €/MWh·h. It weighs depth and duration together.")}
      ${term("Volatility", "Standard deviation of the prices within each day.")}
      ${term("Capture price", "Average French price weighted by a technology's output: what a megawatt-hour of solar, wind or nuclear sold for on average. Capture rate: capture price divided by baseload.")}
      ${term("Residual demand", "French demand minus wind and solar output: what the rest of the fleet and imports have to cover.")}
      ${term("Modulating reactor (Nuclear Modulation)", "In an hour when the reactor is running (output and availability both at least 10% of its capacity), output below the chosen share (70, 80, 90 or 95%) of its available capacity. Per-reactor output comes from RTE's actual generation per unit, hourly since Dec 2014.")}
      ${term("Unused available nuclear capacity", "Available capacity in the outage notices minus measured nuclear output, never below zero. It includes modulation to follow prices and demand, but also frequency reserves, end-of-cycle coast-downs, ramp limits and undeclared outages.")}
      ${term("Duration curve", "Every period sorted from highest to lowest, so you can read the share of time a level was reached.")}
    </dl>
    <h3 style="margin-top:22px">Generation</h3>
    <p>RTE's actual generation by fuel: hourly in 2015–16, every 15 minutes from 2017. Hydro includes run-of-river, reservoirs and pumped-storage generation; pumping is not counted. Low-carbon: nuclear, hydro, wind, solar and bioenergy. Renewable: hydro, wind, solar and bioenergy.</p>
    <h3 style="margin-top:22px">Flows</h3>
    <p>Physical (measured) flows on each French border from the ENTSO-E Transparency Platform, latest available: Belgium, Germany, Switzerland, Italy (North), Spain and Great Britain. Net exports are exports minus imports. Physical flows include loop flows and can differ from the commercial exchanges agreed in the markets.</p>
    <h3 style="margin-top:22px">Notable events (the bell)</h3>
    <p>The bell shows the events of the market on screen: records, the highest or lowest value for a while (at least a week for prices, a month for generation and flows), negative prices today or tomorrow and, for France, new unplanned nuclear outages of 1 GW or more and return dates pushed back a week or more. Events from the past four days are listed.</p>`;
  const foot = `<p class="muted">Map outline: Natural Earth (public domain). Methodology, data files and code: <a href="${CONFIG.repoUrl}" target="_blank" rel="noopener">GitHub repository</a>.</p>`;
  return current && current.market === "es" ? aboutSpainHtml() + fr + foot : fr + aboutSpainHtml() + foot;
}

function openDrawer(kind) {
  const title = drawer.querySelector("#drawer-title");
  const body = drawer.querySelector(".drawer-body");
  if (kind === "whatsnew") {
    title.textContent = "What's new";
    body.innerHTML = whatsNewHtml();
    try { localStorage.setItem("seenVersion", VERSION); } catch (error) { void error; }
    newDot.hidden = true;
  } else {
    title.textContent = "About the data";
    body.innerHTML = aboutHtml();
  }
  drawer.hidden = false;
  backdrop.hidden = false;
  requestAnimationFrame(() => { drawer.classList.add("open"); backdrop.classList.add("open"); });
  drawer.querySelector("[data-close]").focus();
}
function closeDrawer() {
  drawer.classList.remove("open");
  backdrop.classList.remove("open");
  setTimeout(() => { drawer.hidden = true; backdrop.hidden = true; }, 200);
}
whatsNewButton.addEventListener("click", () => openDrawer("whatsnew"));
// The footer is redrawn per market, so its buttons are handled by delegation.
document.addEventListener("click", event => {
  const b = event.target.closest("[data-open]");
  if (b) openDrawer(b.dataset.open);
});
drawer.querySelector("[data-close]").addEventListener("click", closeDrawer);
backdrop.addEventListener("click", closeDrawer);
document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  if (!drawer.hidden) closeDrawer();
  if (!displayMenu.hidden) toggleMenu(false);
  if (!bellPanel.hidden) toggleBell(false);
  if (!marketMenu.hidden) toggleMarketMenu(false);
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

export { el };
