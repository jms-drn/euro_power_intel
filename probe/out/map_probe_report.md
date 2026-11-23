# Map probe report

Run at 2026-11-23 19:17 UTC.

## Pluviometros_Total

Type: Table · geometry: None
Fields: zona_nombre (String), pluviometro_id (Double), pluviometro_nombre (String), boletin_num (Integer), boletin_anyo (Integer), Precipitacion (Double), Orden_Semana (Integer), Años (String), Fecha (Date), OBJECTID (OID)
Rows: 101894
Date field Fecha: 1995-10-03 to 2026-11-17

Latest rows:
    {"zona_nombre": "Cantábrico", "pluviometro_id": 75, "pluviometro_nombre": "Gijón", "boletin_num": 46, "boletin_anyo": 2026, "Precipitacion": 17, "Orden_Semana": 7, "Años": "2026 - 2027", "Fecha": "2026-11-17", "OBJECTID": 44}
    {"zona_nombre": "Duero", "pluviometro_id": 20, "pluviometro_nombre": "Zamora", "boletin_num": 46, "boletin_anyo": 2026, "Precipitacion": 97, "Orden_Semana": 7, "Años": "2026 - 2027", "Fecha": "2026-11-17", "OBJECTID": 45}
    {"zona_nombre": "Ebro", "pluviometro_id": 74, "pluviometro_nombre": "Daroca I", "boletin_num": 46, "boletin_anyo": 2026, "Precipitacion": 13, "Orden_Semana": 7, "Años": "2026 - 2027", "Fecha": "2026-11-17", "OBJECTID": 46}

## Pluviometros_Mapa

Type: Feature Layer · geometry: esriGeometryPoint
Fields: OBJECTID_1 (Integer), PLUVIOMETRO_ID (Double), OBJECTID (OID), zona_nombre (String), pluviometro_id_1 (Double), pluviometro_nombre (String), boletin_num (Integer), boletin_anyo (Integer), Precipitacion (Double), Orden_Semana (Integer), Años (String), Fecha (Date)
Rows: 65
Date field Fecha: 2026-11-17 to 2026-11-17

Latest rows:
    {"OBJECTID_1": 10, "PLUVIOMETRO_ID": 5, "OBJECTID": 1, "zona_nombre": "Cuencas Internas del País Vasco", "pluviometro_id_1": 5, "pluviometro_nombre": "Bilbao (A) - Bilbo (A)", "boletin_num": 46, "boletin_anyo": 2026, "Precipitacion": 49.4, "Orden_Semana": 7, "Años": "2026 - 2027", "Fecha": "2026-11-17"}
    {"OBJECTID_1": 22, "PLUVIOMETRO_ID": 11, "OBJECTID": 2, "zona_nombre": "Galicia Costa", "pluviometro_id_1": 11, "pluviometro_nombre": "Vigo (A)", "boletin_num": 46, "boletin_anyo": 2026, "Precipitacion": 199.1, "Orden_Semana": 7, "Años": "2026 - 2027", "Fecha": "2026-11-17"}
    {"OBJECTID_1": 59, "PLUVIOMETRO_ID": 27, "OBJECTID": 3, "zona_nombre": "Tajo", "pluviometro_id_1": 27, "pluviometro_nombre": "Molina de Aragón", "boletin_num": 46, "boletin_anyo": 2026, "Precipitacion": 23, "Orden_Semana": 7, "Años": "2026 - 2027", "Fecha": "2026-11-17"}

GeoJSON with simplified geometry: 7468 characters. Start: {"type":"FeatureCollection","crs":{"type":"name","properties":{"name":"EPSG:4326"}},"features":[{"type":"Feature","id":1,"geometry":{"type":"Point","coordinates":[-2.906,43.298]},"properties":{"OBJECT

## DDHH

Type: Feature Layer · geometry: esriGeometryPolygon
Fields: OBJECTID (OID), COD_DEMAR (String), NOM_DEMAR (String), CUENCA_ID (Double), Porc_Agua_Cuenca (Double), Agua (Double), Fecha (Date), area (Double), Shape__Area (Double), Shape__Length (Double)
Rows: 16
Date field Fecha: 2026-11-17 to 2026-11-17

Latest rows:
    {"OBJECTID": 1, "COD_DEMAR": "1", "NOM_DEMAR": "Cuencas Internas de Cataluña", "CUENCA_ID": 1, "Porc_Agua_Cuenca": 77.40029542097489, "Agua": 524, "Fecha": "2026-11-17", "area": 16435.230988510397, "Shape__Area": 16495528416.582275, "Shape__Length": 1201556.3500043207}
    {"OBJECTID": 2, "COD_DEMAR": "2", "NOM_DEMAR": "Miño - Sil", "CUENCA_ID": 2, "Porc_Agua_Cuenca": 46.5016501650165, "Agua": 1409, "Fecha": "2026-11-17", "area": 17559.632580581387, "Shape__Area": 17603357285.55194, "Shape__Length": 1209857.2378917458}
    {"OBJECTID": 3, "COD_DEMAR": "3", "NOM_DEMAR": "Galicia Costa", "CUENCA_ID": 3, "Porc_Agua_Cuenca": 43.71345029239766, "Agua": 299, "Fecha": "2026-11-17", "area": 13028.53899098937, "Shape__Area": 13079513094.614115, "Shape__Length": 2349699.1105573494}

GeoJSON with simplified geometry: 257983 characters. Start: {"type":"FeatureCollection","crs":{"type":"name","properties":{"name":"EPSG:4326"}},"features":[{"type":"Feature","id":1,"geometry":{"type":"MultiPolygon","coordinates":[[[[0.551,40.632],[0.605,40.609

## Embalses_Mapa

Type: Feature Layer · geometry: esriGeometryPoint
Fields: OBJECTID_12 (OID), EMBALSE_ID (Integer), OBJECTID_1 (Integer), EMBALSE_ID_1 (Integer), embalse_id_12 (Integer), embalse_nombre (String), agua_total (Double), agua_actual (Double), ambito_id (Integer), ambito_nombre (String), Años (String), boletin_anyo (Integer), boletin_num (Integer), electrico_flag (Integer), energia_actual (Double), energia_total (Double), Estado_Porc (String), fecha (Date), Fecha_str (String), ID_Unico (String), Orden_Semana (Integer), Porcentaje_Reserva (Double), Uso (String), Variacion_Porcentaje (Double), Variacion_Reserva (Double), Variacion_Energia (Double), Porcentaje_Energia (Double), Variacion_Porcentaje_Energia (Double), Estado_Porcentaje_Energia (String), OBJECTID (Integer), ORIG_FID (Integer)
Rows: 375
Date field fecha: 2026-11-17 to 2026-11-17

Latest rows:
    {"OBJECTID_12": 1, "EMBALSE_ID": 93, "OBJECTID_1": 718992, "EMBALSE_ID_1": 93, "embalse_id_12": 93, "embalse_nombre": "Celemín", "agua_total": 45, "agua_actual": 33, "ambito_id": 15, "ambito_nombre": "Guadalete-Barbate", "Años": "2026 - 2027", "boletin_anyo": 2026, "boletin_num": 46, "electrico_flag": 0, "energia_actual": null, "energia_total": 0, "Estado_Porc": "Positivo", "fecha": "2026-11-17", "Fecha_str": "17112026", "ID_Unico": "9320261117", "Orden_Semana": 7, "Porcentaje_Reserva": 73.33333333333333, "Uso": "Consuntivo", "Variacion_Porcentaje": 0, "Variacion_Reserva": 0, "Variacion_Energia": 0, "Porcentaje_Energia": null, "Variacion_Porcentaje_Energia": 0, "Estado_Porcentaje_Energia": "Positivo", "OBJECTID": 1, "ORIG_FID": 1}
    {"OBJECTID_12": 2, "EMBALSE_ID": 27, "OBJECTID_1": 590714, "EMBALSE_ID_1": 27, "embalse_id_12": 27, "embalse_nombre": "Arcos de la Frontera", "agua_total": 14, "agua_actual": 14, "ambito_id": 15, "ambito_nombre": "Guadalete-Barbate", "Años": "2026 - 2027", "boletin_anyo": 2026, "boletin_num": 46, "electrico_flag": 0, "energia_actual": null, "energia_total": 0, "Estado_Porc": "Positivo", "fecha": "2026-11-17", "Fecha_str": "17112026", "ID_Unico": "2720261117", "Orden_Semana": 7, "Porcentaje_Reserva": 100, "Uso": "Consuntivo", "Variacion_Porcentaje": 7.142857142857139, "Variacion_Reserva": 1, "Variacion_Energia": 0, "Porcentaje_Energia": null, "Variacion_Porcentaje_Energia": 0, "Estado_Porcentaje_Energia": "Positivo", "OBJECTID": 2, "ORIG_FID": 4}
    {"OBJECTID_12": 3, "EMBALSE_ID": 39, "OBJECTID_1": 614011, "EMBALSE_ID_1": 39, "embalse_id_12": 39, "embalse_nombre": "Barbate", "agua_total": 228, "agua_actual": 155, "ambito_id": 15, "ambito_nombre": "Guadalete-Barbate", "Años": "2026 - 2027", "boletin_anyo": 2026, "boletin_num": 46, "electrico_flag": 0, "energia_actual": null, "energia_total": 0, "Estado_Porc": "Positivo", "fecha": "2026-11-17", "Fecha_str": "17112026", "ID_Unico": "3920261117", "Orden_Semana": 7, "Porcentaje_Reserva": 67.98245614035088, "Uso": "Consuntivo", "Variacion_Porcentaje": 0.8771929824561369, "Variacion_Reserva": 2, "Variacion_Energia": 0, "Porcentaje_Energia": null, "Variacion_Porcentaje_Energia": 0, "Estado_Porcentaje_Energia": "Positivo", "OBJECTID": 3, "ORIG_FID": 7}

GeoJSON with simplified geometry: 39999 characters. Start: {"type":"FeatureCollection","crs":{"type":"name","properties":{"name":"EPSG:4326"}},"features":[{"type":"Feature","geometry":{"type":"Point","coordinates":[-5.777,36.3]},"properties":{"OBJECTID":1}},{

## Caudales_Mapa

Type: Feature Layer · geometry: esriGeometryPoint
Fields: OBJECTID_12 (OID), cod_estaci (Integer), Nombre (String), OBJECTID_1 (Integer), cod_estaci_1 (Integer), Nombre_1 (String), estacion_id (Integer), estacion_nombre (String), ambito_id (Integer), rio_id (Integer), orden (String), cabecera (String), date_start (Date), date_end (Date), ttimestamp (String), modified_by (String), notas (String), ambito_nombre (String), caudal (Double), fecha (Date), boletin_anyo (Integer), boletin_num (Integer), Municipio (String), Provincia (String), Rio (String), Situacion (String), Regimen (String), Años (String), Orden_Semana (Integer), Variacion_Caudal (Double), Variacion_Porcentaje (Double), ID_Unico (String), OBJECTID (Integer), caudal_ant (Double), ORIG_FID (Integer)
Rows: 124
Date field date_start: 1988-01-01 to 2021-10-01
Date field date_end: 2099-12-31 to 2099-12-31
Date field fecha: 2026-11-17 to 2026-11-17

Latest rows:
    {"OBJECTID_12": 112, "cod_estaci": 158, "Nombre": "Villar", "OBJECTID_1": 122130, "cod_estaci_1": 158, "Nombre_1": "Villar", "estacion_id": 158, "estacion_nombre": "El Villar", "ambito_id": 5, "rio_id": 87, "orden": "6,00", "cabecera": null, "date_start": "2021-10-01", "date_end": "2099-12-31", "ttimestamp": "08-09-2021 12:29:34,017000", "modified_by": "airigoyen", "notas": "Se da de alta para el anuario 2021-2022.", "ambito_nombre": "Guadalquivir", "caudal": 5.37, "fecha": "2026-11-17", "boletin_anyo": 2026, "boletin_num": 46, "Municipio": "Écija", "Provincia": "Sevilla", "Rio": "Genil", "Situacion": "Río", "Regimen": " ", "Años": "2026 - 2027", "Orden_Semana": 7, "Variacion_Caudal": 2.73, "Variacion_Porcentaje": 103.4090909090909, "ID_Unico": "15820261117", "OBJECTID": 112, "caudal_ant": 2.59, "ORIG_FID": 353}
    {"OBJECTID_12": 113, "cod_estaci": 159, "Nombre": "Calasparra", "OBJECTID_1": 117850, "cod_estaci_1": 159, "Nombre_1": "Calasparra", "estacion_id": 159, "estacion_nombre": "Calasparra", "ambito_id": 7, "rio_id": 200, "orden": "1,00", "cabecera": null, "date_start": "2021-10-01", "date_end": "2099-12-31", "ttimestamp": "21-09-2021 12:46:00,373000", "modified_by": "jgpina", "notas": "Se da de alta por indicación de la CHS.", "ambito_nombre": "Segura", "caudal": 17.54, "fecha": "2026-11-17", "boletin_anyo": 2026, "boletin_num": 46, "Municipio": "Calasparra", "Provincia": "Murcia", "Rio": "Segura", "Situacion": "Río", "Regimen": "Alterado", "Años": "2026 - 2027", "Orden_Semana": 7, "Variacion_Caudal": 3.5, "Variacion_Porcentaje": 24.92877492877493, "ID_Unico": "15920261117", "OBJECTID": 113, "caudal_ant": 17.12, "ORIG_FID": 357}
    {"OBJECTID_12": 114, "cod_estaci": 160, "Nombre": "Contraparada", "OBJECTID_1": 118100, "cod_estaci_1": 160, "Nombre_1": "Contraparada", "estacion_id": 160, "estacion_nombre": "Contraparada", "ambito_id": 7, "rio_id": 200, "orden": "2,00", "cabecera": null, "date_start": "2021-10-01", "date_end": "2099-12-31", "ttimestamp": "21-09-2021 12:46:42,827000", "modified_by": "jgpina", "notas": "Se da de alta por indicación de la CHS.", "ambito_nombre": "Segura", "caudal": 9.22, "fecha": "2026-11-17", "boletin_anyo": 2026, "boletin_num": 46, "Municipio": "Molina de Segura", "Provincia": "Murcia", "Rio": "Segura", "Situacion": "Río", "Regimen": "Alterado", "Años": "2026 - 2027", "Orden_Semana": 7, "Variacion_Caudal": -0.6399999999999988, "Variacion_Porcentaje": -6.490872210953335, "ID_Unico": "16020261117", "OBJECTID": 114, "caudal_ant": 8.6, "ORIG_FID": 360}

GeoJSON with simplified geometry: 13225 characters. Start: {"type":"FeatureCollection","crs":{"type":"name","properties":{"name":"EPSG:4326"}},"features":[{"type":"Feature","geometry":{"type":"Point","coordinates":[-2.026,43.228]},"properties":{"OBJECTID":1}}

