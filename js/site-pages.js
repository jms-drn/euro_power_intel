// The pages of each market: sidebar label, header accent (after "France
// Power"), document title, tabs and the code that draws each tab.
// Code note: no asterisks here (chat formatting strips them when pasted).

const fr = name => import("./" + name + ".js");
const es = async () => import("./es-pages.js");

const FR_PAGES = {
  overview: {
    label: "Overview", accent: "Intelligence", doc: "France Power Intelligence",
    tabs: { main: { label: "Overview", load: async root => new (await fr("overview")).Overview(root) } }
  },
  demand: {
    label: "Demand", accent: "Demand Intelligence", doc: "France Power Demand Intelligence",
    tabs: {
      today: { label: "Today", load: async root => new (await fr("today")).Today(root) },
      explorer: { label: "Explorer", load: async root => new (await fr("explorer")).Explorer(root) },
      accuracy: { label: "Forecast accuracy", load: async root => new (await fr("accuracy")).Accuracy(root) },
      outlook: { label: "Outlook", load: async root => new (await fr("outlook")).Outlook(root) }
    }
  },
  nuclear: {
    label: "Nuclear availability", accent: "Nuclear Availability Intelligence", doc: "France Power Nuclear Availability Intelligence",
    tabs: {
      today: { label: "Today", load: async root => new (await fr("nuclear-today")).NuclearToday(root) },
      explorer: { label: "Explorer", load: async root => new (await fr("nuclear-explorer")).NuclearExplorer(root) },
      outages: { label: "Outages", load: async root => new (await fr("nuclear-outages")).NuclearOutages(root) },
      outlook: { label: "Outlook", load: async root => new (await fr("nuclear-outlook")).NuclearOutlook(root) }
    }
  },
  hydro: {
    label: "Hydro reserves", accent: "Hydro Intelligence", doc: "France Power Hydro Intelligence",
    tabs: { main: { label: "Reservoirs", load: async root => new (await fr("hydro")).Hydro(root) } }
  },
  prices: {
    label: "Prices", accent: "Price Intelligence", doc: "France Power Price Intelligence", stepper: true, sharePeriod: true,
    tabs: {
      short: { label: "Short term", load: async root => new (await fr("prices-short")).PriceShort(root) },
      explorer: { label: "Explorer", load: async root => (await fr("prices-explorer")).priceExplorer(root) },
      spreads: { label: "Spreads", load: async root => new (await fr("prices-analysis")).PriceSpreads(root) },
      mix: { label: "Mix & Price", load: async root => new (await fr("prices-analysis")).MixPrice(root) },
      negative: { label: "Negative Prices", load: async root => new (await fr("prices-analysis")).NegativePrices(root) },
      capture: { label: "Capture Prices", load: async root => new (await fr("prices-explorer")).CapturePrices(root) },
      residual: { label: "Residual Demand", load: async root => new (await fr("prices-explorer")).ResidualDemand(root) },
      modulation: { label: "Nuclear Modulation", load: async root => new (await fr("prices-analysis")).NuclearModulation(root) }
    }
  },
  generation: {
    label: "Generation", accent: "Generation Intelligence", doc: "France Power Generation Intelligence",
    tabs: {
      today: { label: "Today", load: async root => new (await fr("generation")).GenToday(root) },
      explorer: { label: "Explorer", load: async root => (await fr("generation")).genExplorer(root) },
      records: { label: "Records", load: async root => new (await fr("generation")).GenRecords(root) }
    }
  },
  flows: {
    label: "Flows", accent: "Flows Intelligence", doc: "France Power Flows Intelligence",
    tabs: {
      today: { label: "Live map", load: async root => new (await fr("flows")).FlowsMap(root) },
      explorer: { label: "Explorer", load: async root => (await fr("flows")).flowsExplorer(root) },
      prices: { label: "Flows and prices", load: async root => new (await fr("flows")).FlowsPrices(root) }
    }
  }
};

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
      spreads: { label: "Spreads", load: async root => new (await es()).EsSpreads(root) },
      mix: { label: "Mix & Price", load: async root => new (await es()).EsMixPrice(root) },
      negative: { label: "Negative Prices", load: async root => new (await es()).EsNegative(root) },
      capture: { label: "Capture Prices", load: async root => new (await es()).EsCapture(root) },
      residual: { label: "Residual Demand", load: async root => new (await es()).EsResidual(root) }
    }
  },
  generation: {
    label: "Generation", accent: "Generation Intelligence", doc: "Spain Power Generation Intelligence",
    tabs: {
      today: { label: "Today", load: async root => new (await es()).EsGenToday(root) },
      explorer: { label: "Explorer", load: async root => (await es()).esGenExplorer(root) }
    }
  },
  hydro: {
    label: "Hydro", accent: "Hydro Intelligence", doc: "Spain Power Hydro Intelligence",
    tabs: {
      year: { label: "Hydro year", load: async root => new (await es()).EsHydroYear(root) },
      profile: { label: "Daily profile", load: async root => new (await es()).EsHydroProfile(root) },
      value: { label: "Value", load: async root => new (await es()).EsHydroValue(root) },
      pumping: { label: "Pumping", load: async root => new (await es()).EsHydroPumping(root) }
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

export const SITE = { fr: FR_PAGES, es: ES_PAGES };

// The settings of one page of one market (or null).
export function cfgOf(market, page) {
  const pages = SITE[market];
  return pages ? pages[page] || null : null;
}

export const HOME_PAGE = { load: async root => new (await import("./home.js")).Home(root) };

const ICONS = {
  overview: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/>',
  demand: '<path d="M3 13h3.5l2.5-6 4 11 2.8-7H21"/>',
  nuclear: '<circle cx="12" cy="12" r="1.7"/><ellipse cx="12" cy="12" rx="9" ry="3.6"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)"/>',
  hydro: '<path d="M12 3.2c3.3 4.2 6 7.6 6 10.8a6 6 0 0 1-12 0c0-3.2 2.7-6.6 6-10.8Z"/><path d="M9 15a3 3 0 0 0 3 3"/>',
  prices: '<path d="M17.5 6.5A6.5 6.5 0 1 0 17.5 17.5"/><path d="M4.5 10.5h9M4.5 13.5h9"/>',
  generation: '<path d="M13 2.5 5 13.5h6l-1 8 8-11h-6l1-8Z"/>',
  flows: '<path d="M4 8.5h14M14.5 5l3.5 3.5-3.5 3.5M20 15.5H6M9.5 12 6 15.5 9.5 19"/>'
};
export const icon = key => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[key] || ICONS.overview}</svg>`;
