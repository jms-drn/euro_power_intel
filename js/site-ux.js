// Site-wide polish (v5.3), kept apart from main.js: page transitions, card
// count-up, loading placeholders, eased chart redraws, pinned controls, an
// "On this page" row, folding panels, breadcrumb, "updated" dots, keyboard
// shortcuts, quick search (site-search.js) and a copy-link button. Loaded by
// index.html before main.js. Everything respects "reduce motion".
// Code note: no asterisks here (chat formatting strips them when pasted).
import { MARKETS } from "./markets.js";
import { SITE } from "./site-pages.js";
import { openSearch } from "./site-search.js";
import { copyText } from "./util.js";

const doc = document.documentElement;
const views = document.getElementById("views");
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const store = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || "null"); localStorage.setItem(k, JSON.stringify(v)); } catch (error) { return null; } return v; };
const visible = () => [...views.children].find(x => x.dataset.view && !x.classList.contains("hidden"));
const isEs = () => document.body.dataset.market === "es";

// ---------- Charts: a short ease-in on redraw (on-screen charts only, never exports) ----------
if (window.echarts && !reduced) {
  const init = window.echarts.init;
  window.echarts.init = function (dom, theme, opts) {
    const chart = init.call(window.echarts, dom, theme, opts);
    if (dom && dom.classList && dom.classList.contains("chart")) {
      const set = chart.setOption.bind(chart);
      chart.setOption = (option, ...rest) => {
        if (option && typeof option === "object") Object.assign(option, { animation: true, animationDuration: 420, animationDurationUpdate: 300, animationEasing: "cubicOut", animationThreshold: 3000 });
        return set(option, ...rest);
      };
    }
    return chart;
  };
}

// ---------- Address of the view on screen ----------
function here() {
  const raw = location.hash.replace(/^#/, "").split("?").at(0);
  const segs = raw.split("/").filter(Boolean);
  if (!segs.length || segs.at(0) === "home") return null;
  const market = MARKETS[segs.at(0)] ? segs.shift() : "fr";
  const pages = SITE[market];
  if (!pages) return null;
  const page = pages[segs.at(0)] ? segs.at(0) : "overview";
  const tabs = Object.keys(pages[page].tabs);
  const tab = tabs.includes(segs.at(1)) ? segs.at(1) : tabs.at(0);
  return { market, page, tab, m: MARKETS[market], cfg: pages[page] };
}

// ---------- Breadcrumb ----------
const crumbs = document.createElement("nav");
crumbs.className = "ux-crumbs";
crumbs.setAttribute("aria-label", "You are here");
function renderCrumbs() {
  const h = here();
  crumbs.hidden = !h;
  if (!h) return;
  const multi = Object.keys(h.cfg.tabs).length > 1;
  const html = `<a href="#home">All markets</a><span>›</span><a href="#${h.m.prefix}overview">${h.m.name}</a><span>›</span>`
    + (multi ? `<a href="#${h.m.prefix}${h.page}">${h.cfg.label}</a><span>›</span><b>${h.cfg.tabs[h.tab].label}</b>` : `<b>${h.cfg.label}</b>`);
  if (crumbs.innerHTML !== html) crumbs.innerHTML = html;
  if (views.firstChild !== crumbs) views.prepend(crumbs);
}

// ---------- Page transitions, placeholders, count-up, card hover ----------
const wasHidden = new WeakMap();
new MutationObserver(list => {
  for (const r of list) {
    const s = r.target;
    if (s.parentElement !== views || !s.dataset.view) continue;
    const hidden = s.classList.contains("hidden");
    if (wasHidden.get(s) !== false && !hidden && !reduced) {
      s.classList.remove("ux-enter");
      void s.offsetWidth;
      s.classList.add("ux-enter");
    }
    wasHidden.set(s, hidden);
  }
}).observe(views, { attributes: true, attributeFilter: ["class"], subtree: true });

const counted = new WeakSet();
function countUp(el) {
  const text = el.textContent;
  const match = text.match(/^(\D?)(\d[\d,]{0,12}(?:\.\d+)?)(.{0,40})$/);
  if (!match || reduced) return;
  const target = Number(match.at(2).replace(/,/g, ""));
  const dec = (match.at(2).split(".").at(1) || "").length;
  if (!Number.isFinite(target) || target === 0) return;
  const fmt = v => match.at(1) + v.toLocaleString("en-GB", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + match.at(3);
  const start = performance.now();
  const step = now => {
    const p = Math.min(1, (now - start) / 450);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = p < 1 ? fmt(target / (1 / eased)) : text;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function tidyCards(section) {
  section.querySelectorAll("[data-cards]").forEach(box => {
    box.classList.toggle("ux-skel", !box.children.length);
    if (!box.children.length) return;
    let grid = box;
    while (grid.children.length === 1 && grid.firstElementChild.children.length) grid = grid.firstElementChild;
    grid.classList.add("ux-cardgrid");
    const first = !counted.has(box);
    counted.add(box);
    [...grid.children].forEach(cardEl => {
      cardEl.classList.add("ux-card");
      if (!first) return;
      const leaves = [...cardEl.querySelectorAll("div, span, b, strong, p")].filter(x => !x.children.length && /^\D?\d/.test(x.textContent.trim()));
      const big = leaves.sort((a, b) => parseFloat(getComputedStyle(b).fontSize) - parseFloat(getComputedStyle(a).fontSize)).at(0);
      if (big) countUp(big);
    });
  });
}

// ---------- On this page, folding panels ----------
const folded = new Set(store("uxFolded") || []);
function foldKey(section, i) { return (section.dataset.view || "") + "|" + i; }
function tidyPanels(section) {
  const panels = [...section.querySelectorAll(".panel")].filter(p => p.querySelector(":scope > .panel-head h2"));
  panels.forEach((p, i) => {
    const head = p.querySelector(":scope > .panel-head");
    const key = foldKey(section, i);
    if (!head.querySelector(".ux-fold")) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn ghost ux-fold";
      b.title = "Fold or unfold this panel";
      b.addEventListener("click", () => {
        const now = !p.classList.contains("ux-folded");
        p.classList.toggle("ux-folded", now);
        if (now) folded.add(key); else folded.delete(key);
        store("uxFolded", [...folded].slice(-200));
        b.textContent = now ? "+" : "−";
        if (!now) window.dispatchEvent(new Event("resize"));
      });
      (head.querySelector(".panel-tools") || head).appendChild(b);
    }
    const isFolded = folded.has(key);
    p.classList.toggle("ux-folded", isFolded);
    const fb = head.querySelector(".ux-fold");
    if (fb.textContent !== (isFolded ? "+" : "−")) fb.textContent = isFolded ? "+" : "−";
    if (!p.id) p.id = "ux-p-" + Math.random().toString(36).slice(2, 9);
  });
  let jump = section.querySelector(":scope > .ux-jump");
  if (!isEs() || panels.length < 4) { if (jump) jump.remove(); return; }
  if (!jump) {
    jump = document.createElement("nav");
    jump.className = "ux-jump";
    jump.setAttribute("aria-label", "On this page");
    const anchor = section.querySelector(":scope > [data-cards]") || section.firstElementChild;
    section.insertBefore(jump, anchor ? anchor.nextSibling : null);
  }
  const short = t => { const x = t.split(/[,:]/).at(0).trim(); return x.length > 34 ? x.slice(0, 32) + "…" : x; };
  const html = `<span class="muted small">On this page</span>` + panels.map(p => `<a href="#" data-jump="${p.id}">${short(p.querySelector(".panel-head h2").textContent)}</a>`).join("");
  if (jump.innerHTML !== html) jump.innerHTML = html;
}
views.addEventListener("click", e => {
  const a = e.target.closest("[data-jump]");
  if (!a) return;
  e.preventDefault();
  document.getElementById(a.dataset.jump)?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
});

// ---------- Copy-link button in the page bar ----------
function tidyPageBar() {
  const bar = document.getElementById("page-bar");
  const actions = bar && bar.querySelector(".bar-actions");
  if (!actions || actions.querySelector("[data-uxlink]")) return;
  const b = document.createElement("button");
  b.type = "button";
  b.className = "btn ghost small";
  b.dataset.uxlink = "";
  b.title = "Copy a link that opens exactly this view (page, tab and settings)";
  b.textContent = "Copy link";
  b.addEventListener("click", () => copyText(location.href));
  actions.prepend(b);
}

// ---------- Pinned controls: sit just under the header when it stays on screen ----------
function setStickyTop() {
  const header = document.querySelector(".site-header");
  const pos = header ? getComputedStyle(header).position : "";
  doc.style.setProperty("--ux-top", (pos === "sticky" || pos === "fixed" ? header.offsetHeight : 0) + "px");
  document.body.classList.toggle("ux-es", isEs());
}
window.addEventListener("resize", setStickyTop);

// ---------- "Updated" dots in the Spain sidebar (new prices, new reservoir bulletin) ----------
async function tidySideNav() {
  if (!isEs()) return;
  const { freshness } = await import("./es-data.js");
  const seen = store("uxSeen") || {};
  const h = here();
  for (const [page, re] of [["prices", /prices to ([^·]+)/i], ["hydro", /reservoirs to ([^·]+)/i]]) {
    const link = document.querySelector(`.side-nav .side-link[data-page="${page}"]`);
    if (!link) continue;
    const sig = ((await freshness(page)) || "").match(re)?.at(1)?.trim();
    if (!sig) continue;
    if (!seen[page] || (h && h.market === "es" && h.page === page)) seen[page] = sig;
    let dot = link.querySelector(".ux-dot");
    const show = seen[page] !== sig;
    if (show && !dot) { dot = document.createElement("span"); dot.className = "ux-dot"; dot.title = "New data since your last visit"; link.appendChild(dot); }
    if (!show && dot) dot.remove();
  }
  store("uxSeen", seen);
}

// ---------- One settle step after every redraw ----------
let timer = 0;
let lastHash = "";
function settle() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    renderCrumbs();
    setStickyTop();
    tidyPageBar();
    const s = visible();
    if (s) { tidyCards(s); tidyPanels(s); }
    if (location.hash.split("?").at(0) !== lastHash) { lastHash = location.hash.split("?").at(0); tidySideNav().catch(() => {}); }
  }, 120);
}
new MutationObserver(settle).observe(views, { childList: true, subtree: true });
window.addEventListener("hashchange", settle);

// ---------- Keyboard: ← → step the hydro slider, 1-9 switch tabs, Ctrl+K or / search ----------
document.addEventListener("keydown", e => {
  const typing = e.target.closest("input, select, textarea, [contenteditable]");
  if ((e.key === "k" || e.key === "K") && (e.ctrlKey || e.metaKey)) { e.preventDefault(); openSearch(); return; }
  if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === "/") { e.preventDefault(); openSearch(); return; }
  const s = visible();
  if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && s) {
    const b = s.querySelector(`[data-step="${e.key === "ArrowLeft" ? "-1" : "1"}"]`);
    if (b) { e.preventDefault(); b.click(); }
    return;
  }
  if (/^[1-9]$/.test(e.key)) {
    const tab = [...document.querySelectorAll("#tabs .tab")].at(Number(e.key) - 1);
    if (tab) tab.click();
  }
});
