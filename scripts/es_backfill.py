"""One-off download of Spain's history, run by .github/workflows/backfill-es.yml.

  demand     ESIOS actual and forecast demand, mainland, from 2015
  mix        ESIOS real-time generation by fuel, mainland, from 2015
  exchanges  ESIOS real-time exports and imports by border, from 2015
  prices     Portugal day-ahead prices (ENTSO-E), from 5 Jan 2015
  flows      Spain-Portugal physical flows (ENTSO-E), from 2015

ESIOS: one request per indicator and month. ENTSO-E: one request per
quarter-year. Safe to re-run: stored rows are merged. At the end it writes
data/es/coverage.json (first and last data point of every series) and
rebuilds the daily summaries.
"""
import argparse
import time
import traceback
from datetime import datetime, timedelta, timezone

import es_store
from store import PARIS

UTC = timezone.utc


def backfill_esios(dataset, first, end, failures):
    total = 0
    for a, b in es_store.month_windows(first, end):
        errors = []
        recs = es_store.fetch_esios(dataset, a, b, pause=0.3, errors=errors)
        total += es_store.store_esios(dataset, recs)
        label = a.astimezone(PARIS).strftime("%Y-%m")
        print("  " + dataset + " " + label + ": " + str(len(recs)) + " quarter-hours" + (" (" + str(len(errors)) + " failed)" if errors else ""))
        for e in errors:
            failures.append(label + " " + e)
    print(dataset + ": " + str(total) + " rows added or changed")


def backfill_entsoe(name, fetch, store, first, end, failures):
    total = 0
    for a, b in es_store.month_windows(first, end, months=3):
        label = a.astimezone(PARIS).strftime("%Y-%m")
        try:
            points = fetch(a, b)
            total += store(points)
            print("  " + name + " " + label + ": " + str(len(points)) + " periods")
        except Exception as error:  # noqa: BLE001
            failures.append(name + " " + label + ": " + str(error)[:200])
            print("  " + name + " " + label + ": FAILED " + str(error)[:200])
        time.sleep(1)
    print(name + ": " + str(total) + " rows added or changed")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--datasets", default="demand,mix,exchanges,prices,flows")
    parser.add_argument("--first-year", type=int, default=2015)
    args = parser.parse_args()
    wanted = [d.strip() for d in args.datasets.split(",") if d.strip()]
    first = datetime(args.first_year, 1, 1, tzinfo=PARIS).astimezone(UTC)
    now = datetime.now(UTC)
    ahead = es_store.local_midnight(now.astimezone(PARIS).date() + timedelta(days=2)).astimezone(UTC)
    failures = []
    for name in wanted:
        print("== " + name)
        try:
            if name in es_store.DATASETS:
                backfill_esios(name, first, ahead, failures)
            elif name == "prices":
                backfill_entsoe("prices PT", es_store.fetch_pt_prices, es_store.store_pt_prices, first, ahead, failures)
            elif name == "flows":
                backfill_entsoe("flows ES-PT", es_store.fetch_pt_flows, es_store.store_pt_flows, first, now, failures)
            else:
                print("Unknown dataset: " + name)
        except Exception as error:  # noqa: BLE001
            traceback.print_exc()
            failures.append(name + ": " + str(error))
    print("== coverage (first and last point, UTC)")
    cov = es_store.coverage()
    for dataset, cols in cov.items():
        if "first" in cols:
            print("  " + dataset + ": " + cols["first"] + " to " + cols["last"])
            continue
        for col, span in cols.items():
            print("  " + dataset + "." + col + ": " + (span["first"] or "no data") + " to " + span["last"])
    es_store.summarise()
    if failures:
        print(str(len(failures)) + " windows failed:")
        for f in failures[:60]:
            print("  - " + f)


main()
