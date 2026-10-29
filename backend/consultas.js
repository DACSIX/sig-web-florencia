// ===============================================================
// consultas.js — Consultas SQL espaciales de la API
// ===============================================================

// Barrios de Florencia como FeatureCollection GeoJSON.
// Origen: public.barrios, SRID 3115 (MAGNA-SIRGAS / Colombia Oeste, metros).
// Salida: WGS84 (EPSG:4326), como exige GeoJSON (RFC 7946).
export const SQL_BARRIOS_GEOJSON = `
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
  SELECT json_build_object(
    'type', 'FeatureCollection',
    'features', COALESCE(json_agg(feature ORDER BY gid), '[]'::json)
  ) AS geojson
  FROM features;
`;