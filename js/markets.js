// The markets the site covers. "live" markets have pages; the others show on
// the home page as coming soon. Every address starts with the market's
// prefix: #fr/prices/explorer, #es/demand/today.

export const SITE_NAME = "European Power";
export const SITE_ACCENT = "Intel";
export const SITE_LONG = "European Power Intelligence";

export const MARKETS = {
  fr: {
    code: "FR", name: "France", adj: "French", live: true, prefix: "fr/",
    tso: "RTE", zone: "FR",
    blurb: "Demand and forecasts, nuclear availability, hydro reservoirs, day-ahead prices, generation and cross-border flows.",
    sources: "RTE (French transmission system operator) consumption, actual generation and unavailability APIs; ENTSO-E Transparency Platform day-ahead prices and physical flows. Mainland France. Times in Europe/Paris."
  },
  es: {
    code: "ES", name: "Spain", adj: "Spanish", live: true, prefix: "es/",
    tso: "REE", zone: "ES",
    blurb: "Demand and REE's forecast, day-ahead prices against France and Portugal, the generation mix and cross-border flows.",
    sources: "REE (Spanish transmission system operator) real-time demand, forecast and generation via ESIOS; ENTSO-E Transparency Platform day-ahead prices and physical flows. Mainland Spain. Times in Central European time."
  },
  de: {
    code: "DE", name: "Germany", adj: "German", live: false, prefix: "de/",
    tso: "", zone: "DE",
    blurb: "Coming soon.",
    sources: ""
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
