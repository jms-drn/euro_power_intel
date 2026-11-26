# European Power Intel: project handover

Briefing for any assistant session working on this project. Read it in full before changing anything, and update it whenever something here changes. It replaces CLAUDE.md as the main briefing.

Last updated: 26 Nov 2026. Site version 5.3. Spain section complete. Next stage: Germany (section 9).

"TO CONFIRM" marks anything not verified from the project record. Check it against the live repo before relying on it.


## 0. Quick start for a new session

1. James pastes this file (GitHub, open the file, Raw, copy all) plus the current version of any file to be changed.
2. Read section 1 (how James works) and section 10 (code rules) first. They are the ones most often broken.
3. Never edit from memory. Ask for the current file if it is not in the chat.
4. Deliver complete replacement files, inline, with the line count, in small batches.

Live site: jms-drn.github.io/euro_power_intel/
Repo: github.com/jms-drn/euro_power_intel (renamed Nov 2026 from fr_power_intel, which was renamed 29 Oct 2026 from fr_demand_tooling).
Refresh service: fr-demand-refresh.james-doran.workers.dev (Cloudflare Worker; name kept).


## 1. The owner and how to work with him

Who he is
- James Doran (byline jms-drn), reporter at Argus Media covering the Spanish power market, Iberia and French and wider European power.
- Uses the site for his own analysis and commentary and shares it with colleagues.
- Works in a work Copilot account (Anthropic model). API registrations are work-approved. The public site uses open data only; no internal or paid Argus data.

What he needs from replies
- Not a developer. Plain language. Say what he will see and exactly what to click (which GitHub page, which Actions workflow, which box to type in).
- Discuss first, then build. Rhythm: James sends a numbered list; reply point by point with views, questions and ideas; he answers; then build. Ask when a choice is his.
- Welcomes analytical, outside-the-box ideas, kept short and decisive.
- Precision above all. Never invent identifiers, endpoints, field names, URLs, figures or quotes. Verify against primary sources. When an API is unknown, write a read-only probe first and build only on its report. Say plainly what was not tested.
- On mistakes: say sorry briefly and fix it.
- Style: British spelling, plain and direct, short sentences, numbers with units (GW, TWh, pp, hm³, €/MWh), sentence case. Page headlines are copied into articles, so they must read as clean prose.

Delivering code (hard rules)
- He cannot open downloadable files. Always complete replacement files inline in code blocks. Never attachments, never "edit lines 40-60", never snippets to splice in.
- Give the line count and say whether each file is new or a replacement, and its folder.
- Small batches: about 4 to 6 files. Long replies have failed and been lost. Label batches (A, B, C) and say what each changes on screen.
- After each batch: what to check on the site, and what to send back if wrong (screenshot plus the red line from the browser Console, F12).
- He commits by pasting into the GitHub web editor. The assistant never commits.
- Hard refresh after commits: F12, Network, tick Disable cache, Ctrl+R (after "pages-build-deployment" goes green).

UI preferences
- Clean, minimal, professional; dark dashboard with a polished light mode.
- Calm colours; bright palettes are "gaudy". Comparisons use site variables: this year --s-actual, last year --s-ly, average --s-avg (dashed), range --s-band (soft band).
- Home page: title, byline, market cards, simple footer; no sidebar or top bar.
- Controls unobtrusive: dropdowns, chips, segmented buttons, switches.
- Cards: label, big value, one short detail line. Five cards at most where possible; busy cards get criticised.
- Side lists next to maps: compact, one line per row, units in column headers, readable names (Hydro list is 384 px).
- Small graphics (trend lines) must be labelled with what and over what period.
- Calendar year (Jan to Dec) by default. Default comparison: 5-year average, 10 years as an option; ranges cover the same years.


## 2. What the site is

Static web tool on European power data, each dataset against earlier years. Title "European Power Intel", byline "by jms-drn". Opens on a home page with market cards: France (live), Spain (live), Germany (coming soon).

Addresses: #home, #fr/page/tab?settings, #es/page/tab?settings. Every view writes its settings into the address. Old links without a market open France. Switching market keeps the same section and tab where possible. Display settings, palettes and pins are shared across markets. The bell shows the market on screen.

### France pages
| Page | Tabs |
|---|---|
| Overview | single page |
| Demand | Today · Explorer · Forecast accuracy · Outlook |
| Nuclear availability | Today · Explorer · Outages · Outlook |
| Hydro reserves | single page |
| Prices | Short term · Explorer · Spreads · Mix & Price · Negative Prices · Capture Prices · Residual Demand · Nuclear Modulation |
| Generation | Today · Explorer · Records |
| Flows | Live map · Explorer · Flows and prices |

### Spain pages
| Page | Tabs | Sources |
|---|---|---|
| Overview | single page | REE, ENTSO-E |
| Demand | Today · Explorer · Forecast accuracy | REE (ESIOS) |
| Prices | Short term · Explorer · Spreads · Mix & Price · Negative Prices · Capture Prices · Residual Demand | ENTSO-E, REE |
| Generation | Today · Explorer | REE (ESIOS) |
| Hydro | Overview · This year · Daily profile · Value · Pumping | MITECO, REE, ENTSO-E |
| Flows | Today · Explorer | ENTSO-E |


## 3. Architecture

Static site, no build step, GitHub Pages. Python pipeline in GitHub Actions. Cloudflare Worker as scheduler and live refresh. Charts: ECharts 5.6 (js/vendor/echarts.min.js).

Data flow
- Worker cron every 15 min starts "Update RTE data" (update-rte.yml) unless one is running. Refresh button posts to /refresh (live RTE data back to the browser; a workflow run at most every 5 min). GitHub's own hourly schedule is a backup only.
- update-rte.yml runs update.py (France) then es_update.py (Spain).
- All data-writing workflows share concurrency group rte-data. On push rejection they reset to latest main and redo the work.
- The site reads static files from data/. data/status.json generated_utc is the cache-busting data version.

### Front end (js/, names with dashes)
Shell and shared
- index.html (loads style.css, ux.css, echarts, then js/site-ux.js and js/main.js), style.css, ux.css (v5.3 motion and layout rules).
- main.js routing; site-pages.js page and tab registry (SITE = { fr, es }; add tabs here); markets.js; home.js; site-bell.js; site-about.js (About text; aboutHtml(market)); site-panels.js; changelog-v5.js (VERSION = "5.3"; imports older entries from changelog.js); config.js.
- site-ux.js (v5.3): page fade, chart ease-in (wraps echarts.init for on-screen charts only), card count-up, loading placeholders, pinned controls (Spain), "On this page" chips, folding panels (remembered in localStorage), breadcrumb, "updated" dots (Spain Prices and Hydro), keys (1-9 tabs, arrows step hydro slider, Ctrl+K or / search), Copy link button. Respects reduced motion.
- site-search.js: quick search over every page and tab plus Spanish basins.
- util.js joins util-time.js (Paris time, formatting; fmtNumber uses a true minus sign and avoids "−0.0") and util-web.js (hash, DOM, toast, copyText).
- data.js (cached, fetchText), chart.js (ChartPanel; custom charts via spec.custom with option, table, onReady), settings.js, time-explorer.js (shared explorer engine), market-common.js (card(), period picker), market-data.js (France market loaders, getPrices, getFlows, getAlerts, fmtByUnit).
- France page files: today, explorer, accuracy, outlook, nuclear-common, nuclear-today, nuclear-explorer, nuclear-outages, nuclear-outlook, hydro, overview, prices-short, prices-explorer, prices-analysis, generation, flows, events, flags, xlsx.

Spain
- es-pages.js re-exports every Spain tab class.
- es-data.js (loaders, FUELS, fuelValue, hydroGross, pumpValue, freshness line); es-common.js (Base tab class, cards() grid with tidy CSS and hover text for long details, headlineBlock, selectHtml, heatSpec, scatterSpec, meanOf, mul, pct, signed).
- es-overview.js (Overview, Demand), es-power.js (Generation, Flows), es-prices.js, es-analysis.js, es-capture.js.
- Hydro: es-hydro.js (This year; shared helpers shiftDate, near, yearsBack, fillYears, avgMw, AVG_OPTIONS), es-hydro-data.js (types loaders), es-hydro-profile.js, es-hydro-value.js (Value, Pumping), es-hydro-map-data.js (measures, comparisons, colour scale, genStats, inflowSeries, useLabel, loadCsv), es-hydro-map.js (Overview core), es-hydro-extras.js (EsHydroMapFull: moves, river flows, rainfall; registered as the Overview tab).
- es-hydro-basins.js and es-hydro-map-detail.js may exist from a superseded batch and are unused (TO CONFIRM; delete if present).

### Pipeline (scripts/, names with underscores)
France: rte_client, store, summarise, update, backfill, power_store, power_summarise, power_update, power_backfill, unit_backfill, market_store, market_summarise, market_update, market_backfill.
Spain: es_store, es_update, es_backfill, es_summarise, es_prices, es_market, es_hydro, es_hydro_types, es_hydro_split, es_reservoirs, es_basins, es_alerts, es_alerts_hydro, es_hydro_rebuild. Probes (read-only): hydro_probe, hydro_split_probe, map_probe, Spain probe.

### Workflows
| Workflow | What | When |
|---|---|---|
| update-rte.yml | update.py then es_update.py | Every 15 min via Worker; hourly backup |
| reservoirs-es.yml | es_reservoirs.py then es_basins.py | Tue-Thu 08:20, 14:20, 20:20 UTC; by hand with a first year |
| backfill-es.yml | Spain history; type none to rebuild only | By hand |
| backfill-hydro-es.yml | ENTSO-E hydro split and MITECO basins, then rebuild; parts all, split or basins | By hand |
| backfill-market.yml, backfill-units.yml | France history | By hand |
| probe-*.yml | Read-only probes to probe/out/ | By hand |

### Secrets
- GitHub Actions: RTE_CLIENT_ID and SECRET (consumption), RTE_GENERATION_CLIENT_ID and SECRET, RTE_UNAVAILABILITY_CLIENT_ID and SECRET, ENTSOE_API_KEY, ESIOS_API_KEY.
- Worker: RTE_CLIENT_ID, RTE_CLIENT_SECRET, GITHUB_TOKEN (fine-grained, Actions read and write, this repo only); optional ALLOWED_ORIGINS. Worker constants REPO = "jms-drn/euro_power_intel", WORKFLOW = "update-rte.yml". Source kept in worker/worker.js; after changes paste into Cloudflare and Deploy.
- Never commit keys.


## 4. Spain data pipeline (summary)

Sources: REE via ESIOS (demand, forecast, mix, exchanges; 5-min, averaged to 15-min, mainland, from 2015). ENTSO-E (ES/FR/PT prices; Spain-Portugal flows; hydro by type A75/A16, zone 10YES-REE------0). MITECO ArcGIS services behind the weekly Boletín Hidrológico (owner BolHidro_miteco; no key).

Key data rules
- Hydro is REE's real-time net figure (output minus pumping) for every year; shares and capture prices count it only when positive.
- Hydro before pumping and REE pumping exist from 30 Dec 2024. Mix charts draw hydro before pumping with pumping below zero.
- REE's separate pumped-storage output (pump_gen) starts 23 Jan 2025 17:30 UTC and undercounts; never use it. Pumping tab uses ENTSO-E.
- ENTSO-E hydro by type: run-of-river B11, reservoir B12, pumped storage B10 (output) and B10 consumption (pumping). Net total matched REE within about 2% on six test days 2015-2026. Pumped-storage output reported separately only from about 2021; before that inside reservoir.
- MITECO dates are Spanish midnight; scripts shift 12 hours before taking the date. Bulletins refer to Tuesdays. Basins matched across tables by a key (lower case, no accents, spaces or punctuation). Check vs 17 Nov 2026 bulletin: 31,950 of 56,049 hm³ (57.0%), 375 reservoirs; hydroelectric energy 9.87 of 23.01 TWh (42.9%).
- Data files: data/es/demand, mix, exchanges, flows/PT; daily/; hourly/YYYY.csv; hydro/monthly(.csv), profile, monthly_types, profile_types; hydro_split/; reservoirs.csv (from 1988); basins.csv (from 1988); rain.csv (from 1995); river_flows.csv (from 2001); map/ (basins.json, reservoirs.json, rain_stations.json, flow_stations.json); alerts.json.

Hydro definitions: capture price (output-weighted), the three-way capture-change split (price level, price shape, when plants ran), top-quarter share, within-day correlation, implied water value (site's estimate, labelled), evening lift (19-23h minus 11-17h), estimated inflow (net output between bulletins plus change in stored energy), pumping spread.


## 5. Spain Hydro page as built (v5.3)

Tabs: Overview · This year · Daily profile · Value · Pumping.
- Overview: two-sentence copy summary; five cards (hydro reserves pp vs 5/10-yr; output past 7 days, month, year vs 5/10-yr norms; inflow vs norm); basin map with Measure (water % full, hydro energy % full, GWh, hm³), Compare with (5-yr default, 10-yr, last year, last week), Show as (points or units, % difference, level); colour scale red below, blue above, each side scaled separately and capped at its second-largest value; reservoir dots (latest bulletin only); date slider to 1988; 384 px basin list with 12-week trend lines; basin year chart; largest reservoirs (uses in English); biggest weekly moves; river flows; rainfall (so far this year or week by week vs seasonal norm; by-area table).
- This year: reserves Jan-Dec with 5/10-yr average and range; output by month by type; weekly inflow.
- Daily profile, Value, Pumping: by type, as defined above.
- Bell (Hydro topic): national reserves and basins fullest or emptiest for the time of year in 5+ years, largest weekly moves, reservoirs of 100 hm³+ moving 10+ points in a week. Basin alert links go to es/hydro/map, which falls back to Overview (TO CONFIRM; better to change to es/hydro/overview).


## 6. Release history
- To v4.1 (Nov 2026): France site (section 12).
- v5.0: European Power Intel; home page; market switch; Spain Overview, Demand, Prices, Generation, Flows; repo rename.
- v5.1: Spain Hydro page; hydro made REE net for every year; capture-price legend fix.
- v5.2: reserves map; hydro by type; Jan-Dec charts with 5/10-yr switch; pumping from 2015; rainfall and river flows; basin alerts.
- v5.3 (24-26 Nov 2026): Hydro Overview as first tab (controls, capped colour scale, slider, sparklines, inflow card, copy summary, rainfall views, English uses, compact wider list, simpler cards); site-wide motion, search, shortcuts, breadcrumb, copy link, updated dots, pinned controls, jump chips, folding panels, phone layouts; true minus sign everywhere; tidy Spain card grid. What's new and About updated.


## 7. Data licensing (findings, 24 Nov 2026; not legal advice)
- RTE: APIs under RTE's General Terms of Service (accepted on subscribing). éCO2mix data is also on data.gouv.fr under Licence Ouverte (commercial reuse with attribution). Whether the API data (forecasts, outage notices, per-unit output) may be redistributed was not confirmed.
- ENTSO-E: Terms of Use; only data on its "List of Data available for free re-use" (18 Oct 2023 version) is CC BY 4.0 without the owner's agreement. Physical flows appear to be on it. Day-ahead prices and generation per type may not be (prices come from EPEX SPOT and OMIE). Not confirmed against ENTSO-E's own list.
- REE ESIOS: free access under REE's legal notice with a personal token; reuse clause not read.
- MITECO: its open-data API is CC BY 4.0 and Spanish public-sector reuse rules allow commercial reuse with attribution; the bulletin ArcGIS services show no explicit licence. Rainfall gauges are AEMET's.
- Natural Earth: public domain.
- Before any commercial use, check ENTSO-E's reuse list and the RTE and REE terms, and ask Argus data licensing (Argus may already license EPEX and OMIE prices).


## 8. Open items
1. Basin alert links: point at es/hydro/overview.
2. Delete es-hydro-basins.js and es-hydro-map-detail.js if present.
3. Check rain_stations.json and flow_stations.json have ids (the rain map layer calls its id PLUVIOMETRO_ID).
4. France card tidy-up (Spain-style grid, five cards, one detail line); needs the France page files.
5. Spain Overview and Prices Short term still have eight cards; cut to five if James wants (needs es-overview.js and es-prices.js).
6. Update README.md, worker/SETUP.md and CLAUDE.md for the new name, or make CLAUDE.md point here.
7. Ideas not built: river-flow and rain-gauge dots on the map; chart annotations for key events; Spain REMIT outages; NTC and commercial exchanges.


## 9. Next stage: Germany (v6)

Approach (same as Spain): discuss scope with James, write a read-only probe, build only on its report, then data batches, then page batches. DE card on the home page goes live when the first pages ship. Address prefix de/ is already reserved in markets.js and util-web.js.

Likely scope to discuss
- Overview; Demand (actual and forecast); Prices (DE-LU day-ahead and the Prices tabs, with spreads to FR, NL, AT, PL, CZ, DK, CH as relevant); Generation (mix, with wind, solar and lignite stories); Flows; possibly Gas storage and Plant availability.
- Germany already exists in the site's price data as DE-LU (DE-AT-LU before 1 Oct 2018).

Candidate sources (all to be probed; none confirmed for this project yet)
- ENTSO-E (bidding zone DE-LU): load and load forecast, generation per type, prices, physical flows. Same client code as Spain. Licensing caveats in section 7 apply.
- SMARD (Bundesnetzagentur): German market data with an open download API; licence believed to be CC BY 4.0 (TO CONFIRM).
- Energy-Charts (Fraunhofer ISE): API with German generation and prices; check its licence and terms (TO CONFIRM).
- Gas storage: GIE AGSI+ (free API key) (TO CONFIRM terms).
- Plant outages: EEX Transparency or ENTSO-E unavailability data (TO CONFIRM).

First message suggestion for the new chat: "Continue European Power Intel from this handover. Next stage: Germany. Propose the page and tab plan and a read-only probe, and ask me any questions before building."


## 10. Code rules (must follow)

Chat formatting strips some characters from pasted code. These rules exist because scripts broke more than once.
- No asterisks anywhere (code, comments, YAML). Multiply with mul(a, b) (Python: from operator import mul; JS: a / (1 / b) or es-common mul). Cron uses ranges, never the wildcard.
- No double underscores. In Python use Path(sys.argv[0]).name instead of the usual main-module check.
- No format specs inside Python f-strings; use .strftime() and format(x, ".1f").
- Avoid a closing square bracket directly followed by a colon, an opening round bracket or an opening square bracket. In JS use .at(i); in Python use slices like [0:3], intermediate variables and .get().
- Before delivering, grep every file for those patterns and double tildes; rewrite any hit.
- JS files use dashes, Python scripts underscores. One wrong character breaks the site.
- Run node --check on JS and python -m py_compile on scripts. Test with made-up data shaped like the real files. State what was not tested (anything visual).
- CSV readers handle Windows line endings and quoted names with commas.
- Python is standard library only (numpy allowed in power_summarise.py).
- Keep files to roughly 250 lines; split modules as they grow.
- Workflows must git add the folders they write.
- Long jobs set PYTHONUNBUFFERED=1; backfills save whatever finished even if one part fails.
- Probes live in scripts/ with a manual workflow writing to probe/out/; never touch data/.


## 11. Common jobs (for James)
- Rebuild Spain summaries: Actions, Backfill Spain history (one-off), clear the datasets box and type none.
- Refresh hydro detail: Actions, Backfill Spain hydro detail (one-off), parts all.
- Reload MITECO history: Actions, Spain reservoirs (MITECO bulletin), first year 1988.
- Check a run: Actions, workflow, latest run, open job, open step, Ctrl+F.
- Rename a file in GitHub: open it, pencil, edit the name box, commit.


## 12. France reference (from CLAUDE.md, still current)
- Nuclear colours: online green; partial amber; offline planned red; offline unplanned red-yellow stripes; overruns purple. Duration scales stepped yellow to crimson.
- France hydro in fill-level pp; capacity 3,591 GWh (RTE).
- Prices €/MWh; peak Mon-Fri 08:00-20:00 local; history from 5 Jan 2015; 15-min prices from 29 Sep 2025 22:00 UTC.
- Bell "since" thresholds: 7 days for prices, 30 days for generation, flows and demand.
- RTE API: OAuth2 per API. Unavailability v7 by publication date, end date in the past, HTTP 206 with continuation token (60 s), about 20 calls an hour. Generation per type up to 155 days per call, per unit 7 days. water_reserves rejects today's date.
- Demand forecast vintage: latest version before the interval; ex-ante only from 26 Oct 2026. D-1 values around 0.7 GW on 2-14 Oct 2019 excluded. No RTE data for 14 Oct 2023.
- Nuclear availability = installed minus the largest unavailability among overlapping notices (never summed); history from 2015; Fessenheim 1 out 22 Feb 2020, Fessenheim 2 out 29 Jun 2020, Flamanville 3 in from 21 Dec 2024. Fleet output under 15 GW treated as missing. Offline under 10% available; partial 10-90%; modulating under 80% of available.
- ENTSO-E prices A44 (DE-LU sequence 1; ES A07 series are intraday auctions), flows A11, curve A03 forward-filled.
- Lesson: compare yearly sums with official totals after every backfill (a storage bug once made nuclear about 9% low).
