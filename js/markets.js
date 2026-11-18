// The markets the site covers. "live" markets have pages; the others show on
// the home page as coming soon. "prefix" starts every address of a market
// (France keeps its original addresses, so old links still work).

export const SITE_NAME = "European Power";
export const SITE_ACCENT = "Intel";

export const MARKETS = {
  fr: {
    code: "FR", name: "France", adj: "French", live: true, prefix: "",
    tso: "RTE", zone: "FR",
    blurb: "Demand and forecasts, nuclear availability, hydro reservoirs, day-ahead prices, generation and cross-border flows."
  },
  es: {
    code: "ES", name: "Spain", adj: "Spanish", live: true, prefix: "es/",
    tso: "REE", zone: "ES",
    blurb: "Demand and REE's forecast, day-ahead prices against France and Portugal, the generation mix and cross-border flows."
  },
  de: {
    code: "DE", name: "Germany", adj: "German", live: false, prefix: "de/",
    tso: "", zone: "DE",
    blurb: "Coming soon."
  }
};

export const MARKET_ORDER = ["fr", "es", "de"];

export function liveMarkets() {
  return MARKET_ORDER.filter(k => MARKETS[k].live);
}

export function lastMarket() {
  try { return localStorage.getItem("lastMarket") || ""; } catch (error) { return ""; }
}

export function rememberMarket(key) {
  try { localStorage.setItem("lastMarket", key); } catch (error) { void error; }
}
