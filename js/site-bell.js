// The notification bell: events for the market on screen only. France's
// come from data/alerts.json (links without a market), Spain's from
// data/es/alerts.json (links "es/..."). All show by default; topic buttons
// narrow them, and a topic can be muted. A count and a glow show unseen
// ones; seen alerts and muted topics are remembered in this browser.
// Code note: no asterisks here (chat formatting strips them when pasted).
import { MARKETS } from "./markets.js";

const TOPICS = { prices: "Prices", generation: "Generation", hydro: "Hydro", nuclear: "Nuclear", flows: "Flows", demand: "Demand" };
const LEVEL = { record: "Record", month: "Month record", since: "Highest/lowest since", event: "Event" };
const button = document.getElementById("bell");
const panel = document.getElementById("bell-panel");
const count = button.querySelector(".bell-count");
let alerts = [];
let topic = "all";
let loaded = false;
let marketNow = () => "fr";
let closeOthers = () => {};

const marketOf = a => { const s = a.link.split("/").at(0); return MARKETS[s] ? s : "fr"; };
const pathOf = a => (MARKETS[a.link.split("/").at(0)] ? a.link.slice(a.link.indexOf("/") + 1) : a.link);
const topicOf = a => pathOf(a).split(/[/?]/).at(0);
const readSet = name => { try { return new Set(JSON.parse(localStorage.getItem(name) || "[]")); } catch (error) { return new Set(); } };
const saveSet = (name, set, keep) => { try { localStorage.setItem(name, JSON.stringify([...set].slice(-keep))); } catch (error) { void error; } };
const fmtDay = d => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(Date.parse(`${d}T12:00:00Z`));

function recent({ includeMuted = false } = {}) {
  const cutoff = new Date(Date.now() - 345600000).toISOString().slice(0, 10);
  const off = readSet("mutedTopics");
  return alerts.filter(a => a.date >= cutoff && marketOf(a) === marketNow() && (includeMuted || !off.has(topicOf(a))));
}

export function renderBell() {
  const seen = readSet("seenAlerts");
  const unseen = recent().filter(a => !seen.has(a.id)).length;
  count.textContent = unseen > 9 ? "9+" : String(unseen);
  count.hidden = !unseen;
  button.classList.toggle("glow", unseen > 0);
  const name = MARKETS[marketNow()].name;
  button.title = unseen ? `${unseen} new notable ${unseen === 1 ? "event" : "events"} in ${name}` : `Notable events in ${name}`;
}

function renderPanel() {
  const seen = readSet("seenAlerts");
  const off = readSet("mutedTopics");
  const m = MARKETS[marketNow()];
  const all = recent({ includeMuted: true });
  const topics = [...new Set(all.map(topicOf))].filter(t => TOPICS[t]);
  const list = all.filter(a => (topic === "all" ? !off.has(topicOf(a)) : topicOf(a) === topic));
  panel.innerHTML = `<div class="bell-head"><b>Notable events · ${m.name}</b><span class="muted">Past 4 days</span></div>
    ${topics.length > 1 || off.size ? `<div class="bell-filters">${["all", ...topics].map(t => `<button type="button" data-topic="${t}" aria-pressed="${topic === t}">${t === "all" ? "All" : TOPICS[t]}${off.has(t) ? " (muted)" : ""}</button>`).join("")}
      ${topic !== "all" ? `<button type="button" class="bell-mute" data-mute="${topic}">${off.has(topic) ? "Unmute" : "Mute"} ${TOPICS[topic]}</button>` : ""}</div>` : ""}
    ${list.length ? `<ul class="bell-list">${list.map(a => `<li><a href="#${marketOf(a)}/${pathOf(a)}" class="${seen.has(a.id) ? "" : "unseen"}"><span class="bell-level ${a.level}">${LEVEL[a.level] || ""}</span><b>${a.title}</b><span>${a.detail}</span><span class="muted">${fmtDay(a.date)} · open the data →</span></a></li>`).join("")}</ul>`
      : `<p class="muted bell-empty">Nothing notable for ${m.name} in the past four days.</p>`}
    <p class="bell-foot muted">Records, the highest or lowest values for a while, negative prices${m.code === "FR" ? " and new unplanned nuclear outages" : " and hydro reserves unusual for the time of year"}.</p>`;
}

export function toggleBell(open) {
  const show = open ?? panel.hidden;
  panel.hidden = !show;
  button.setAttribute("aria-expanded", show);
  if (show) {
    renderPanel();
    saveSet("seenAlerts", new Set([...readSet("seenAlerts"), ...recent().map(a => a.id)]), 300);
    renderBell();
  }
}

// Called when the market on screen changes: back to "All".
export function resetBellTopic() {
  topic = "all";
  renderBell();
}

export const bellLoaded = () => loaded;

export async function loadBell() {
  try {
    const got = await Promise.all([
      import("./market-data.js").then(m => m.getAlerts()).catch(() => ({})),
      import("./es-data.js").then(m => m.getEsAlerts()).catch(() => [])
    ]);
    alerts = [...((got.at(0) || {}).alerts || []), ...got.at(1)];
    loaded = true;
    renderBell();
    if (!panel.hidden) renderPanel();
  } catch (error) { console.error(error); }
}

// getMarket returns the market on screen; close shuts the other menus.
export function setupBell(getMarket, close) {
  marketNow = () => { const m = getMarket(); return MARKETS[m] ? m : "fr"; };
  closeOthers = close;
  button.addEventListener("click", event => { event.stopPropagation(); closeOthers(); toggleBell(); });
  panel.addEventListener("click", event => {
    event.stopPropagation();
    const t = event.target.closest("[data-topic]");
    if (t) { topic = t.dataset.topic; renderPanel(); return; }
    const mute = event.target.closest("[data-mute]");
    if (mute) {
      const off = readSet("mutedTopics");
      if (off.has(mute.dataset.mute)) off.delete(mute.dataset.mute); else off.add(mute.dataset.mute);
      saveSet("mutedTopics", off, 50);
      renderPanel();
      renderBell();
      return;
    }
    if (event.target.closest("a")) toggleBell(false);
  });
  document.addEventListener("click", () => { if (!panel.hidden) toggleBell(false); });
}
