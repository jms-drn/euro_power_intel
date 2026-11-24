// Text of the "About the data" and "What's new" panels.
// Code note: no asterisks here (chat formatting strips them when pasted).
import { CHANGELOG } from "./changelog-v5.js";
import { CONFIG } from "./config.js";

const term = (t, d) => `<dt>${t}</dt><dd>${d}</dd>`;

export function whatsNewHtml() {
  return CHANGELOG.map(v => `
    <section class="release">
      <div class="release-head"><span class="release-tag">v${v.version}</span><span class="muted">${v.date}</span></div>
      <h3>${v.title}</h3>
      ${v.sections.map(sec => `<h4>${sec.heading}</h4><ul>${sec.items.map(i => `<li>${i}</li>`).join("")}</ul>`).join("")}
    </section>`).join("");
}

function spainHtml() {
  return `
    <h3>Spain</h3>
    <p>Spanish figures cover mainland Spain (the Peninsula); the Balearic and Canary Islands, Ceuta and Melilla are left out. Demand, REE's demand forecast and the generation mix come from REE, the Spanish transmission system operator, through its ESIOS platform: REE publishes them every 5 minutes and the site averages them to quarter-hours, from 1 Jan 2015. Day-ahead prices for Spain, France and Portugal, physical flows on the French and Portuguese borders and hydro generation by type come from the ENTSO-E Transparency Platform. Reservoir levels, basins, rainfall and river flows come from MITECO's weekly hydrological bulletin. Mainland Spain and France share the same clock, so times are Central European time.</p>
    <dl class="glossary">
      ${term("Demand", "REE's real-time mainland demand (Demanda real).")}
      ${term("REE forecast", "REE's demand forecast (Demanda prevista), revised through the day; the latest value for each quarter-hour is kept.")}
      ${term("Hydro", "REE's real-time hydro figure, which is net of pumped-storage consumption, for every year, so all years compare like with like. It can dip below zero when pumping exceeds hydro output; shares and capture prices count it only when positive.")}
      ${term("Hydro before pumping", "REE's net hydro figure plus pumping consumption, from 30 Dec 2024, when REE starts publishing pumping. The mix charts draw hydro this way, with pumping below zero.")}
      ${term("Solar", "Solar PV plus solar thermal, from 2 Jun 2015, when REE's split starts; REE's solar total before that.")}
      ${term("Renewable share", "Wind, solar, hydro and renewable thermal as a share of total generation (pumping excluded).")}
      ${term("Net exports", "On the price and mix pages, REE's real-time international exchange balance with its sign reversed, so positive means Spain exported. On the Flows pages, measured flows with France and Portugal from ENTSO-E.")}
      ${term("Same price / split", "The share of quarter-hours when the Spanish price was within €0.01/MWh of the French or Portuguese price (hourly prices before 30 Sep 2025 are repeated across their quarter-hours). Split is the rest of the time.")}
      ${term("Capture price", "The Spanish day-ahead price weighted by a technology's output each quarter-hour. Capture rate: capture price divided by the baseload price. Period figures are weighted by output, so they differ from a simple average of monthly capture prices.")}
      ${term("Residual demand", "Spanish demand minus wind and solar output.")}
      ${term("Hourly charts", "Mix & Price, Negative Prices (thresholds other than zero), Capture by hour, Residual Demand by level and the Hydro page use hourly averages.")}
    </dl>
    <h4>Hydro page</h4>
    <dl class="glossary">
      ${term("Reservoir levels", "MITECO's weekly hydrological bulletin, every mainland reservoir over 5 hm³, since January 1988, read from MITECO's public bulletin data each Tuesday to Thursday. Hydroelectric energy stored is MITECO's own calculation of the energy the stored water could produce, in GWh (shown as TWh nationally). Earlier years are read at the bulletin nearest the same date.")}
      ${term("Average and range", "The average, lowest and highest of the five years before (or ten, if chosen) for the same week of the year. Charts run from January to December.")}
      ${term("Hydro by type", "ENTSO-E's actual generation per production type for Spain: run-of-river, reservoir and pumped storage, and pumped-storage consumption (pumping), since 2015. Its total net of pumping matches REE's net hydro within about 2%. Spain reports pumped-storage output separately only from about 2021; before that it is included in reservoir. Total on the Type selector is REE's net hydro.")}
      ${term("Pumping and pumped storage", "Pumping is the electricity pumped-storage plants use to lift water uphill, usually when power is cheap; pumped storage (output) is the electricity they generate releasing it. The Pumping tab uses ENTSO-E's figures; REE's separate pumped-storage output series misses part of the output, notably before 23 Jan 2025.")}
      ${term("Estimated inflow", "The site's own estimate: REE's net hydro output between two bulletins plus the change in hydroelectric energy stored. It ignores spills, evaporation and releases that do not generate.")}
      ${term("Evening lift", "Average output from 19:00 to 23:00 minus the average from 11:00 to 17:00: how far hydro has moved out of the solar hours.")}
      ${term("Why the capture price changed", "The change against the same months last year, split into three parts that add up: the price level (change in baseload), the price shape (last year's output, matched by weekday 364 days earlier, priced at this year's prices, against baseload) and when the plants ran (this year's output against last year's, both at this year's prices).")}
      ${term("Top-quarter share", "The share of output in each day's six dearest hours (a quarter of the day). 25% would mean output ignored prices.")}
      ${term("Implied water value", "The site's own estimate, not a published figure: the median Spanish price in the hours of each month when output was in its top quarter.")}
      ${term("Pumping spread", "The average price earned generating minus the average price paid pumping, each weighted by energy, before round-trip losses of roughly a quarter.")}
    </dl>
    <h4>Hydro Overview</h4>
    <dl class="glossary">
      ${term("Basins", "MITECO's 16 mainland hydrographic areas (ámbitos), with outlines from MITECO's bulletin map. Each basin's figures add up its reservoirs over 5 hm³; Spain is the sum of all basins.")}
      ${term("Measures", "Water % full (water stored against capacity), hydroelectric energy % full (energy stored against the most the hydroelectric reservoirs can hold), energy in GWh and water in hm³.")}
      ${term("Shading", "Compare with the 5- or 10-year average for the same week, last year or last week, shown as a difference (percentage points for the % full measures, GWh or hm³ otherwise), a % difference, or the level itself. Red is below, blue above, grey close. Each side of the scale is scaled separately and capped at its second-largest value, so a single extreme basin cannot wash out the rest; ≤ or ≥ on the legend marks a capped end.")}
      ${term("Cards", "Hydroelectric reserves against the 5- and 10-year averages; REE's net hydro output over the past 7 days, the month to date and the year to date against the same days in the 5 and 10 years before; and estimated inflow for the latest week against its norm.")}
      ${term("Date slider", "Any weekly bulletin since January 1988. The cards, summary, map, basin list and the charts below follow it. Individual reservoirs (dots, tables, biggest moves) are only available for the latest bulletin. Hydro output starts in 2015, river flows in 2001 and rainfall in 1995.")}
      ${term("12-week lines", "The chosen measure over the last 12 weekly bulletins up to the date shown; blue if it rose over the period, red if it fell.")}
      ${term("Biggest moves", "Reservoirs of 20 hm³ or more with the largest change in water stored since the previous bulletin.")}
      ${term("River flows", "Weekly flow at about 120 of MITECO's gauging stations since 2001, in m³/s, against the same week in the years before. Many stations are below dams, so flows reflect reservoir releases as well as rain.")}
      ${term("Rainfall", "Weekly rainfall at MITECO's rain gauges (AEMET stations) since 1995, averaged across gauges: so far this year (added up from 1 January) or week by week against the seasonal norm, the average of the same week in the years before.")}
    </dl>`;
}

function franceHtml() {
  return `
    <h3>France</h3>
    <p>Figures come from RTE, the French transmission system operator, through its public APIs (consumption, actual generation and unavailability notices), and from the ENTSO-E Transparency Platform (day-ahead prices and cross-border flows). They cover mainland France. Times are Paris time.</p>
    <h3>Demand</h3>
    <p>Demand includes grid losses and excludes pumping at hydropower plants. It is average power over each interval, in MW or GW.</p>
    <h4>Forecasts</h4>
    <dl class="glossary">
      ${term("Actual", "Measured demand (RTE calls it \"realised\"), every 15 minutes.")}
      ${term("Intraday", "RTE's forecast for today, revised through the day.")}
      ${term("D-1", "Day-ahead forecast, made the day before (published around 19:30 Paris time).")}
      ${term("D-2", "Forecast made two days before (published around 07:00).")}
      ${term("Week-ahead", "Forecasts for 3 to 9 days ahead, published on weekdays, with the expected daily peak and RTE's temperature assumption.")}
      ${term("Annual forecast", "RTE's forecast for each week of the next year: a demand range and the expected supply margin.")}
      ${term("Lead time", "How far ahead a forecast was made.")}
    </dl>
    <h4>Accuracy measures</h4>
    <dl class="glossary">
      ${term("Error", "Forecast minus actual. Positive means RTE expected more demand than happened. Forecasts are compared every half-hour.")}
      ${term("MAE", "Mean absolute error: the average size of the miss in GW, ignoring direction.")}
      ${term("MAPE", "Mean absolute percentage error: the same, as a share of demand. Best for comparing seasons.")}
      ${term("Bias", "Average error keeping its sign: shows whether RTE tends to over- or under-forecast.")}
      ${term("Peak error", "Forecast daily maximum minus actual daily maximum.")}
    </dl>
    <h4>Comparisons</h4>
    <dl class="glossary">
      ${term("Calendar date", "Compares the same dates in earlier years (1–29 Oct with 1–29 Oct).")}
      ${term("Weekday", "Compares each day with the same weekday 52 weeks (364 days) earlier, so weekends line up.")}
      ${term("Like-for-like", "Percentage comparisons only use the days and times available this year, so a month to date is compared with the same days.")}
      ${term("Min–max range", "The band between the lowest and highest earlier year at each point.")}
      ${term("Daily profile", "The average shape of a day across the selected period, e.g. the typical October day.")}
      ${term("Forecast ahead", "In the Explorer, periods can run past today: after the last actual value the line continues with RTE's best available forecast.")}
    </dl>
    <h4>Data notes</h4>
    <ul>
      <li>History runs from 17 Dec 2012. The data updates automatically during the day.</li>
      <li>RTE time-stamps historical D-1 forecasts after the day they cover, so values before 26 Oct 2026 can't be confirmed as the versions published the day before. From that date the site records the version published in advance.</li>
      <li>RTE's D-1 data for 2–14 Oct 2019 contains corrupt values (around 0.7 GW) and is excluded.</li>
      <li>Clock-change days have 23 or 25 hours; daily figures account for this.</li>
    </ul>
    <h3 style="margin-top:22px">Nuclear availability</h3>
    <p>EDF publishes a notice for every planned or unplanned reduction in a reactor's available capacity, and a new version whenever it changes. The site stores every version since December 2010.</p>
    <dl class="glossary">
      ${term("Available capacity", "Installed capacity minus the unavailable capacity in the notices covering that moment. Where notices overlap on one reactor, the largest reduction counts (they are not added up).")}
      ${term("Planned / unplanned", "As declared by EDF: planned outages (refuelling, maintenance, ten-yearly inspections) are announced in advance; unplanned ones (failures, other incidents) are not. Modulation to follow demand is not an outage.")}
      ${term("Offline / partially available", "Offline means the notices leave less than 10% of the reactor's capacity available; partially available means between 10% and 90%.")}
      ${term("Modulating", "Online, but producing less than 80% of its available capacity in the latest hour, usually to follow demand or prices.")}
      ${term("Output", "Measured nuclear generation from RTE's actual generation data, hourly (fleet since 15 Dec 2014; per reactor for the past week).")}
      ${term("Load factor", "Output divided by installed capacity.")}
      ${term("Outlook as of a date", "The availability (and unavailability, split into planned and unplanned) implied by the latest version of each notice published by the end of that day (Paris time), for each of the next 540 days. Comparing outlooks from different dates shows how expectations moved.")}
      ${term("First announced end", "The end date in the first version of a notice. The change against it shows extensions and early returns.")}
    </dl>
    <ul>
      <li>Fessenheim 1 and 2 leave the fleet when they closed (22 Feb and 30 Jun 2020); Flamanville 3 joins at its first grid connection (21 Dec 2024). EDF filed Fessenheim's closure as an outage to 2099 and later cancelled it, so closures come from the site's own reactor list.</li>
      <li>Notices before 2015, when the EU's REMIT transparency rules took full effect, may be less complete.</li>
      <li>Outlooks only contain outages already announced, so they are usually above what happens.</li>
    </ul>
    <h3 style="margin-top:22px">Hydro reservoirs</h3>
    <p>RTE's weekly figure for the energy stored in the hydro reservoirs it monitors, in MWh (shown as TWh), since December 2014. Fill level is that figure as a share of the reservoirs' total capacity of 3,591 GWh (RTE); differences in fill level are in percentage points (pp). Weeks are compared by ISO week number.</p>
    <h3 style="margin-top:22px">Prices</h3>
    <p>Day-ahead auction prices from the ENTSO-E Transparency Platform, in €/MWh, for France, Germany (DE-LU; DE-AT-LU before 1 Oct 2018), Belgium, Switzerland, Italy North, Spain and Portugal, from 5 Jan 2015. The European day-ahead market moved from hourly to 15-minute prices for delivery from 30 Sep 2025; Switzerland stays hourly.</p>
    <dl class="glossary">
      ${term("Baseload", "Average of every period in the day, each weighted by its length.")}
      ${term("Peak / off-peak", "Peak is Monday–Friday 08:00–20:00 local time (the market standard); off-peak is every other period.")}
      ${term("Spread", "The home market minus the neighbour: positive means the home market was dearer.")}
      ${term("Parity", "Share of periods when the two prices differ by less than €0.01/MWh, usually because the interconnector between them was not congested.")}
      ${term("Negative-price hours", "Time with a price below zero (a 15-minute period counts as 0.25 hours). Zero-priced periods can be included with a switch.")}
      ${term("Negative-price depth", "How far below zero (or below the chosen threshold) each period was, times its length, added up, in €/MWh·h. It weighs depth and duration together.")}
      ${term("Volatility", "Standard deviation of the prices within each day.")}
      ${term("Capture price", "Average price weighted by a technology's output: what a megawatt-hour of solar, wind or nuclear sold for on average. Capture rate: capture price divided by baseload.")}
      ${term("Residual demand", "Demand minus wind and solar output: what the rest of the fleet and imports have to cover.")}
      ${term("Modulating reactor (Nuclear Modulation)", "In an hour when the reactor is running (output and availability both at least 10% of its capacity), output below the chosen share (70, 80, 90 or 95%) of its available capacity. Per-reactor output comes from RTE's actual generation per unit, hourly since Dec 2014.")}
      ${term("Unused available nuclear capacity", "Available capacity in the outage notices minus measured nuclear output, never below zero. It includes modulation to follow prices and demand, but also frequency reserves, end-of-cycle coast-downs, ramp limits and undeclared outages.")}
      ${term("Duration curve", "Every period sorted from highest to lowest, so you can read the share of time a level was reached.")}
    </dl>
    <h3 style="margin-top:22px">Generation</h3>
    <p>RTE's actual generation by fuel: hourly in 2015–16, every 15 minutes from 2017. Hydro includes run-of-river, reservoirs and pumped-storage generation; pumping is not counted. Low-carbon: nuclear, hydro, wind, solar and bioenergy. Renewable: hydro, wind, solar and bioenergy.</p>
    <h3 style="margin-top:22px">Flows</h3>
    <p>Physical (measured) flows on each French border from the ENTSO-E Transparency Platform, latest available: Belgium, Germany, Switzerland, Italy (North), Spain and Great Britain. Net exports are exports minus imports. Physical flows include loop flows and can differ from the commercial exchanges agreed in the markets.</p>`;
}

const SHARED = `
    <h3 style="margin-top:22px">Notable events (the bell)</h3>
    <p>The bell shows the events of the market on screen, with filters by topic: records, the highest or lowest value for a while (at least a week for prices, a month for demand, generation and flows), negative prices, for France new unplanned nuclear outages of 1 GW or more and return dates pushed back a week or more, and for Spain hydro reserves and basins that are the fullest or emptiest for the time of year in at least five years, unusually large weekly moves, and reservoirs of 100 hm³ or more that move 10 points or more in a week. Events from the past four days are listed.</p>
    <h3 style="margin-top:22px">Using the site</h3>
    <dl class="glossary">
      ${term("Quick search", "Ctrl+K (Cmd+K on a Mac), the / key or Search in the header: type part of a page, tab or Spanish basin name, then Enter.")}
      ${term("Keyboard", "1 to 9 switch tabs. ← and → step the date slider on the Spain Hydro Overview.")}
      ${term("Copy link", "In the page bar: copies an address that opens exactly the view on screen, with its settings. The address bar always holds the same link.")}
      ${term("Folding panels", "The − button on a panel folds it away and + brings it back; the site remembers your choice in this browser.")}
      ${term("Updated dots", "A dot beside Prices or Hydro in the Spain sidebar means new day-ahead prices or a new reservoir bulletin since you last opened that page.")}
      ${term("Motion", "Pages fade in and charts ease into place. If your computer or phone is set to reduce motion, the site does too.")}
    </dl>`;

export function aboutHtml(market) {
  const foot = `<p class="muted">Map outlines: Natural Earth (public domain) and MITECO (Spanish basins). Methodology, data files and code: <a href="${CONFIG.repoUrl}" target="_blank" rel="noopener">GitHub repository</a>.</p>`;
  return (market === "es" ? spainHtml() + franceHtml() : franceHtml() + spainHtml()) + SHARED + foot;
}
