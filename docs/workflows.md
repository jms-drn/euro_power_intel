# Workflows

## .github/workflows/backfill-es.yml
name: Backfill Spain history (one-off)
  workflow_dispatch:
          ESIOS_API_KEY: ${{ secrets.ESIOS_API_KEY }}
          ENTSOE_API_KEY: ${{ secrets.ENTSOE_API_KEY }}

## .github/workflows/backfill-hydro-es.yml
name: Backfill Spain hydro detail (one-off)
  workflow_dispatch:
      ENTSOE_API_KEY: ${{ secrets.ENTSOE_API_KEY }}

## .github/workflows/backfill-market.yml
name: Backfill prices, flows and generation history (one-off)
  workflow_dispatch:
          ENTSOE_API_KEY: ${{ secrets.ENTSOE_API_KEY }}
          RTE_GENERATION_CLIENT_ID: ${{ secrets.RTE_GENERATION_CLIENT_ID }}
          RTE_GENERATION_CLIENT_SECRET: ${{ secrets.RTE_GENERATION_CLIENT_SECRET }}

## .github/workflows/backfill-power.yml
name: Backfill nuclear and hydro history (one-off)
  workflow_dispatch:
          RTE_GENERATION_CLIENT_ID: ${{ secrets.RTE_GENERATION_CLIENT_ID }}
          RTE_GENERATION_CLIENT_SECRET: ${{ secrets.RTE_GENERATION_CLIENT_SECRET }}
          RTE_UNAVAILABILITY_CLIENT_ID: ${{ secrets.RTE_UNAVAILABILITY_CLIENT_ID }}
          RTE_UNAVAILABILITY_CLIENT_SECRET: ${{ secrets.RTE_UNAVAILABILITY_CLIENT_SECRET }}

## .github/workflows/backfill-units.yml
name: Backfill per-reactor nuclear output (one-off)
  workflow_dispatch:
          RTE_GENERATION_CLIENT_ID: ${{ secrets.RTE_GENERATION_CLIENT_ID }}
          RTE_GENERATION_CLIENT_SECRET: ${{ secrets.RTE_GENERATION_CLIENT_SECRET }}

## .github/workflows/backfill.yml
name: Backfill RTE history (one-off)
  workflow_dispatch:
          RTE_CLIENT_ID: ${{ secrets.RTE_CLIENT_ID }}
          RTE_CLIENT_SECRET: ${{ secrets.RTE_CLIENT_SECRET }}

## .github/workflows/probe-hydro-split.yml
name: Hydro split probe (one-off)
  workflow_dispatch:
      ENTSOE_TOKEN: ${{ secrets.ENTSOE_TOKEN }}
      ENTSOE_API_KEY: ${{ secrets.ENTSOE_API_KEY }}

## .github/workflows/probe-hydro.yml
name: Hydro probe (one-off)
  workflow_dispatch:

## .github/workflows/probe-map.yml
name: Map probe (one-off)
  workflow_dispatch:

## .github/workflows/probe-spain-2.yml
name: Spain probe 2 (one-off)
  workflow_dispatch:
          ENTSOE_API_KEY: ${{ secrets.ENTSOE_API_KEY }}
          ESIOS_API_KEY: ${{ secrets.ESIOS_API_KEY }}

## .github/workflows/probe-spain.yml
name: Spain probe (one-off)
  workflow_dispatch:
          ENTSOE_API_KEY: ${{ secrets.ENTSOE_API_KEY }}
          ESIOS_API_KEY: ${{ secrets.ESIOS_API_KEY }}

## .github/workflows/reservoirs-es.yml
name: Spain reservoirs (MITECO bulletin)
    - cron: "20 8,14,20 1-31 1-12 2-4"
  workflow_dispatch:

## .github/workflows/update-rte.yml
name: Update RTE data
    - cron: "47 0-23 1-31 1-12 0-6"
  workflow_dispatch:
      RTE_CLIENT_ID: ${{ secrets.RTE_CLIENT_ID }}
      RTE_CLIENT_SECRET: ${{ secrets.RTE_CLIENT_SECRET }}
      RTE_GENERATION_CLIENT_ID: ${{ secrets.RTE_GENERATION_CLIENT_ID }}
      RTE_GENERATION_CLIENT_SECRET: ${{ secrets.RTE_GENERATION_CLIENT_SECRET }}
      RTE_UNAVAILABILITY_CLIENT_ID: ${{ secrets.RTE_UNAVAILABILITY_CLIENT_ID }}
      RTE_UNAVAILABILITY_CLIENT_SECRET: ${{ secrets.RTE_UNAVAILABILITY_CLIENT_SECRET }}
      ENTSOE_API_KEY: ${{ secrets.ENTSOE_API_KEY }}
      ESIOS_API_KEY: ${{ secrets.ESIOS_API_KEY }}
