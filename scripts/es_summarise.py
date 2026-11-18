"""Rebuilds Spain's daily summary files and data/es/coverage.json from the stored data."""
import es_store

es_store.summarise()
es_store.coverage()
