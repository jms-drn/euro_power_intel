"""Regular Spain update, run by .github/workflows/update-rte.yml after
update.py (every 15 minutes through the refresh service).

- ESIOS demand, generation mix and real-time exchanges: from yesterday
  00:00 to two days ahead (the demand forecast runs ahead) every run, and
  the past 7 days once every 6 hours to pick up REE's later corrections.
- Portugal day-ahead prices (ENTSO-E): yesterday to the day after tomorrow,
  at most every 55 minutes, but every run between 12:00 and 15:00 local time
  while the auction publishes.
- Spain-Portugal physical flows (ENTSO-E): the past two days, at most every
  55 minutes.
Then Spain's daily summaries are rebuilt.

Never stops the workflow: errors are printed and the run carries on, so the
France data is always saved.
"""
import traceback
from datetime import datetime, timedelta, timezone

import es_store
from store import PARIS, fmt_utc, parse_ts

UTC = timezone.utc


def due(state, key, minutes):
    last = state.get(key)
    return not last or datetime.now(UTC) - parse_ts(last) >= timedelta(minutes=minutes)


def run():
    state = es_store.load_state()
    errors = []
    now = datetime.now(UTC)
    local_now = now.astimezone(PARIS)
    today = local_now.date()

    week = due(state, "esios_week", 360)
    first_day = today - timedelta(days=7 if week else 1)
    start = es_store.local_midnight(first_day).astimezone(UTC)
    end = es_store.local_midnight(today + timedelta(days=2)).astimezone(UTC)
    for dataset in ("demand", "mix", "exchanges"):
        try:
            recs = es_store.fetch_esios(dataset, start, end, pause=0.2, errors=errors)
            print("Spain " + dataset + ": " + str(es_store.store_esios(dataset, recs)) + " rows changed")
        except Exception as error:  # noqa: BLE001
            traceback.print_exc()
            errors.append(dataset + ": " + str(error))
    if week and not any(e.startswith(("demand", "mix", "exchanges")) for e in errors):
        state["esios_week"] = fmt_utc(now)

    auction = 12 <= local_now.hour < 15
    if auction or due(state, "pt_prices", 55):
        try:
            a = es_store.local_midnight(today - timedelta(days=1)).astimezone(UTC)
            b = es_store.local_midnight(today + timedelta(days=2)).astimezone(UTC)
            print("Portugal prices: " + str(es_store.store_pt_prices(es_store.fetch_pt_prices(a, b))) + " rows changed")
            state["pt_prices"] = fmt_utc(now)
        except Exception as error:  # noqa: BLE001
            traceback.print_exc()
            errors.append("PT prices: " + str(error))

    if due(state, "pt_flows", 55):
        try:
            a = es_store.local_midnight(today - timedelta(days=2)).astimezone(UTC)
            b = now.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
            print("Spain-Portugal flows: " + str(es_store.store_pt_flows(es_store.fetch_pt_flows(a, b))) + " rows changed")
            state["pt_flows"] = fmt_utc(now)
        except Exception as error:  # noqa: BLE001
            traceback.print_exc()
            errors.append("PT flows: " + str(error))

    try:
        es_store.summarise()
    except Exception as error:  # noqa: BLE001
        traceback.print_exc()
        errors.append("summaries: " + str(error))

    es_store.save_state(state)
    if errors:
        print("Spain update finished with " + str(len(errors)) + " problem(s):")
        for e in errors:
            print("  - " + e)
    else:
        print("Spain update finished.")


try:
    run()
except Exception:  # noqa: BLE001
    traceback.print_exc()
    print("Spain update failed; the France data is still saved.")
