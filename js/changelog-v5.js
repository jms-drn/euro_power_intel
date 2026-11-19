// Version history shown in the "What's new" panel and the footers: the v5.0
// entry, then every earlier release from changelog.js. Newest first.
import { CHANGELOG as EARLIER } from "./changelog.js";

export const VERSION = "5.0";

const V5 = {
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
        "Spanish demand and generation are stored every 15 minutes from REE's 5-minute data, mainland only. Hydro is shown before pumping, with pumping as its own series; solar is PV plus solar thermal.",
        "Portuguese day-ahead prices and Spain–Portugal flows are added from the ENTSO-E Transparency Platform."
      ]
    }
  ]
};

export const CHANGELOG = [V5, ...EARLIER];
