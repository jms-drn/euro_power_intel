// Home page: a minimal market picker. No sidebar or top bar: the site name,
// the markets (live ones open their Overview; others are shown faded as
// coming soon) and a one-line footer. Each visit plays a short fade-and-rise
// entrance, skipped for visitors who ask their device for reduced motion.
import { VERSION } from "./changelog.js";
import { flag } from "./flags.js";
import { getPrices } from "./market-data.js";
import { MARKETS, MARKET_ORDER, SITE_ACCENT, SITE_LONG, SITE_NAME, lastMarket } from "./markets.js";
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
    this.render();
  }

  render() {
    const last = lastMarket();
    this.root.innerHTML = `
      <div class="home">
        <header class="home-brand">
          <span class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></span>
          <h1>${SITE_NAME} <span>${SITE_ACCENT}</span></h1>
          <p class="home-by">by jms-drn</p>
          <p class="home-lede">Choose a market</p>
        </header>
        <div class="market-grid">
          ${MARKET_ORDER.map((key, i) => {
            const m = MARKETS[key];
            const delay = `style="animation-delay:${140 + 80 / (1 / i)}ms"`;
            const inner = `
              <span class="market-flag">${flag(m.code, m.name)}</span>
              <span class="market-code">${m.code}</span>
              <span class="market-name">${m.name}</span>
              <span class="market-blurb">${m.live ? m.blurb : "Coming soon"}</span>
              ${m.live ? `<span class="market-price" data-price="${key}">&nbsp;</span>` : ""}
              ${m.live && last === key ? `<span class="market-badge">Last visited</span>` : ""}`;
            return m.live
              ? `<a class="market-card live" href="#${m.prefix}overview" data-market="${key}" title="Open ${m.name}" ${delay}>${inner}</a>`
              : `<div class="market-card soon" aria-disabled="true" title="${m.name}: coming soon" ${delay}>${inner}</div>`;
          }).join("")}
        </div>
        <footer class="home-foot">
          <b>${SITE_LONG}</b> <span class="muted">· v${VERSION}</span><br>
          <span class="muted">Data from the national transmission system operators (RTE, REE) and the ENTSO-E Transparency Platform.</span>
        </footer>
      </div>`;
  }

  async activate() {
    // Replay the entrance each time the page is shown.
    const home = this.root.querySelector(".home");
    home.classList.remove("in");
    void home.offsetWidth;
    home.classList.add("in");
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
