// Version history shown in the "What's new" panel and the footers: the v5
// entries, then every earlier release from changelog.js. Newest first.
import { CHANGELOG as EARLIER } from "./changelog.js";

export const VERSION = "5.2";

const V52 = {
  version: "5.2",
  date: "Nov 2026",
  title: "Spain: a reserves map by basin, hydro by type, rainfall and river flows",
  sections: [
    {
      heading: "New: Spain → Hydro → Reserves map",
      items: [
        "Every river basin shaded by how its reservoirs compare with the average of the five (or ten) years before for the same week, in percentage points or per cent, or against last year, or by the week's change. Choose % full, hydroelectric energy (GWh) or water (hm³).",
        "Every reservoir over 5 hm³ as a dot, sized by capacity and shaded by how full it is; hover for its level and weekly change.",
        "Basins ranked from lowest to highest beside the map. Click a basin, on the map or in the list, for its year against last year and the five-year average and range, its largest reservoirs, the week's biggest reservoir moves and its river flows.",
        "River flows at MITECO's gauging stations against normal, by basin, and rainfall so far this year against earlier years, nationally and by area.",
        "The bell flags basins that are the fullest or emptiest for the time of year in at least five years, their largest weekly moves, and reservoirs that rise or fall sharply in a week."
      ]
    },
    {
      heading: "Changes",
      items: [
        "Hydro → This year (formerly Hydro year) now runs from January to December, with the average and range of the five years before by default and ten years as an option, in the same calm colours as the French nuclear charts.",
        "A Type selector on This year, Daily profile and Value splits hydro into reservoir, run-of-river and pumped storage (from ENTSO-E), alongside the total net of pumping.",
        "Pumping now runs from 2015 and uses ENTSO-E's complete pumped-storage figures, which fixes gaps in REE's separate pumped-storage series in early 2025."
      ]
    }
  ]
};

const V51 = {
  version: "5.1",
  date: "Nov 2026",
  title: "Spain: a Hydro page, with MITECO's reservoir levels since 1988",
  sections: [
    {
      heading: "New: Spain → Hydro",
      items: [
        "Hydroelectric energy and water in Spain's reservoirs from MITECO's weekly bulletin since 1988, against last year and earlier years, with hydro output and an estimate of weekly inflow.",
        "Daily profile: the average day of hydro output for any year and month against earlier years, a month-by-hour map of where this year differs, and the evening lift: how far hydro has moved out of the solar hours into the evening, year by year.",
        "Value: what hydro output earned and why it changed, split into the price level, the shape of prices through the day and when hydro ran; how much of hydro's output falls in each day's dearest hours; and an implied water value set against reservoir fill.",
        "Pumping: what pumped-storage plants paid to pump and earned generating, the spread between the two, how much pumping happens at zero or negative prices, and their average day.",
        "The bell flags Spanish hydro reserves that are the highest or lowest for the time of year in at least five years, and the largest weekly rises and falls."
      ]
    },
    {
      heading: "Changes",
      items: [
        "Spanish hydro is now REE's real-time figure, net of pumped-storage consumption, for every year, so comparisons with earlier years are like for like. The mix charts still draw hydro before pumping with pumping below zero.",
        "Capture Prices: the chart legend no longer shows simple averages of the monthly points, which differed from the output-weighted figures in the cards. The cards give the period's capture prices."
      ]
    }
  ]
};

const V50 = {
  version: "5.0",
  date: "Nov 2026",
  title: "European Power Intelligence: Spain, a market picker and a new home page",
  sections: [
    {
      heading: "A site for several markets",
      items: [
        "The site is now European Power Intelligence. It opens on a home page where you choose a market: France and Spain, with Germany coming soon.",
        "Switch market from the button at the top right; you stay on the same section and tab where the other market has it. The site name or “All markets” in the sidebar leads back to the home page.",
        "Every address now starts with its market (e.g. #fr/prices/explorer, #es/demand/today), so shared links open the right country.",
        "The bell shows the events of the market on screen, all of them by default, with the topic filters and muting as before.",
        "Display settings, the colour scheme, light or dark mode and pinned views apply to every market."
      ]
    },
    {
      heading: "New: Spain (REE and ENTSO-E, since 2015)",
      items: [
        "Overview: today's demand, prices against France and Portugal, renewable share, wind and solar and net exports, with a summary paragraph and the last 30 days of prices.",
        "Demand: Today (every 15 minutes against REE's forecast and the same weekday last year), Explorer (from 15 minutes to a year, against earlier years) and Forecast accuracy (MAE, MAPE, bias, by day and by hour).",
        "Generation: Today (the mix by technology every 15 minutes, with pumping below zero, and renewable shares against last year) and Explorer (any technology or group, output, share or energy, against earlier years).",
        "Flows: Today (net exports with France and Portugal against last year) and Explorer.",
        "Notable events for Spain in the bell: record or highest-for-a-while prices, demand peaks, wind and solar output, and negative prices."
      ]
    },
    {
      heading: "Spain: Prices",
      items: [
        "Seven tabs: Short term, Explorer, Spreads, Mix & Price, Negative Prices, Capture Prices and Residual Demand.",
        "Short term: today's and tomorrow's Spanish price every 15 minutes with France and Portugal, baseload against yesterday, the 7- and 30-day averages and the same weekday last year, peak and off-peak, lows and highs, negative hours, and the gap and same-price share with each neighbour.",
        "Explorer: Spain, France and Portugal and the Spain–France and Spain–Portugal spreads, with every comparison of the France explorer, plus how often the prices were equal or split.",
        "Spreads: Spain minus France and Portugal, and the share of time at the same price and split, by month and against last year.",
        "Mix & Price: the price above the mix, the average price by solar or wind share, output by technology, residual demand, net exports or hour, and every hour as a point coloured by year.",
        "Negative Prices: hours and depth below zero or any threshold year to date against last year and the three-year average, by month, by month and hour, and the spread of prices.",
        "Capture Prices: capture prices and rates for solar, wind, nuclear, hydro and gas, capture rate by month year by year, capture rate against output (cannibalisation), and output and price by hour of day.",
        "Residual Demand: demand minus wind and solar against last year and the average and range of earlier years, and the average price at each level."
      ]
    },
    {
      heading: "Data",
      items: [
        "Spanish demand and generation are stored every 15 minutes from REE's 5-minute data, mainland only. Solar is PV plus solar thermal.",
        "Portuguese day-ahead prices and Spain–Portugal flows are added from the ENTSO-E Transparency Platform."
      ]
    }
  ]
};

export const CHANGELOG = [V52, V51, V50, ...EARLIER];
