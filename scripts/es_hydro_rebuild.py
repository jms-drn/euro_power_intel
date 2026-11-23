"""Rebuilds Spain's hydro summaries (overall and by type) and alerts from the
stored data. Run by backfill-hydro-es.yml after the downloads."""
import es_alerts
import es_hydro
import es_hydro_types

es_hydro.build()
es_hydro_types.build()
es_alerts.build()
