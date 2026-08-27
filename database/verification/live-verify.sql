\set ON_ERROR_STOP on

DO $$
DECLARE
  expected_tables TEXT[] := ARRAY[
    'auth_user',
    'dashboard_payload',
    'screen_timeline',
    'map_service',
    'administrative_region',
    'agricultural_feature'
  ];
  table_name TEXT;
  actual_count INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    RAISE EXCEPTION 'PostGIS extension is missing';
  END IF;

  FOREACH table_name IN ARRAY expected_tables LOOP
    IF to_regclass('public.' || table_name) IS NULL THEN
      RAISE EXCEPTION 'required table is missing: %', table_name;
    END IF;
  END LOOP;

  SELECT count(*) INTO actual_count
  FROM geometry_columns
  WHERE f_table_schema = 'public'
    AND f_table_name IN ('administrative_region', 'agricultural_feature')
    AND type = 'MULTIPOLYGON'
    AND srid = 4326;
  IF actual_count <> 2 THEN
    RAISE EXCEPTION 'expected two MultiPolygon/4326 columns, got %', actual_count;
  END IF;

  SELECT count(*) INTO actual_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND indexname IN ('administrative_region_geom_gist', 'agricultural_feature_geom_gist')
    AND indexdef ILIKE '%USING gist%';
  IF actual_count <> 2 THEN
    RAISE EXCEPTION 'expected two GiST indexes, got %', actual_count;
  END IF;

  SELECT count(DISTINCT endpoint_key) INTO actual_count FROM dashboard_payload;
  IF actual_count <> 33 THEN
    RAISE EXCEPTION 'expected 33 seeded endpoints, got %', actual_count;
  END IF;

  SELECT count(*) INTO actual_count
  FROM (SELECT DISTINCT module_key, sub_id FROM dashboard_payload) AS pages;
  IF actual_count <> 12 THEN
    RAISE EXCEPTION 'expected 12 seeded pages, got %', actual_count;
  END IF;

  SELECT count(*) INTO actual_count FROM screen_timeline;
  IF actual_count < 12 THEN
    RAISE EXCEPTION 'expected timeline lookup coverage for 12 pages, got %', actual_count;
  END IF;

  SELECT count(*) INTO actual_count FROM map_service;
  IF actual_count < 10 THEN
    RAISE EXCEPTION 'expected map-service lookup coverage for 10 map-enabled pages, got %', actual_count;
  END IF;

  SELECT count(*) INTO actual_count
  FROM map_service
  WHERE module_key = 'security' AND sub_id = 'plantingTask';
  IF actual_count <> 0 THEN
    RAISE EXCEPTION 'plantingTask map-service lookup must be empty, got %', actual_count;
  END IF;

  SELECT count(*) INTO actual_count
  FROM dashboard_payload
  WHERE module_key = 'security'
    AND sub_id = 'plantingTask'
    AND endpoint_key = 'getVectorTableWms';
  IF actual_count <> 0 THEN
    RAISE EXCEPTION 'plantingTask getVectorTableWms payload lookup must be empty, got %', actual_count;
  END IF;

  SELECT count(*) INTO actual_count FROM agricultural_feature;
  IF actual_count < 2 THEN
    RAISE EXCEPTION 'expected representative spatial features, got %', actual_count;
  END IF;
END;
$$;

\ir spatial-fixture.sql
