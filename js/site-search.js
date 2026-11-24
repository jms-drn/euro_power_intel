// Quick search (Ctrl+K, / or the Search button in the header): every page
// and tab of the live markets, plus Spain's river basins (opens the Hydro
// Overview with that basin selected). Used by site-ux.js.
// Code note: no asterisks here (chat formatting strips them when pasted).
import { MARKETS } from "./markets.js";
import { SITE } from "./site-pages.js";

const views = document.getElementById("views");
const plain = s => String(s || "").normalize("NFD").toLowerCase().replace(/[^a-z0-9 ]/g, "");
const visible = () => [...views.children].find(x => x.dataset.view && !x.classList.contains("hidden"));

const box = document.createElement("div");
box.className = "ux-search";
box.hidden = true;
box.innerHTML = `<div class="ux-search-card" role="dialog" aria-label="Quick search"><input type="search" placeholder="Search pages, tabs and Spanish basins…" aria-label="Search"><div class="ux-search-list" role="listbox"></div><p class="muted small">↑ ↓ to choose · Enter to open · Esc to close</p></div>`;
document.body.appendChild(box);
const input = box.querySelector("input");
const listEl = box.querySelector(".ux-search-list");
let entries = [];
let hits = [];
let pick = 0;
async function buildIndex() {
  entries = [];
  for (const k of Object.keys(SITE)) {
    const m = MARKETS[k];
    if (!m || m.live === false) continue;
    for (const [p, cfg] of Object.entries(SITE[k])) {
      const tabs = Object.entries(cfg.tabs);
      for (const [t, tc] of tabs) entries.push({ label: `${m.name} › ${cfg.label}${tabs.length > 1 ? " › " + tc.label : ""}`, hash: `#${m.prefix}${p}${tabs.length > 1 ? "/" + t : ""}` });
    }
  }
  try {
    const { getBasins } = await import("./es-hydro-map-data.js");
    const data = await getBasins();
    for (const key of data.keys) entries.push({ label: `Spain › Hydro › ${data.names.get(key)} basin`, hash: "#es/hydro/overview", basin: key });
  } catch (error) { void error; }
}
function renderHits() {
  const words = plain(input.value).split(" ").filter(Boolean);
  hits = entries.filter(x => words.every(w => plain(x.label).includes(w))).slice(0, 12);
  pick = Math.min(pick, Math.max(0, hits.length - 1));
  listEl.innerHTML = hits.map((x, i) => `<button type="button" class="ux-hit${i === pick ? " on" : ""}" data-i="${i}">${x.label}</button>`).join("") || `<p class="muted small">No matches</p>`;
}
function go(x) {
  closeSearch();
  if (!x) return;
  location.hash = x.hash;
  if (!x.basin) return;
  let tries = 0;
  const wait = setInterval(() => {
    const b = visible()?.querySelector(`.esh-row[data-basin="${x.basin}"]`);
    if (b || ++tries > 40) { clearInterval(wait); b?.click(); }
  }, 150);
}
export async function openSearch() {
  box.hidden = false;
  input.value = "";
  pick = 0;
  if (!entries.length) await buildIndex();
  renderHits();
  input.focus();
}
function closeSearch() { box.hidden = true; }
input.addEventListener("input", () => { pick = 0; renderHits(); });
input.addEventListener("keydown", e => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); pick = Math.max(0, Math.min(hits.length - 1, pick + (e.key === "ArrowDown" ? 1 : -1))); renderHits(); }
  if (e.key === "Enter") go(hits.at(pick));
  if (e.key === "Escape") closeSearch();
});
listEl.addEventListener("click", e => { const b = e.target.closest(".ux-hit"); if (b) go(hits.at(Number(b.dataset.i))); });
box.addEventListener("click", e => { if (e.target === box) closeSearch(); });
const searchButton = document.createElement("button");
searchButton.type = "button";
searchButton.className = "btn ghost ux-search-btn";
searchButton.title = "Search pages, tabs and basins (Ctrl+K)";
searchButton.innerHTML = `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 16l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span>Search</span><kbd>Ctrl K</kbd>`;
searchButton.addEventListener("click", openSearch);
document.querySelector(".header-actions")?.prepend(searchButton);
