# European Power Intel: project handover

Briefing for any assistant session (Copilot, Claude or other) working on this project. It replaces CLAUDE.md as the main briefing and carries over everything still true from it. Read it in full before changing anything, and update it whenever something here changes.

Last updated: 24 Nov 2026 (site version 5.2, with Hydro Overview fixes since).

Notation: "TO CONFIRM" marks anything that could not be verified from the project record. Check it against the live repo before relying on it.


## 0. Quick start for a new session

1. James pastes this file (GitHub, open the file, Raw, copy all) plus the current version of any file to be changed.
2. Read section 1 (how James works) and section 9 (code rules) first. They are the ones most often broken.
3. Never edit from memory. Ask for the current file if you do not have it in the chat.
4. Deliver complete replacement files, inline, with the line count, in small batches (section 1).

Live site: jms-drn.github.io/euro_power_intel/
Repo: github.com/jms-drn/euro_power_intel (renamed in Nov 2026 from fr_power_intel, which was renamed on 29 Oct 2026 from fr_demand_tooling).
Refresh service: fr-demand-refresh.james-doran.workers.dev (Cloudflare Worker; its name was kept).


## 1. The owner and how to work with him

Who he is
- James Doran (byline jms-drn), reporter at Argus Media covering the Spanish power market, Iberia and French and wider European energy markets.
- He uses the site for his own analysis and market commentary and shares the live page with colleagues. His team cares more about nuclear unavailability than availability.
- He works in a work Copilot account. API registrations are work-approved. The public site uses open data only. No internal or paid Argus data may go on it.

What he needs from replies
- Not a technical developer. Plain language and no jargon about internal tooling. Say what he will see and exactly what to click, step by step (which GitHub page, which Actions workflow, which box to type in).
- Discuss first, then build. The established rhythm: James sends a numbered list, the assistant replies point by point with views, questions and extra ideas, James answers, then the assistant builds. Ask rather than assume when a choice is his.
- He welcomes analytical, outside-the-box suggestions, but keep them decisive and short.
- Precision above all. Never invent identifiers, endpoints, field names, URLs, figures or quotes. Check figures with an independent recomputation. Verify against primary sources (RTE, REE/ESIOS, ENTSO-E, MITECO docs). If uncertain, say so. When probing an unknown API, write a read-only probe first and build only on its report.
- On mistakes: say sorry briefly and fix it. No "you're right to flag that" patter.
- Writing style, on the site and in replies: British spelling, plain and direct, short sentences, numbers with units (GW, TWh, pp, hm³, €/MWh), sentence case. Headline sentences on each page are copied straight into articles, so they must read as clean prose.

Delivering code (hard rules, learnt the hard way)
- James cannot open downloadable script files. Always give complete replacement files inline in code blocks. Never attachments, never "edit lines 40-60", never partial snippets to paste into an existing file.
- Give the line count for each file, so he can check the paste is complete.
- Split work into small batches. Very long replies have failed and been lost. A batch of about 4 to 6 files is safe; label batches (for example 2a, 2b, 2c) and say what each one changes on screen.
- Say whether each file is new or replaces an existing one, and the folder it goes in.
- After each batch list what to check on the site, and what to send back if something looks wrong (screenshot plus the red line from the browser Console, F12).
- He commits by pasting into the GitHub web editor himself. The assistant does not commit.
- Start each session by asking him to paste the current file from GitHub Raw.

UI preferences
- Clean, minimal, professional; "Grafana-like" dark dashboard with an equally polished light mode.
- Calm colours. He found bright or saturated palettes "gaudy" and "garish". Chart comparisons use the site variables: this year --s-actual (accent), last year --s-ly, average --s-avg (dashed), range --s-band (soft band).
- Home page: site title, byline, market cards, simple footer, no sidebar or top bar, subtle hover and transition effects.
- Controls must be unobtrusive: dropdowns, chips, segmented buttons, iPhone-style switches for two-way choices. Make it obvious how to toggle things.
- Cards: label, big value, one short detail line. Too many cards or too much text is "busy"; prefer fewer, cleaner cards.
- Side lists beside maps must be narrow and compact (one line per row, unit in the column header, not in each cell).
- Trend lines and other small graphics must be labelled (what they show and over what period).
- Calendar year (Jan to Dec) for charts by default; he does not normally think in hydro years.
- Default comparison: the 5-year average, with 10 years as an option; ranges cover the same years as the average.


## 2. What the site is

A static web tool on European power-system data, each dataset compared with earlier years. Title "European Power Intel" (byline "by jms-drn"). It opens on a home page with market cards: France (live), Spain (live), Germany (coming soon).

Addresses start with the market: #home, #fr/page/tab?settings, #es/page/tab?settings. Every view writes its settings into the address so links can be shared. Old links without a market (from the France-only site) open the France pages.

Switching market keeps the same section and tab where the other market has it. Display settings, theme, palettes and pins apply to every market. The bell shows only the market on screen.

### France pages (unchanged in v5; see the v4 feature notes in section 11)

| Page | Tabs |
|---|---|
| Overview | single page (tiles, Main points) |
| Demand | Today · Explorer · Forecast accuracy · Outlook |
| Nuclear availability | Today · Explorer · Outages · Outlook |
| Hydro reserves | single page |
| Prices | Short term · Explorer · Spreads · Mix & Price · Negative Prices · Capture Prices · Residual Demand · Nuclear Modulation |
| Generation | Today · Explorer · Records |
| Flows | Live map · Explorer · Flows and prices |

### Spain pages (v5.0 to v5.2)

| Page | Tabs | Main sources |
|---|---|---|
| Overview | single page | REE, ENTSO-E |
| Demand | Today · Explorer · Forecast accuracy | REE (ESIOS) |
| Prices | Short term · Explorer · Spreads · Mix & Price · Negative Prices · Capture Prices · Residual Demand | ENTSO-E, REE |
| Generation | Today · Explorer | REE (ESIOS) |
| Hydro | Overview · This year · Daily profile · Value · Pumping | MITECO, REE, ENTSO-E |
| Flows | Today · Explorer | ENTSO-E |

Spain features in brief
- Overview: today's demand, prices against France and Portugal, renewable share, wind and solar, net exports, summary paragraph, last 30 days of prices.
- Demand: Today against REE's forecast and the same weekday last year; Explorer from 15 minutes to a year; Forecast accuracy (MAE, MAPE, bias, by day and hour).
- Generation: Today (stacked mix every 15 minutes, hydro drawn before pumping with pumping below zero, renewable shares); Explorer (any technology or group; hydro before pumping and pumping as extra subjects from Dec 2024).
- Prices: seven tabs mirroring France (minus Nuclear Modulation). Capture Prices uses output-weighted period figures in the cards; the chart legend no longer shows simple averages (they disagreed with the cards).
- Hydro: see section 6, the newest and most detailed part.
- Flows: net exports with France and Portugal; physical flows from ENTSO-E.
- Bell: Spanish baseload highs and lows, demand peaks, wind and solar records, negative prices, hydro reserves and basin events (section 6).


## 3. Architecture

Static site, no build step, on GitHub Pages. Python data pipeline in GitHub Actions. A Cloudflare Worker as scheduler and live-refresh service. Charts use ECharts 5.6 (js/vendor/echarts.min.js).

Data flow
- The Worker's cron trigger fires every 15 minutes and starts the GitHub workflow "Update RTE data" (update-rte.yml) unless one is queued or running. The Refresh button posts to /refresh: live RTE short-term consumption straight back to the browser, and a workflow run at most every 5 minutes. GET /latest returns live data only.
- GitHub's own schedule (hourly) is only a backup; GitHub skips many scheduled runs.
- update-rte.yml runs update.py (France: demand, then power_update, then market_update, then summarise) and then es_update.py (Spain).
- All data-writing workflows share the concurrency group rte-data, so they never clash. On a push rejection they reset to the latest main and redo the work.
- The site reads static files from data/. data/status.json's generated_utc is the data version used for cache-busting.

### Front end (js/, file names with dashes)

Site shell and shared
- index.html, style.css: shell (sidebar, header, tabs, drawers). index.html also holds the share-preview addresses for euro_power_intel.
- js/main.js: routing and page loading (market-aware since v5).
- js/site-pages.js: the page and tab registry. SITE = { fr: FR_PAGES, es: ES_PAGES }, cfgOf(market, page), HOME_PAGE, sidebar icons. Add tabs here.
- js/markets.js: list of markets (codes, names, flags, status).
- js/home.js: the home page with market cards.
- js/site-bell.js: notification bell (both markets; topic filters; mute; seen ids in localStorage).
- js/site-about.js: About the data and What's new panel text. aboutHtml(market) puts the market on screen first.
- js/site-panels.js: drawer and panel helpers (TO CONFIRM exact contents).
- js/changelog-v5.js: VERSION and v5 entries; imports earlier entries from js/changelog.js.
- js/config.js: workerUrl, siteUrl, githubProfile, repoUrl, updateEveryMinutes.
- js/util.js, js/util-time.js, js/util-web.js: Paris-time helpers, formatting, hash, CSV, DOM helpers.
- js/data.js: cached() and fetchText(), data version.
- js/chart.js: ChartPanel (ECharts wrapper: tooltips, zoom, legend averages, table, CSV, PNG, copy image; custom charts through spec.custom with option, table, onReady).
- js/settings.js: palettes, theme, thickness, markers.
- js/time-explorer.js: shared explorer engine (presets, comparisons, profile, duration curve, ranking).
- js/market-common.js: card() markup, period picker. js/market-data.js: France market loaders, getPrices, getFlows, getAlerts, fmtByUnit.
- France page files: today, explorer, accuracy, outlook, nuclear-common, nuclear-today, nuclear-explorer, nuclear-outages, nuclear-outlook, hydro, overview, prices-short, prices-explorer, prices-analysis, generation, flows, events, flags, xlsx.

Spain
- js/es-pages.js: re-exports every Spain tab class; site-pages.js loads Spain tabs from here.
- js/es-data.js: Spain loaders (mix, demand, prices, hourly, reservoirs, hydro monthly/profile, flows, alerts), FUELS, fuelValue, hydroGross, pumpValue, freshness line.
- js/es-common.js: Base class for tabs (state, wire, sync, update, render), cards, headlineBlock, selectHtml, heatSpec, scatterSpec, meanOf, mul, pct, signed, GW, EUR, MONTHS.
- js/es-overview.js: Overview, Demand tabs. js/es-power.js: Generation and Flows tabs. js/es-prices.js: Short term, Explorer, Spreads. js/es-analysis.js: Mix & Price, Negative Prices. js/es-capture.js: Capture Prices, Residual Demand.
- Hydro:
  - js/es-hydro.js: This year tab (EsHydroYear) plus shared helpers SOURCE, AVG_OPTIONS, shiftDate, near, yearsBack, fillYears, avgMw.
  - js/es-hydro-data.js: hydro-by-type loaders (monthly_types.csv, profile_types.csv), TYPES, TYPE_OPTIONS, TYPE_NOTE.
  - js/es-hydro-profile.js: Daily profile. js/es-hydro-value.js: Value and Pumping.
  - js/es-hydro-map-data.js: Overview data and maths (MEASURES, COMPARE, AGAINST, showOptions, getBasins, loadBasinMap, basinView, scaleFor, genStats, inflowSeries, useLabel, loadCsv, keyOf).
  - js/es-hydro-map.js: Overview tab core (EsHydroMap): cards, copy summary, map, slider, compact basin list with 12-week lines, basin year chart, largest reservoirs.
  - js/es-hydro-extras.js: EsHydroMapFull extends EsHydroMap: biggest moves, river flows, rainfall. This is the class registered as the Hydro Overview tab.
  - es-hydro-basins.js and es-hydro-map-detail.js were drafted in a superseded batch; if they exist in the repo they are unused (TO CONFIRM; safe to delete).

### Pipeline (scripts/, file names with underscores)

France: rte_client.py, store.py, summarise.py, update.py, backfill.py, power_store.py, power_summarise.py, power_update.py, power_backfill.py, unit_backfill.py, market_store.py, market_summarise.py, market_update.py, market_backfill.py.

Spain
- es_store.py: ESIOS client and storage; summaries; coverage; local_midnight; load_state and save_state.
- es_update.py: the regular Spain update (section 4).
- es_backfill.py: one-off Spain history download (workflow backfill-es.yml; a "datasets" box; type none to rebuild summaries only).
- es_summarise.py: rebuilds every Spain summary from stored data.
- es_prices.py: Spain price summaries.
- es_market.py: hourly files and daily market summaries (capture, residual, parity).
- es_hydro.py: monthly hydro sums and profiles from REE (the older, total-only summaries; still built).
- es_hydro_types.py: monthly sums and hourly profiles by hydro type.
- es_hydro_split.py: ENTSO-E hydro by type download.
- es_reservoirs.py: national reservoir levels from MITECO.
- es_basins.py: basins, rainfall, river flows and map files from MITECO.
- es_alerts.py and es_alerts_hydro.py: Spain bell events.
- es_hydro_rebuild.py: rebuilds the hydro summaries and alerts (used by the hydro backfill).
- Probes (read-only, kept for reference): hydro_probe.py, hydro_split_probe.py, map_probe.py; Spain probe from v5 groundwork.

### Workflows (.github/workflows/)

| Workflow | What it does | When |
|---|---|---|
| update-rte.yml | France update.py then es_update.py | Every 15 min via the Worker; hourly GitHub backup |
| reservoirs-es.yml | es_reservoirs.py then es_basins.py | Tue to Thu at 08:20, 14:20 and 20:20 UTC; by hand with a first year for history |
| backfill-es.yml | Spain history; "none" to rebuild only | By hand |
| backfill-hydro-es.yml | ENTSO-E hydro split since 2015 and MITECO basins since 1988, then rebuild | By hand; parts = all, split or basins |
| backfill-market.yml, backfill-units.yml | France history | By hand |
| probe-hydro.yml, probe-hydro-split.yml, probe-map.yml, probe-spain.yml | Read-only probes writing to probe/out/ | By hand |

### Secrets and keys
- GitHub Actions: RTE_CLIENT_ID and RTE_CLIENT_SECRET (consumption), RTE_GENERATION_CLIENT_ID and SECRET, RTE_UNAVAILABILITY_CLIENT_ID and SECRET, ENTSOE_API_KEY, ESIOS_API_KEY.
- Cloudflare Worker: RTE_CLIENT_ID, RTE_CLIENT_SECRET, GITHUB_TOKEN (fine-grained, Actions read and write, this repo only). Optional variable ALLOWED_ORIGINS (default https://jms-drn.github.io).
- Worker constants: REPO = "jms-drn/euro_power_intel", WORKFLOW = "update-rte.yml". The Worker source is saved in the repo as worker/worker.js; after any change, paste it into Cloudflare and click Deploy.
- Never commit keys. GitHub Pages is public.


## 4. Spain data pipeline

Sources
- REE via ESIOS (x-api-key header, ESIOS_API_KEY): demand (actual and forecast), generation mix and real-time international exchanges, published every 5 minutes, averaged to 15 minutes, mainland Spain only, from 1 Jan 2015.
- ENTSO-E (ENTSOE_API_KEY): day-ahead prices for ES, FR and PT; Spain-Portugal physical flows; actual generation per production type for hydro (document A75, process A16, bidding zone 10YES-REE------0).
- MITECO: the public ArcGIS feature services behind the weekly Boletín Hidrológico dashboard (owner BolHidro_miteco), no key.

es_update.py schedule (inside every update-rte run)
- ESIOS demand, mix, exchanges: yesterday 00:00 to two days ahead every run; the past 7 days once every 6 hours for REE corrections.
- Portugal prices: at most every 55 minutes, but every run 12:00 to 15:00 local while the auction publishes.
- Spain-Portugal flows: at most every 55 minutes.
- Hydro by type (ENTSO-E): last 4 days, at most every 55 minutes (state key hydro_split). The log line "Spain hydro by type: N hours changed" appears only in runs where it is due.
- Then rebuilds: summaries, price summaries, market summaries (this year), hydro summaries, hydro type summaries, alerts.
- Never stops the workflow: errors are printed and the run carries on so France data is always saved.

Data files (times UTC as YYYY-MM-DDTHH:MMZ; months split by local month)
- data/es/demand/, data/es/mix/, data/es/exchanges/ (YYYY/YYYY-MM.csv), data/es/flows/PT/, Portugal prices under data/prices/PT/.
- data/es/daily/: demand, mix, prices, market, flows summaries.
- data/es/hourly/YYYY.csv: per hour: es, fr, pt prices and negative or zero hours; demand, residual; nuclear, wind, solar, hydro (REE net), hydro_gross, ccgt, coal, chp, ren_th, pump (negative), turb, net_exp.
- data/es/hydro/monthly.csv and profile.csv (es_hydro.py, REE total only).
- data/es/hydro/monthly_types.csv and profile_types.csv (es_hydro_types.py; types total, gen, res, ror, ps, pump). Monthly columns: hours, psum, pn, mwh, q, qp, qneg, cfq, cfqp, topq, allq, corr_sum, corr_n, wv.
- data/es/hydro_split/YYYY/YYYY-MM.csv: hourly ror, res, ps, pump (MW) from ENTSO-E.
- data/es/reservoirs.csv: weekly national totals since 5 Jan 1988 (water_hm3, cap_hm3, hydro_water_hm3, hydro_cap_hm3, energy, energy_cap in GWh, reservoir counts).
- data/es/basins.csv: weekly per basin since 1988 (basin name, key, water and capacity, hydro water and capacity, energy and energy capacity, reservoirs).
- data/es/rain.csv: weekly rainfall per gauge since 1995 (date, station_id, station, zone, mm).
- data/es/river_flows.csv: weekly flow per gauging station since 2001 (date, station_id, station, river, basin, flow in m³/s).
- data/es/map/: basins.json (16 basin outlines, simplified GeoJSON, properties key and name), reservoirs.json (latest bulletin: 375 reservoirs with location, basin, capacity, water, energy, weekly change, use, hydro flag), rain_stations.json, flow_stations.json.
- data/es/alerts.json.

Key data rules (do not change without discussing)
- Hydro is REE's real-time net figure (output minus pumping) for every year, so years compare like with like. Shares and capture prices count it only when positive.
- Hydro before pumping (hydro_gross) and pumping exist only from 30 Dec 2024. Mix charts draw hydro before pumping with pumping below zero; cards and comparisons use net hydro.
- REE's separate pumped-storage output series (pump_gen) starts only on 23 Jan 2025 17:30 UTC (zeros before) and misses part of the output even after. Do not use it for analysis. The Pumping tab uses ENTSO-E.
- ENTSO-E hydro by type: run-of-river (B11), reservoir (B12), pumped storage output (B10) and pumping (B10 consumption). Net total matched REE within about 2% on six test days (2015 to 2026). Pumping matched REE within about 0 to 6%. Pumped-storage output is reported separately only from about 2021; before that it is inside reservoir. ENTSO-E pumped storage closes REE's own balance gap (checked on 10 Jan 2025, 10 Nov 2026, 20 Nov 2026).
- REE monthly balance check (GWh, turbinación bombeo / consumo bombeo): Jan 2025 420.4 / 753.6; Feb 369.2 / 511.3; Mar 426.8 / 779.8. Pumping in the site's data was within 3% for the quarter.
- MITECO dates are stored as Spanish midnight (late the previous evening in UTC); scripts shift by 12 hours before taking the date. Bulletins refer to Tuesdays.
- Basins are matched across MITECO tables by a key: name lower-cased with accents, spaces and punctuation removed (for example "Miño - Sil" and "Miño-Sil" both give minosil). The backfill confirmed all 16 basins match their outlines.
- MITECO checks against the 17 Nov 2026 bulletin: 31,950 of 56,049 hm³ (57.0%), 375 reservoirs; hydroelectric energy 9.87 of 23.01 TWh (42.9%), confirmed by James. 2,029 weekly bulletins from 5 Jan 1988.
- ArcGIS queries use outStatistics grouped by date (and basin) so the server adds rows up; paging uses resultOffset and exceededTransferLimit.
- The rain-gauge map layer names its id field PLUVIOMETRO_ID, while the history table uses pluviometro_id (from the map probe). Check that rain_stations.json has ids (TO CONFIRM).


## 5. Spain hydro analysis definitions (as built)

- Capture price: output-weighted Spanish price. Capture rate: capture price divided by baseload.
- Why the capture price changed (Value tab): against the same months last year, split into price level (change in baseload), price shape (last year's output, matched by weekday 364 days earlier, priced at this year's prices, against baseload) and when the plants ran (this year's output against last year's, both on this year's prices). The three parts add up.
- Top-quarter share: share of output in each day's six dearest hours. 25% means output ignored prices.
- Output-price correlation: average within-day correlation.
- Implied water value: median Spanish price in the month's hours when output was in its top quarter. The site's own estimate, labelled as such; it moves with the price level.
- Evening lift: average output 19:00 to 23:00 minus 11:00 to 17:00.
- Estimated inflow: REE net hydro output between two bulletins plus the change in MITECO's hydroelectric energy stored (GWh). Ignores spills, evaporation and non-generating releases. From 2015.
- Pumping spread: energy-weighted generating price minus pumping price, before round-trip losses (about a quarter).
- Averages and ranges: the previous 5 (default) or 10 years, read at the bulletin nearest the same date (within 4 days); 29 Feb maps to 28 Feb.


## 6. Spain Hydro page as built (v5.2 plus fixes)

Tab order (Overview first, James's request): Overview · This year · Daily profile · Value · Pumping.

Overview (es-hydro-map.js, es-hydro-map-data.js, es-hydro-extras.js)
- Copy-ready summary (two sentences): reservoirs % full and hydroelectric reserves % and TWh against the 5-year average; last week's hydro output against the 5-year norm and the year-to-date total.
- Five cards: Hydroelectric reserves (% full; pp vs 5-yr and 10-yr) · Hydro output past 7 days · month to date · year to date (TWh) (each % vs 5-yr and 10-yr norms) · Inflow latest week (% of norm). The "basins below average" card was removed at James's request.
- Map controls: Measure (Water % full · Hydro energy % full · Energy GWh · Volume hm³); Compare with (5-year average default · 10-year · last year · last week); Show as (points, or GWh/hm³ difference · % difference · level); Reservoirs (hydroelectric · all · hide).
- Colour scale: muted red below, grey near zero, muted blue above; each side scaled separately and capped at its second-largest value, so one outlier (for example Guadiana +450% on a tiny energy base) cannot wash out the rest; legend shows "≤" or "≥" when capped. Level uses a single blue scale.
- Map: basins registered under their proper names (the earlier lower-case key tooltip bug is fixed); hover shows the value and gaps to the 5-yr, 10-yr, last year and last week; reservoir dots sized by capacity and shaded by % full (latest bulletin only); click a basin to select it, click again for all of Spain.
- Date slider: any bulletin since January 1988 with −1y, back, forward and Latest buttons; cards, summary, map, list, detail chart, flows and rainfall follow it.
- Basin list: compact 320 px column (drops below the map under about 980 px); header Basin · Now (unit) · vs 5-yr (unit) · 12 wks; one line per basin; Spain in bold at top; long names shortened (full name on hover); 12-week line per basin (blue rising, red falling, dot on the latest week, hover shows start and end), explained in a footnote. The earlier "+." and "−." bug came from reusing France's reactor-row layout and is fixed.
- Below the map: the selected basin's (or Spain's) year with 5/10-year average and range; largest reservoirs with uses in English (Water supply and irrigation, Hydropower, Mixed use); the week's biggest moves (reservoirs of 20 hm³ or more); river flows against normal by basin (bars) and a station table; rainfall, switchable between so far this year (cumulative) and week by week against the seasonal norm, plus a by-area table with week and year-to-date % of norm.

This year (es-hydro.js): reserves Jan to Dec (energy or water, % full or amount) with 5/10-year average and range and last year; output by month by type; estimated weekly inflow; cards against 5- and 10-year averages.

Daily profile (es-hydro-profile.js): average day by type, year and month against last year and the earlier years; heat map of the year against the average by month and hour; evening lift by year.

Value (es-hydro-value.js): capture price and rate by month; the three-way split; top-quarter share; implied water value against reservoir fill; Type selector (Total, Generation before pumping, Reservoir, Run-of-river, Pumped storage).

Pumping (es-hydro-value.js): ENTSO-E pumping since 2015 and pumped-storage output (from about 2021); pumping and generating prices, spread; share pumped at zero or negative prices; average day for a chosen month.

Bell (Hydro topic): national hydroelectric reserves highest or lowest for the time of year in at least 5 years, and the largest weekly rise or fall for at least a year (es_alerts.py); basins fullest or emptiest for the time of year in at least 5 years, a basin's largest weekly move for at least a year, and up to three reservoirs of 100 hm³ or more that moved 10 points or more in a week (es_alerts_hydro.py). Basin alerts link to es/hydro/map, which falls back to the Overview tab (TO CONFIRM; consider changing the link to es/hydro/overview).


## 7. Release history

- Stage 1 to v4.1 (to 2 Nov 2026): France site; see section 11.
- Pre-v5: per-reactor nuclear modulation and small changes.
- v5.0 (Nov 2026): European Power Intel. Home page with market cards; market switch; market-prefixed addresses; Spain Overview, Demand, Prices (7 tabs), Generation, Flows; Spain bell events; Portugal prices and Spain-Portugal flows; files split into site- and es- prefixed modules; repo rename to euro_power_intel with Worker, config.js and index.html updated, and an optional forwarding page in a new fr_power_intel repo (TO CONFIRM whether created).
- v5.1: Spain Hydro page (MITECO reserves since 1988, daily profile, value, pumping); hydro made REE net for every year; capture-price legend fix.
- v5.2: Reserves map; hydro by type from ENTSO-E; Jan to Dec charts with 5/10-year switch and nuclear-style colours; pumping from 2015; rainfall and river flows; basin and reservoir bell events.
- Since v5.2 (not yet in What's new): Overview became the first Hydro tab with the new controls, colour scale, slider, sparklines, inflow card, copy summary, rainfall views, English uses, then a cleanup of the basin list, cards and summary. A v5.3 What's new and About entry is still to be written.


## 8. Open items and next steps

Immediate
1. Confirm the latest Overview cleanup works (narrow list, labels, five cards, two-sentence summary). Adjust sizes if needed.
2. Write the v5.3 What's new entry (changelog-v5.js) and About text (site-about.js) for the Overview changes.
3. Point basin alert links at es/hydro/overview.
4. Check whether es-hydro-basins.js and es-hydro-map-detail.js exist in the repo and delete them if unused.
5. Check rain_stations.json and flow_stations.json have ids and coordinates (they are not yet drawn on the map; the map shows reservoirs only).
6. Update README.md, worker/SETUP.md and CLAUDE.md for the euro_power_intel name (text only), or replace CLAUDE.md with a pointer to this file.
7. Page transitions: James asked for clean, professional transitions when clicking between pages. Discussed but not built (the request was interrupted).

Spain next
- REMIT outages for Spain (its place mirrors France's Nuclear page; shown as coming soon).
- Hydro ideas not built: river-flow and rain-gauge dots on the map; hydro bell alerts for rainfall; basin hydroelectric energy share.
- Interconnector capacity and utilisation (NTC), commercial exchanges (A09).

Germany (v6 direction)
- Same pattern as Spain: probe first, then pages with similar tabs (demand, prices, generation, flows), plus plant availability and gas storage if sources allow. ENTSO-E gives the common core.
- A Compare page across markets.

Parked
- Temperature adjustment of demand (Météo-France open data preferred).
- Logins for team members (plan if revived: Cloudflare Pages plus Cloudflare Access; site code private, data in a separate public repo).
- French demand history back to 2012 is done; per-reactor history is done.


## 9. Code rules (must follow)

Chat formatting strips some characters from pasted code. These rules exist because scripts broke more than once.
- No asterisks anywhere in code, comments or YAML. Multiplication is mul(a, b) (Python: from operator import mul; JS: const mul = (a, b) => a / (1 / b) or the shared mul in es-common.js). Cron schedules are written with ranges (for example "20 8,14,20 1-31 1-12 2-4"), never with the wildcard.
- No double underscores. In Python use Path(sys.argv[0]).name rather than the usual main-module check.
- No format specs inside Python f-strings; use .strftime() for dates and format(x, ".1f") or str() for numbers.
- Avoid a closing square bracket followed directly by a colon, an opening round bracket or another opening square bracket (markdown link syntax gets mangled). In JS use .at(i) instead of indexing where it would create them; in Python use slices like [0:3], intermediate variables (row = q[t], then row[k] = v) and .get().
- Before delivering, scan every file for: the asterisk, a double underscore, double tildes, and the three bracket pairs above. The assistant's check is a grep for those patterns; any hit must be rewritten.
- JS files use dashes in names (es-hydro-map.js); Python scripts use underscores (es_hydro_split.py). A name that differs by one character breaks the site.
- Run node --check on every JS file and python -m py_compile on every script before delivering. Test with made-up data shaped like the real files where possible; say clearly what was not tested (anything visual or in-browser).
- CSV readers must handle Windows line endings (split on /\r?\n/) and quoted names with commas ("Tinto, Odiel y Piedras").
- Python is standard library only (numpy is allowed in power_summarise.py).
- Keep each file to roughly 250 lines or less so it pastes in one go; split modules when they grow.
- New data files must be saved by the workflow that writes them (git add data/es covers all Spain files).
- Long jobs print progress (PYTHONUNBUFFERED=1) and backfills save whatever finished even if one part fails.
- Read-only probes go in scripts/ with a manual workflow writing to probe/out/; never touch data/.


## 10. How to run common jobs (for James)

- Rebuild Spain summaries: Actions, Backfill Spain history (one-off), Run workflow, clear the datasets box and type none.
- Refresh hydro detail history: Actions, Backfill Spain hydro detail (one-off), parts all (or split, or basins).
- Reload MITECO history: Actions, Spain reservoirs (MITECO bulletin), first year 1988.
- Check a run: Actions, choose the workflow, latest run, open the job, open the step, Ctrl+F for the line you need.
- Hard-refresh the site after a commit: F12, Network tab, tick Disable cache, Ctrl+R. Wait for the "pages-build-deployment" run to go green first.
- Rename a file in GitHub: open it, pencil icon, edit the name box at the top, commit.


## 11. France reference (carried over from CLAUDE.md, still current)

Design decisions
- Nuclear status colours: online green; partially available amber; offline planned red; offline unplanned red-and-yellow diagonal stripes (blue rejected as "too positive"); overruns beyond the first announced end purple. Duration scales stepped yellow to crimson (under 1 week, 1 to 4 weeks, 1 to 3 months, 3 to 6 months, 6+ months).
- Output heat map soft red to amber to green, muted per theme; blue-to-yellow for the colourblind palette.
- Overview and nuclear Today lead with availability; Explorer and Outlook default to unavailability (switch).
- Hydro (France) in fill level percentage points; capacity 3,591 GWh (RTE).
- Nuclear Outlook convention: colour = year; solid = notices at the time; dashed = this year's outlook at an earlier date; dotted = what happened.
- Prices: €/MWh, peak Mon to Fri 08:00 to 20:00 local, history from 5 Jan 2015, France's neighbours only.
- Bell "highest/lowest since" needs a gap of at least 7 days for prices and 30 days for generation, flows and demand.
- Display menu: dark/light, seven palettes (Teal default, Ocean, Sunset, Nordic, Vivid, High contrast, Colourblind-friendly), thickness, markers.

RTE API rules
- OAuth2 client credentials per API. Unavailability v7: query by publication date, end date must be in the past, HTTP 206 with continuation token (expires in 60 s), at most about 20 calls an hour. Actual generation: per type up to 155 days per call, per unit up to 7 days. water_reserves returns an object and rejects today's date (use last Monday).

France data rules
- Demand forecast vintage: latest version published before the interval; ex-ante only from 26 Oct 2026. D-1 values of about 0.7 GW on 2 to 14 Oct 2019 are corrupt and excluded. No RTE data for 14 Oct 2023.
- Nuclear: availability = installed minus the largest unavailability among overlapping notices (never summed); history from 1 Jan 2015; DISMISSED = cancelled; Fessenheim 1 out 22 Feb 2020, Fessenheim 2 out 29 Jun 2020 (UTC), Flamanville 3 in from 21 Dec 2024. Fleet output below 15 GW treated as missing; 16 Sep to 13 Oct 2024 filled from per-reactor output. Offline under 10% available; partial 10 to 90%; modulating = output under 80% of available.
- ENTSO-E prices A44 (contract A01; DE-LU sequence 1; ES A07 series are intraday auctions), flows A11, curve A03 forward-filled; 15-minute prices from 29 Sep 2025 22:00 UTC; DE = DE-AT-LU before 30 Sep 2018.
- Lesson (2 Nov 2026): storage code once stripped trailing zeros from whole numbers, making nuclear about 9% low. Always compare yearly sums with official annual totals after a backfill.

France history: Stage 1 demand backfill from Dec 2012; v1.1 demand tabs; v1.2 reliable updates; v2.0 forecast-extended explorer, palettes, refresh service; v3.0 nuclear and hydro pages; v3.1 James's 16-point review; v4.0 Prices, Generation, Flows, bell, TimeExplorer; v4.1 per-reactor modulation, multi-fuel generation explorer, page bar, pins, Excel export, flags, market events.
