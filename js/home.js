// Home page: choose a market. Each live market is a card with its flag, a
// one-line description and today's baseload price; markets still to come are
// shown faded. The last market you used is marked.
import { flag } from "./flags.js";
import { getPrices } from "./market-data.js";
import { MARKETS, MARKET_ORDER, SITE_ACCENT, SITE_NAME, lastMarket } from "./markets.js";
import { addDays, fmtNumber, todayParis } from "./util.js";

function baseload(points) {
  let sum = 0;
  let mins = 0;
  for (const p of points) {
    if (p.eur == null) continue;
    sum += p.eur / (1 / p.min);
    mins += p.min;
  }
  return mins >= 1200 ? sum / mins : null;
}

export class Home {
  constructor(root) {
    this.root = root;
    this.writesHash = true;
    const last = lastMarket();
    root.innerHTML = `
      <div class="home-hero">
        <h1>${SITE_NAME} <span>${SITE_ACCENT}</span></h1>
        <p>Open data on European power markets: demand, prices, generation and flows, compared with earlier years. Choose a market to start.</p>
      </div>
      <div class="market-grid">
        ${MARKET_ORDER.map(key => {
          const m = MARKETS[key];
          const inner = `
            <span class="market-flag">${flag(m.code, m.name)}</span>
            <span class="market-code">${m.code}</span>
            <span class="market-name">${m.name}</span>
            <span class="market-blurb">${m.live ? m.blurb : "Coming soon"}</span>
            ${m.live ? `<span class="market-price" data-price="${key}">&nbsp;</span>` : ""}
            ${m.live && last === key ? `<span class="market-badge">Last visited</span>` : ""}`;
          return m.live
            ? `<a class="market-card live" href="#${m.prefix}overview" data-market="${key}" title="Open ${m.name}">${inner}</a>`
            : `<div class="market-card soon" aria-disabled="true" title="${m.name}: coming soon">${inner}</div>`;
        }).join("")}
      </div>
      <p class="home-foot muted">Sources: the national transmission system operators (RTE, REE) and the ENTSO-E Transparency Platform. Times are Central European. Your display settings and pinned views apply to every market.</p>`;
  }

  async activate() {
    const today = todayParis();
    for (const key of MARKET_ORDER) {
      const m = MARKETS[key];
      const slot = this.root.querySelector(`[data-price="${key}"]`);
      if (!slot) continue;
      try {
        let day = today;
        let pts = await getPrices(m.zone, day, day);
        if (baseload(pts) == null) { day = addDays(today, -1); pts = await getPrices(m.zone, day, day); }
        const b = baseload(pts);
        const prev = baseload(await getPrices(m.zone, addDays(day, -1), addDays(day, -1)));
        if (b == null) { slot.textContent = ""; continue; }
        const d = prev == null ? "" : ` <em class="${b - prev >= 0 ? "up" : "down"}">${b - prev >= 0 ? "+" : "−"}${fmtNumber(Math.abs(b - prev), 2)}</em>`;
        slot.innerHTML = `Baseload ${day === today ? "today" : "yesterday"} <b>€${fmtNumber(b, 2)}/MWh</b>${d}`;
      } catch (error) {
        slot.textContent = "";
      }
    }
  }
}
