// The Display menu (theme, line colours, thickness, markers) and the side
// panels (What's new, About the data).
// Code note: no asterisks here (chat formatting strips them when pasted).
import { VERSION } from "./changelog-v5.js";
import { refreshAllCharts } from "./chart.js";
import { PALETTES, settings, updateSettings } from "./settings.js";
import { aboutHtml, whatsNewHtml } from "./site-about.js";

const root = document.documentElement;
const displayButton = document.getElementById("display-button");
const displayMenu = document.getElementById("display-menu");
const drawer = document.getElementById("drawer");
const backdrop = document.querySelector(".drawer-backdrop");
const whatsNewButton = document.getElementById("whats-new");
const newDot = whatsNewButton.querySelector(".new-dot");
let marketNow = () => "fr";
let refreshView = async () => {};
let closeOthers = () => {};

// ---------- Display menu ----------

function renderDisplayMenu() {
  const s = settings();
  const theme = root.dataset.theme;
  const seg = (key, options) => `<div class="segmented" role="group">${options.map(o => `<button type="button" data-set="${key}" data-value="${o.at(0)}" aria-pressed="${String(s[key]) === o.at(0)}">${o.at(1)}</button>`).join("")}</div>`;
  const swatches = p => { const c = p[theme]; return ["actual", "d1", "id", "d2", "ly"].map(r => `<i style="background:${c[r]}"></i>`).join(""); };
  displayMenu.innerHTML = `
    <div class="menu-section"><div class="menu-label">Theme</div>${seg("theme", [["dark", "Dark"], ["light", "Light"]])}</div>
    <div class="menu-section"><div class="menu-label">Line colours</div><div class="palette-list">${Object.keys(PALETTES).map(key => `
      <button type="button" class="palette${s.palette === key ? " selected" : ""}" data-set="palette" data-value="${key}" aria-pressed="${s.palette === key}"><span class="swatches">${swatches(PALETTES[key])}</span><span>${PALETTES[key].name}</span></button>`).join("")}</div></div>
    <div class="menu-section"><div class="menu-label">Line thickness</div>${seg("thickness", [["thin", "Thin"], ["normal", "Normal"], ["thick", "Thick"]])}</div>
    <div class="menu-section"><label class="check"><input type="checkbox" data-set="markers" ${s.markers ? "checked" : ""}> Show a marker on each data point</label></div>`;
}
async function setDisplay(patch) {
  updateSettings(patch);
  renderDisplayMenu();
  refreshAllCharts();
  await refreshView();
}
export function toggleMenu(open) {
  const show = open ?? displayMenu.hidden;
  displayMenu.hidden = !show;
  displayButton.setAttribute("aria-expanded", show);
  if (show) renderDisplayMenu();
}

// ---------- Side panels ----------

const seenVersion = () => { try { return localStorage.getItem("seenVersion"); } catch (error) { return VERSION; } };
function openDrawer(kind) {
  drawer.querySelector("#drawer-title").textContent = kind === "whatsnew" ? "What's new" : "About the data";
  drawer.querySelector(".drawer-body").innerHTML = kind === "whatsnew" ? whatsNewHtml() : aboutHtml(marketNow());
  if (kind === "whatsnew") {
    try { localStorage.setItem("seenVersion", VERSION); } catch (error) { void error; }
    newDot.hidden = true;
  }
  drawer.hidden = false;
  backdrop.hidden = false;
  requestAnimationFrame(() => { drawer.classList.add("open"); backdrop.classList.add("open"); });
  drawer.querySelector("[data-close]").focus();
}
export function closeDrawer() {
  if (drawer.hidden) return;
  drawer.classList.remove("open");
  backdrop.classList.remove("open");
  setTimeout(() => { drawer.hidden = true; backdrop.hidden = true; }, 200);
}

// getMarket returns the market on screen; refresh redraws the current view
// after a display change; close shuts the other menus.
export function setupPanels(getMarket, refresh, close) {
  marketNow = getMarket;
  refreshView = refresh;
  closeOthers = close;
  newDot.hidden = seenVersion() === VERSION;
  displayMenu.addEventListener("click", event => {
    event.stopPropagation();
    const b = event.target.closest("button[data-set]");
    if (!b) return;
    const patch = {};
    patch[b.dataset.set] = b.dataset.value;
    setDisplay(patch);
  });
  displayMenu.addEventListener("change", event => { if (event.target.matches('input[data-set="markers"]')) setDisplay({ markers: event.target.checked }); });
  displayButton.addEventListener("click", event => { event.stopPropagation(); closeOthers(); toggleMenu(); });
  document.addEventListener("click", event => { if (!displayMenu.hidden && !displayMenu.contains(event.target)) toggleMenu(false); });
  whatsNewButton.addEventListener("click", () => openDrawer("whatsnew"));
  // The footer is redrawn per market, so its buttons are handled by delegation.
  document.addEventListener("click", event => { const b = event.target.closest("[data-open]"); if (b) openDrawer(b.dataset.open); });
  drawer.querySelector("[data-close]").addEventListener("click", closeDrawer);
  backdrop.addEventListener("click", closeDrawer);
}
