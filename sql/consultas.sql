/*Activar modo lectura*/
SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;

/*Confirmar el SIRD y ver la cantidad de barrios*/
SELECT ST_SRID(geom) AS srid, COUNT(*) AS cantidad
FROM public.barrios
GROUP BY ST_SRID(geom);

/*transformacion de datos al sistema de coordenadas WGS84*/
SELECT gid, nombre, ST_Transform(geom, 4326) AS geom
FROM public.barrios;

/*Comparar coordenadas antes y despues de transfomrar*/
SELECT nombre,
       ST_AsText(ST_PointOnSurface(geom))                     AS punto_en_metros_3115,
       ST_AsText(ST_PointOnSurface(ST_Transform(geom, 4326))) AS punto_en_grados_4326
FROM public.barrios
ORDER BY gid
LIMIT 3;

/*Solo geometria geojson*/
SELECT gid, nombre,
       ST_AsGeoJSON(ST_Transform(geom, 4326), 6) AS geometria
FROM public.barrios
ORDER BY gid
LIMIT 1;

/*Un barrio como feature*/
SELECT json_build_object(
  'type', 'Feature',
  'id', gid,
  'geometry', ST_AsGeoJSON(ST_Transform(geom, 4326), 6)::json,
  'properties', json_build_object(
    'gid',        gid,
    'objectid',   objectid,
    'nombre',     nombre,
    'cod_comuna', cod_comuna,
    'cod_barrio', cod_barrio,
    'shape_leng', shape_leng,
    'shape_area', shape_area
  )
) AS feature
FROM public.barrios
ORDER BY gid
LIMIT 1;

/*Consulta que se ejecutara en la API*/
WITH barrios_wgs84 AS (
  -- 1. Transformar de MAGNA-SIRGAS Oeste (3115, metros) a WGS84 (4326, grados)
  SELECT gid, objectid, nombre, cod_comuna, cod_barrio, shape_leng, shape_area,
         ST_Transform(geom, 4326) AS geom
  FROM public.barrios
),
features AS (
  -- 2. Convertir cada fila en un Feature GeoJSON
  SELECT gid,
         json_build_object(
           'type', 'Feature',
           'id', gid,
           'geometry', ST_AsGeoJSON(geom, 6)::json,
           'properties', json_build_object(
             'gid',        gid,
             'objectid',   objectid,
             'nombre',     nombre,
             'cod_comuna', cod_comuna,
             'cod_barrio', cod_barrio,
             'shape_leng', shape_leng,
             'shape_area', shape_area
           )
         ) AS feature
  FROM barrios_wgs84
)
-- 3. Agrupar todos los Features en una FeatureCollection
SELECT json_build_object(
  'type', 'FeatureCollection',
  'features', COALESCE(json_agg(feature ORDER BY gid), '[]'::json)
) AS geojson
FROM features;

/*Verificar cuantos barrios trae y cuanto pesa*/
WITH barrios_wgs84 AS (
  SELECT gid, objectid, nombre, cod_comuna, cod_barrio, shape_leng, shape_area,
         ST_Transform(geom, 4326) AS geom
  FROM public.barrios
),
features AS (
  SELECT gid,
         json_build_object(
           'type', 'Feature',
           'id', gid,
           'geometry', ST_AsGeoJSON(geom, 6)::json,
           'properties', json_build_object(
             'gid', gid, 'objectid', objectid, 'nombre', nombre,
             'cod_comuna', cod_comuna, 'cod_barrio', cod_barrio,
             'shape_leng', shape_leng, 'shape_area', shape_area
           )
         ) AS feature
  FROM barrios_wgs84
),
coleccion AS (
  SELECT json_build_object(
    'type', 'FeatureCollection',
    'features', COALESCE(json_agg(feature ORDER BY gid), '[]'::json)
  ) AS geojson
  FROM features
)
SELECT json_array_length(geojson -> 'features')           AS total_features,
       pg_size_pretty(octet_length(geojson::text)::bigint) AS tamano
FROM coleccion;

/*Comprobar que la tabla orginal no cambio*/
SELECT ST_SRID(geom), ST_AsText(ST_PointOnSurface(geom))
FROM public.barrios
ORDER BY gid
LIMIT 1;