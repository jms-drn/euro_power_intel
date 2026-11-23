// Spain hydro by type: loaders for data/es/hydro/monthly_types.csv and
// profile_types.csv (written by scripts/es_hydro_types.py), and the types
// offered by the Hydro page's Type selector.
// Code note: no asterisks here (chat formatting strips them when pasted).
import { cached, fetchText } from "./data.js";

export const TYPES = {
  total: { label: "Total (net of pumping)", short: "hydro output (net of pumping)" },
  gen: { label: "Generation before pumping", short: "hydro generation before pumping" },
  res: { label: "Reservoir", short: "reservoir hydro output" },
  ror: { label: "Run-of-river", short: "run-of-river output" },
  ps: { label: "Pumped storage (output)", short: "pumped-storage output" }
};
export const TYPE_OPTIONS = Object.keys(TYPES).map(k => [k, TYPES[k].label]);
export const TYPE_NOTE = "Total is REE's real-time hydro, net of pumping, for every year. The split into reservoir, run-of-river and pumped storage is ENTSO-E's (actual generation per production type); Spain reports pumped-storage output separately only from about 2021, and before that it is included in reservoir.";

function parse(text) {
  const lines = (text || "").trim().split("\n");
  if (lines.length < 2) return [];
  const head = lines.at(0).split(",");
  return lines.slice(1).map(line => {
    const v = line.split(",");
    const o = {};
    head.forEach((h, i) => {
      const x = v.at(i);
      o[h] = h === "type" ? x : (x === "" || x == null ? null : Number(x));
    });
    return o;
  });
}
const load = name => cached("es-hydro-" + name, async () => parse(await fetchText("data/es/hydro/" + name + ".csv", { optional: true }).catch(() => "")));

// Monthly sums by type: rows, and get(type, year, month) for one row (or null).
export async function getHydroTypes() {
  const rows = await load("monthly_types");
  const byKey = new Map(rows.map(r => [r.type + "-" + r.year + "-" + r.month, r]));
  return { rows, get: (ty, y, m) => byKey.get(ty + "-" + y + "-" + m) || null };
}
// Average MW and price by year, month and local hour for every type.
export const getHydroProfileTypes = () => load("profile_types");
