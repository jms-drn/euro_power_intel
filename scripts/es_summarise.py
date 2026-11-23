"""Rebuilds every Spain summary from the stored data: daily demand, mix,
exchanges, flows and prices, the market summaries (capture prices,
residual demand, parity, hourly files), the hydro summaries, the alerts
and coverage.json."""
import es_alerts
import es_hydro
import es_market
import es_prices
import es_store

es_store.summarise()
es_prices.summarise_prices()
es_market.build(2015)
es_hydro.build()
es_alerts.build()
es_store.coverage()
