"""Rebuilds Spain's daily summary files, the daily price summary and
data/es/coverage.json from the stored data."""
import es_prices
import es_store

es_store.summarise()
es_prices.summarise_prices()
es_store.coverage()
