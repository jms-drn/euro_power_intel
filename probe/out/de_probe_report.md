# Germany probe report

Run 2026-11-27 14:05 UTC. Recent day 2026-11-25, early day 2015-01-05 (Berlin days). Read-only; nothing in data/ was touched.

## 1. Load and day-ahead load forecast (A65)

| What | Day | Area | Result |
|---|---|---|---|
| Actual load | recent | DE-LU | 1 series; PT15M; 96 points; mean 67695.4 MW |
| Actual load | recent | DE-AT-LU | no data: No matching data found for Data item ACTUAL_TOTAL_LOAD_R3 [6.1.A] (10Y1001A1001A63L) and interval 2026-11-24T23:00:00Z/2026-11-25T23:00:00Z. |
| Actual load | recent | Germany control area | 1 series; PT15M; 96 points; mean 66991.9 MW |
| Actual load | recent | 50Hertz | 1 series; PT15M; 96 points; mean 13977.8 MW |
| Actual load | recent | Amprion | 1 series; PT15M; 96 points; mean 24414.7 MW |
| Actual load | recent | TenneT | 1 series; PT15M; 96 points; mean 20203.1 MW |
| Actual load | recent | TransnetBW | 1 series; PT15M; 96 points; mean 8396.2 MW |
| Actual load | 2015 | DE-LU | no data: No matching data found for Data item ACTUAL_TOTAL_LOAD_R3 [6.1.A] (10Y1001A1001A82H) and interval 2015-01-04T23:00:00Z/2015-01-05T23:00:00Z. |
| Actual load | 2015 | DE-AT-LU | 1 series; PT15M; 96 points; mean 67166.1 MW |
| Actual load | 2015 | Germany control area | 1 series; PT15M; 96 points; mean 59846.0 MW |
| Actual load | 2015 | 50Hertz | 1 series; PT15M; 96 points; mean 12900.7 MW |
| Actual load | 2015 | Amprion | 1 series; PT15M; 96 points; mean 21961.9 MW |
| Actual load | 2015 | TenneT | 1 series; PT15M; 96 points; mean 18192.8 MW |
| Actual load | 2015 | TransnetBW | 1 series; PT15M; 96 points; mean 6790.7 MW |
| Load forecast | recent | DE-LU | 1 series; PT15M; 96 points; mean 61947.4 MW |
| Load forecast | recent | DE-AT-LU | no data: No matching data found for Data item DAY_AHEAD_TOTAL_LOAD_FORECAST_R3 [6.1.B] (10Y1001A1001A63L) and interval 2026-11-24T23:00:00Z/2026-11-25T23:00:00Z. |
| Load forecast | recent | Germany control area | 1 series; PT15M; 96 points; mean 61260.7 MW |
| Load forecast | recent | 50Hertz | 1 series; PT15M; 96 points; mean 12285.6 MW |
| Load forecast | recent | Amprion | 1 series; PT15M; 96 points; mean 23246.3 MW |
| Load forecast | recent | TenneT | 1 series; PT15M; 96 points; mean 17317.3 MW |
| Load forecast | recent | TransnetBW | 1 series; PT15M; 79 points; mean 8317.8 MW |
| Load forecast | 2015 | DE-LU | no data: No matching data found for Data item DAY_AHEAD_TOTAL_LOAD_FORECAST_R3 [6.1.B] (10Y1001A1001A82H) and interval 2015-01-04T23:00:00Z/2015-01-05T23:00:00Z. |
| Load forecast | 2015 | DE-AT-LU | 1 series; PT15M; 96 points; mean 61398.8 MW |
| Load forecast | 2015 | Germany control area | 1 series; PT15M; 96 points; mean 53035.4 MW |
| Load forecast | 2015 | 50Hertz | 1 series; PT15M; 96 points; mean 8680.2 MW |
| Load forecast | 2015 | Amprion | 1 series; PT15M; 96 points; mean 21951.8 MW |
| Load forecast | 2015 | TenneT | 1 series; PT15M; 96 points; mean 17145.9 MW |
| Load forecast | 2015 | TransnetBW | 1 series; PT15M; 95 points; mean 5247.8 MW |


## 2. Generation per type (A75)

Type codes from ENTSO-E's list: B01 Biomass; B02 Lignite; B03 Coal-derived gas; B04 Gas; B05 Hard coal; B06 Oil; B09 Geothermal; B10 Pumped storage; B11 Run-of-river; B12 Reservoir; B14 Nuclear; B15 Other renewable; B16 Solar; B17 Waste; B18 Wind offshore; B19 Wind onshore; B20 Other; B25 Energy storage.

### DE-LU, recent day
| Code | Type | Direction | Resolution | Points | Mean MW |
|---|---|---|---|---|---|
| B01 | Biomass | output | PT15M | 96 | 4387.5 |
| B02 | Lignite | output | PT15M | 96 | 11087.0 |
| B03 | Coal-derived gas | output | PT15M | 96 | 261.5 |
| B04 | Gas | output | PT15M | 96 | 15308.8 |
| B05 | Hard coal | output | PT15M | 96 | 5853.1 |
| B06 | Oil | output | PT15M | 92 | 390.6 |
| B09 | Geothermal | output | PT15M | 1 | 19.0 |
| B10 | Pumped storage | consumption | PT15M | 96 | 1142.0 |
| B10 | Pumped storage | output | PT15M | 96 | 923.7 |
| B11 | Run-of-river | output | PT15M | 96 | 1248.1 |
| B12 | Reservoir | output | PT15M | 96 | 120.1 |
| B15 | Other renewable | output | PT15M | 1 | 76.2 |
| B16 | Solar | output | PT15M | 91 | 3723.2 |
| B17 | Waste | output | PT15M | 96 | 843.8 |
| B18 | Wind offshore | output | PT15M | 96 | 5901.3 |
| B19 | Wind onshore | output | PT15M | 96 | 16253.9 |
| B20 | Other | output | PT15M | 93 | 221.2 |

### Germany control area, 2015 day
| Code | Type | Direction | Resolution | Points | Mean MW |
|---|---|---|---|---|---|
| B01 | Biomass | output | PT15M | 96 | 4601.8 |
| B02 | Lignite | output | PT15M | 96 | 16882.1 |
| B02 | Lignite | consumption | PT15M | 1 | 0.0 |
| B03 | Coal-derived gas | output | PT15M | 1 | 0.0 |
| B03 | Coal-derived gas | consumption | PT15M | 1 | 0.0 |
| B04 | Gas | output | PT15M | 96 | 1464.6 |
| B04 | Gas | consumption | PT15M | 1 | 0.0 |
| B05 | Hard coal | output | PT15M | 96 | 7377.0 |
| B05 | Hard coal | consumption | PT15M | 1 | 0.0 |
| B06 | Oil | output | PT15M | 79 | 187.9 |
| B06 | Oil | consumption | PT15M | 81 | 4.0 |
| B09 | Geothermal | output | PT15M | 86 | 13.8 |
| B10 | Pumped storage | output | PT15M | 96 | 1019.5 |
| B10 | Pumped storage | consumption | PT15M | 95 | 1341.9 |
| B11 | Run-of-river | output | PT15M | 96 | 1565.0 |
| B11 | Run-of-river | consumption | PT15M | 1 | 0.0 |
| B12 | Reservoir | output | PT15M | 96 | 54.6 |
| B14 | Nuclear | output | PT15M | 96 | 11128.4 |
| B14 | Nuclear | consumption | PT15M | 1 | 0.0 |
| B15 | Other renewable | output | PT15M | 96 | 219.5 |
| B16 | Solar | output | PT15M | 86 | 1238.5 |
| B17 | Waste | output | PT15M | 92 | 523.9 |
| B17 | Waste | consumption | PT15M | 1 | 0.0 |
| B18 | Wind offshore | output | PT15M | 96 | 325.9 |
| B19 | Wind onshore | output | PT15M | 96 | 9587.2 |
| B20 | Other | output | PT15M | 96 | 388.7 |

### DE-AT-LU, 2015 day
| Code | Type | Direction | Resolution | Points | Mean MW |
|---|---|---|---|---|---|
| B01 | Biomass | output | PT15M | 96 | 4913.7 |
| B01 | Biomass | consumption | PT15M | 1 | 0.0 |
| B02 | Lignite | output | PT15M | 96 | 16882.1 |
| B02 | Lignite | consumption | PT15M | 1 | 0.0 |
| B03 | Coal-derived gas | output | PT15M | 1 | 0.0 |
| B03 | Coal-derived gas | consumption | PT15M | 1 | 0.0 |
| B04 | Gas | output | PT15M | 96 | 3134.3 |
| B04 | Gas | consumption | PT15M | 1 | 0.0 |
| B05 | Hard coal | output | PT15M | 96 | 7503.2 |
| B05 | Hard coal | consumption | PT15M | 1 | 0.0 |
| B06 | Oil | output | PT15M | 79 | 187.9 |
| B06 | Oil | consumption | PT15M | 81 | 4.0 |
| B09 | Geothermal | output | PT15M | 86 | 13.8 |
| B09 | Geothermal | consumption | PT15M | 1 | 0.0 |
| B10 | Pumped storage | output | PT15M | 96 | 1386.6 |
| B10 | Pumped storage | consumption | PT15M | 95 | 1633.2 |
| B11 | Run-of-river | output | PT15M | 96 | 4232.8 |
| B11 | Run-of-river | consumption | PT15M | 1 | 0.0 |
| B12 | Reservoir | output | PT15M | 96 | 515.2 |
| B12 | Reservoir | consumption | PT15M | 1 | 0.0 |
| B14 | Nuclear | output | PT15M | 96 | 11128.4 |
| B14 | Nuclear | consumption | PT15M | 1 | 0.0 |
| B15 | Other renewable | output | PT15M | 96 | 219.5 |
| B15 | Other renewable | consumption | PT15M | 1 | 0.0 |
| B16 | Solar | output | PT15M | 87 | 1238.2 |
| B16 | Solar | consumption | PT15M | 1 | 0.0 |
| B17 | Waste | output | PT15M | 96 | 535.7 |
| B17 | Waste | consumption | PT15M | 1 | 0.0 |
| B18 | Wind offshore | output | PT15M | 96 | 325.9 |
| B19 | Wind onshore | output | PT15M | 96 | 11103.0 |
| B19 | Wind onshore | consumption | PT15M | 1 | 0.0 |
| B20 | Other | output | PT15M | 96 | 862.6 |
| B20 | Other | consumption | PT15M | 1 | 0.0 |


## 3. Generation per unit (A73), recent day

Asked with DE-LU: no data: No matching data found for Data item ACTUAL_GENERATION_OUTPUT_PER_UNIT_R3 [16.1.A] (10Y1001A1001A82H) and interval 2026-11-24T23:00:00Z/2026-11-25T23:00:00Z.
Asked with Germany control area: no data: No matching data found for Data item ACTUAL_GENERATION_OUTPUT_PER_UNIT_R3 [16.1.A] (10Y1001A1001A83F) and interval 2026-11-24T23:00:00Z/2026-11-25T23:00:00Z.


## 4. Day-ahead prices (A44)

| Zone | Recent day | 2015 day |
|---|---|---|
| DE-LU | 2 series; PT15M; 192 points; mean 241.4 EUR/MWh | 1 series; PT60M; 24 points; mean 35.9 EUR/MWh |
| FR | 1 series; PT15M; 96 points; mean 255.2 EUR/MWh | 1 series; PT60M; 24 points; mean 44.4 EUR/MWh |
| NL | 1 series; PT15M; 96 points; mean 222.8 EUR/MWh | 1 series; PT60M; 24 points; mean 41.7 EUR/MWh |
| AT | 2 series; PT15M; 191 points; mean 269.9 EUR/MWh | 1 series; PT15M; 93 points; mean 38.1 EUR/MWh |
| CZ | 1 series; PT15M; 96 points; mean 278.3 EUR/MWh | 1 series; PT60M; 24 points; mean 38.5 EUR/MWh |
| PL | 1 series; PT15M; 96 points; mean 311.0 EUR/MWh | 1 series; PT60M; 8 points; mean 44.3 EUR/MWh |
| DK1 | 2 series; PT15M; 192 points; mean 241.1 EUR/MWh | 1 series; PT60M; 24 points; mean 38.0 EUR/MWh |
| CH | 1 series; PT15M; 93 points; mean 254.2 EUR/MWh | 1 series; PT60M; 24 points; mean 47.4 EUR/MWh |


## 5. Physical flows (A11), mean MW

Recent day uses DE-LU; 2015 day uses the Germany control area.

| Border | Day | Into Germany | Out of Germany |
|---|---|---|---|
| DE-FR | recent | 1049.7 | 335.8 |
| DE-FR | 2015 | 426.0 | 77.8 |
| DE-NL | recent | 3698.4 | 490.8 |
| DE-NL | 2015 | 0.0 | 2847.1 |
| DE-BE | recent | 334.7 | 329.5 |
| DE-BE | 2015 | no data: No matching data found for Data item NET_CROSS_BORDER_PHYSICAL_FLOWS_R3 [12.1.G] (10Y1001A1001A83F, 10YBE----------2) and interval 2015-01-04T23:00:00Z/2015-01- | no data: No matching data found for Data item NET_CROSS_BORDER_PHYSICAL_FLOWS_R3 [12.1.G] (10YBE----------2, 10Y1001A1001A83F) and interval 2015-01-04T23:00:00Z/2015-01- |
| DE-AT | recent | 349.5 | 1260.3 |
| DE-AT | 2015 | 0.0 | 1638.1 |
| DE-CH | recent | 426.0 | 621.9 |
| DE-CH | 2015 | no data: No matching data found for Data item NET_CROSS_BORDER_PHYSICAL_FLOWS_R3 [12.1.G] (10Y1001A1001A83F, 10YCH-SWISSGRIDZ) and interval 2015-01-04T23:00:00Z/2015-01- | no data: No matching data found for Data item NET_CROSS_BORDER_PHYSICAL_FLOWS_R3 [12.1.G] (10YCH-SWISSGRIDZ, 10Y1001A1001A83F) and interval 2015-01-04T23:00:00Z/2015-01- |
| DE-CZ | recent | 162.1 | 1236.5 |
| DE-CZ | 2015 | 1081.2 | 211.0 |
| DE-PL | recent | 0.0 | 2026.0 |
| DE-PL | 2015 | 3.3 | 827.9 |
| DE-DK1 | recent | 0.0 | 995.2 |
| DE-DK1 | 2015 | no data: No matching data found for Data item NET_CROSS_BORDER_PHYSICAL_FLOWS_R3 [12.1.G] (10Y1001A1001A83F, 10YDK-1--------W) and interval 2015-01-04T23:00:00Z/2015-01- | no data: No matching data found for Data item NET_CROSS_BORDER_PHYSICAL_FLOWS_R3 [12.1.G] (10YDK-1--------W, 10Y1001A1001A83F) and interval 2015-01-04T23:00:00Z/2015-01- |
| DE-DK2 | recent | 34.7 | 470.1 |
| DE-DK2 | 2015 | no data: No matching data found for Data item NET_CROSS_BORDER_PHYSICAL_FLOWS_R3 [12.1.G] (10Y1001A1001A83F, 10YDK-2--------M) and interval 2015-01-04T23:00:00Z/2015-01- | no data: No matching data found for Data item NET_CROSS_BORDER_PHYSICAL_FLOWS_R3 [12.1.G] (10YDK-2--------M, 10Y1001A1001A83F) and interval 2015-01-04T23:00:00Z/2015-01- |
| DE-SE4 | recent | 22.1 | 85.9 |
| DE-SE4 | 2015 | no data: No matching data found for Data item NET_CROSS_BORDER_PHYSICAL_FLOWS_R3 [12.1.G] (10Y1001A1001A83F, 10Y1001A1001A47J) and interval 2015-01-04T23:00:00Z/2015-01- | no data: No matching data found for Data item NET_CROSS_BORDER_PHYSICAL_FLOWS_R3 [12.1.G] (10Y1001A1001A47J, 10Y1001A1001A83F) and interval 2015-01-04T23:00:00Z/2015-01- |
| DE-NO2 | recent | 398.3 | 233.0 |
| DE-NO2 | 2015 | no data: No matching data found for Data item NET_CROSS_BORDER_PHYSICAL_FLOWS_R3 [12.1.G] (10Y1001A1001A83F, 10YNO-2--------T) and interval 2015-01-04T23:00:00Z/2015-01- | no data: No matching data found for Data item NET_CROSS_BORDER_PHYSICAL_FLOWS_R3 [12.1.G] (10YNO-2--------T, 10Y1001A1001A83F) and interval 2015-01-04T23:00:00Z/2015-01- |

## 6. SMARD series (region DE)

| Filter | Series | Hourly history from | Weekly chunks | Latest value (MWh) at | Quarter-hour index |
|---|---|---|---|---|---|
| 410 | Grid load | 2014-12-28 23:00 UTC | 622 | 70860.1 at 2026-11-27 12:00 UTC | yes |
| 4359 | Residual load | 2014-12-28 23:00 UTC | 622 | 51933.4 at 2026-11-27 12:00 UTC | yes |
| 1223 | Lignite | 2014-12-28 23:00 UTC | 622 | 9974.3 at 2026-11-27 12:00 UTC | yes |
| 4069 | Hard coal | 2014-12-28 23:00 UTC | 622 | 5720.9 at 2026-11-27 12:00 UTC | yes |
| 4071 | Gas | 2014-12-28 23:00 UTC | 622 | 16566.7 at 2026-11-27 12:00 UTC | yes |
| 1224 | Nuclear | 2014-12-28 23:00 UTC | 475 | 0.0 at 2024-01-30 10:00 UTC | yes |
| 4067 | Wind onshore | 2014-12-28 23:00 UTC | 622 | 4581.0 at 2026-11-27 12:00 UTC | yes |
| 1225 | Wind offshore | 2014-12-28 23:00 UTC | 622 | 4919.8 at 2026-11-27 12:00 UTC | yes |
| 4068 | Solar | 2014-12-28 23:00 UTC | 622 | 9425.8 at 2026-11-27 12:00 UTC | yes |
| 4066 | Biomass | 2014-12-28 23:00 UTC | 622 | 4382.3 at 2026-11-27 12:00 UTC | yes |
| 1226 | Hydro | 2014-12-28 23:00 UTC | 622 | 1425.9 at 2026-11-27 12:00 UTC | yes |
| 4070 | Pumped storage output | 2014-12-28 23:00 UTC | 622 | 989.2 at 2026-11-27 12:00 UTC | yes |
| 4387 | Pumped storage consumption | 2014-12-28 23:00 UTC | 622 | 318.3 at 2026-11-27 12:00 UTC | yes |
| 1227 | Other conventional | 2014-12-28 23:00 UTC | 622 | 1690.2 at 2026-11-27 12:00 UTC | yes |
| 1228 | Other renewables | 2014-12-28 23:00 UTC | 622 | 79.1 at 2026-11-27 12:00 UTC | yes |

## 7. SMARD by TSO area

| Filter | Area | Hourly history from | Latest value (MWh) at |
|---|---|---|---|
| 410 | 50Hertz | 2014-12-28 23:00 UTC | 14922.4 at 2026-11-27 13:00 UTC |
| 410 | Amprion | 2014-12-28 23:00 UTC | 25622.5 at 2026-11-27 13:00 UTC |
| 410 | TenneT | 2014-12-28 23:00 UTC | 20080.6 at 2026-11-27 12:00 UTC |
| 410 | TransnetBW | 2014-12-28 23:00 UTC | 9499.0 at 2026-11-27 13:00 UTC |
| 4068 | 50Hertz | 2014-12-28 23:00 UTC | 785.6 at 2026-11-27 13:00 UTC |
| 4068 | Amprion | 2014-12-28 23:00 UTC | 4336.9 at 2026-11-27 12:00 UTC |
| 4068 | TenneT | 2014-12-28 23:00 UTC | 2853.7 at 2026-11-27 12:00 UTC |
| 4068 | TransnetBW | 2014-12-28 23:00 UTC | 458.5 at 2026-11-27 13:00 UTC |
| 4067 | 50Hertz | 2014-12-28 23:00 UTC | 2816.3 at 2026-11-27 13:00 UTC |
| 4067 | Amprion | 2014-12-28 23:00 UTC | 566.2 at 2026-11-27 12:00 UTC |
| 4067 | TenneT | 2014-12-28 23:00 UTC | 1434.9 at 2026-11-27 12:00 UTC |
| 4067 | TransnetBW | 2014-12-28 23:00 UTC | 26.1 at 2026-11-27 13:00 UTC |


## 8. Cross-check, recent day: ENTSO-E against SMARD (GWh)

ENTSO-E energy is mean MW times hours in the day. DE-LU includes Luxembourg.

| Series | ENTSO-E | SMARD | Difference | SMARD hours |
|---|---|---|---|---|
| Load | 1624.7 | 1607.8 | 1.1% | 24 |
| Solar | 89.4 | 84.5 | 5.7% | 24 |
| Wind onshore | 390.1 | 387.8 | 0.6% | 24 |
| Wind offshore | 141.6 | 141.6 | -0.0% | 24 |
| Lignite | 266.1 | 266.1 | 0.0% | 24 |
| Gas | 367.4 | 367.2 | 0.0% | 24 |

