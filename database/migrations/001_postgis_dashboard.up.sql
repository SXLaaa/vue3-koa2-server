BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE auth_user (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(64) NOT NULL,
  password_hash TEXT NOT NULL,
  display_name VARCHAR(128) NOT NULL DEFAULT '',
  roles JSONB NOT NULL DEFAULT '[]'::jsonb,
  status SMALLINT NOT NULL DEFAULT 1 CHECK (status IN (0, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (btrim(username) <> ''),
  CHECK (jsonb_typeof(roles) = 'array')
);
CREATE UNIQUE INDEX auth_user_username_uq ON auth_user (lower(username));

CREATE TABLE dashboard_payload (
  id BIGSERIAL PRIMARY KEY,
  module_key VARCHAR(32) NOT NULL,
  sub_id VARCHAR(64) NOT NULL,
  endpoint_key VARCHAR(96) NOT NULL,
  year SMALLINT,
  half_year SMALLINT,
  crop VARCHAR(32),
  observation_date DATE,
  district_code VARCHAR(16),
  request_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (module_key IN ('farmland', 'security', 'warning')),
  CHECK (btrim(sub_id) <> '' AND btrim(endpoint_key) <> ''),
  CHECK (year IS NULL OR year BETWEEN 1900 AND 2200),
  CHECK (half_year IS NULL OR half_year IN (1, 2)),
  CHECK (jsonb_typeof(request_context) = 'object'),
  CHECK (jsonb_typeof(payload) IN ('object', 'array'))
);
-- 查询维度允许为空，因此用 COALESCE 建立可重复种子和接口查找的唯一键。
CREATE UNIQUE INDEX dashboard_payload_lookup_uq ON dashboard_payload (
  module_key,
  sub_id,
  endpoint_key,
  COALESCE(year, 0),
  COALESCE(half_year, 0),
  COALESCE(crop, ''),
  COALESCE(observation_date, DATE '1900-01-01'),
  COALESCE(district_code, '')
);
CREATE INDEX dashboard_payload_query_idx ON dashboard_payload (
  module_key, sub_id, endpoint_key, year, half_year, crop, observation_date, district_code
);

CREATE TABLE screen_timeline (
  id BIGSERIAL PRIMARY KEY,
  module_key VARCHAR(32) NOT NULL,
  sub_id VARCHAR(64) NOT NULL,
  timeline_type VARCHAR(32) NOT NULL DEFAULT 'business',
  year SMALLINT NOT NULL,
  half_year SMALLINT,
  crop VARCHAR(32),
  observation_date DATE,
  stage VARCHAR(64),
  label VARCHAR(128) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT FALSE,
  CHECK (module_key IN ('farmland', 'security', 'warning')),
  CHECK (year BETWEEN 1900 AND 2200),
  CHECK (half_year IS NULL OR half_year IN (1, 2)),
  CHECK (btrim(sub_id) <> '' AND btrim(label) <> '')
);
CREATE UNIQUE INDEX screen_timeline_lookup_uq ON screen_timeline (
  module_key,
  sub_id,
  timeline_type,
  year,
  COALESCE(half_year, 0),
  COALESCE(crop, ''),
  COALESCE(observation_date, DATE '1900-01-01'),
  COALESCE(stage, '')
);
CREATE INDEX screen_timeline_query_idx ON screen_timeline (
  module_key, sub_id, crop, year, half_year, observation_date, sort_order
);

CREATE TABLE map_service (
  id BIGSERIAL PRIMARY KEY,
  module_key VARCHAR(32) NOT NULL,
  sub_id VARCHAR(64) NOT NULL,
  category VARCHAR(64) NOT NULL,
  year SMALLINT,
  half_year SMALLINT,
  crop VARCHAR(32),
  stage VARCHAR(64),
  observation_date DATE,
  server VARCHAR(32) NOT NULL DEFAULT 'local',
  service_type VARCHAR(16) NOT NULL DEFAULT 'wms',
  service_url TEXT NOT NULL,
  layer_name VARCHAR(256),
  style_name VARCHAR(128),
  fallback_srs VARCHAR(32) NOT NULL DEFAULT 'EPSG:4326',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CHECK (module_key IN ('farmland', 'security', 'warning')),
  CHECK (year IS NULL OR year BETWEEN 1900 AND 2200),
  CHECK (half_year IS NULL OR half_year IN (1, 2)),
  CHECK (service_type IN ('wms', 'xyz', 'image', 'none')),
  CHECK (btrim(sub_id) <> '' AND btrim(category) <> '' AND btrim(server) <> ''),
  CHECK (btrim(service_url) <> ''),
  CHECK (jsonb_typeof(metadata) = 'object')
);
-- server 是服务选择维度；URL 和图层名始终作为数据保存，不固化到前端代码。
CREATE UNIQUE INDEX map_service_lookup_uq ON map_service (
  module_key,
  sub_id,
  category,
  COALESCE(year, 0),
  COALESCE(half_year, 0),
  COALESCE(crop, ''),
  COALESCE(stage, ''),
  COALESCE(observation_date, DATE '1900-01-01'),
  server
);
CREATE INDEX map_service_query_idx ON map_service (
  module_key, sub_id, category, year, half_year, crop, stage, observation_date, server
);

CREATE TABLE administrative_region (
  id BIGSERIAL PRIMARY KEY,
  region_code VARCHAR(16) NOT NULL UNIQUE,
  parent_code VARCHAR(16),
  name VARCHAR(128) NOT NULL,
  region_level SMALLINT NOT NULL,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  geom geometry(MultiPolygon, 4326) NOT NULL,
  CHECK (btrim(region_code) <> '' AND btrim(name) <> ''),
  CHECK (region_level BETWEEN 1 AND 5),
  CHECK (jsonb_typeof(properties) = 'object'),
  CHECK (ST_SRID(geom) = 4326),
  CHECK (GeometryType(geom) = 'MULTIPOLYGON'),
  CHECK (ST_IsValid(geom) AND NOT ST_IsEmpty(geom))
);
CREATE INDEX administrative_region_geom_gist ON administrative_region USING GIST (geom);
CREATE INDEX administrative_region_parent_idx ON administrative_region (parent_code, region_level);

CREATE TABLE agricultural_feature (
  id BIGSERIAL PRIMARY KEY,
  feature_key VARCHAR(160) NOT NULL UNIQUE,
  source_id VARCHAR(128),
  module_key VARCHAR(32) NOT NULL,
  sub_id VARCHAR(64) NOT NULL,
  category VARCHAR(64) NOT NULL,
  year SMALLINT,
  half_year SMALLINT,
  crop VARCHAR(32),
  stage VARCHAR(64),
  observation_date DATE,
  district_code VARCHAR(16),
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  geom geometry(MultiPolygon, 4326) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (module_key IN ('farmland', 'security', 'warning')),
  CHECK (btrim(feature_key) <> '' AND btrim(sub_id) <> '' AND btrim(category) <> ''),
  CHECK (year IS NULL OR year BETWEEN 1900 AND 2200),
  CHECK (half_year IS NULL OR half_year IN (1, 2)),
  CHECK (jsonb_typeof(properties) = 'object'),
  CHECK (ST_SRID(geom) = 4326),
  CHECK (GeometryType(geom) = 'MULTIPOLYGON'),
  CHECK (ST_IsValid(geom) AND NOT ST_IsEmpty(geom))
);
CREATE INDEX agricultural_feature_geom_gist ON agricultural_feature USING GIST (geom);
CREATE INDEX agricultural_feature_lookup_idx ON agricultural_feature (
  module_key, sub_id, category, year, half_year, crop, stage, observation_date, district_code
);

-- 将 Polygon/MultiPolygon 修复、升维并转换到 4326；导入工具和人工 SQL 共用这一入口。
CREATE OR REPLACE FUNCTION main_grain_normalize_geometry(input_geom geometry, source_srid INTEGER)
RETURNS geometry(MultiPolygon, 4326)
LANGUAGE plpgsql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
DECLARE
  normalized geometry;
BEGIN
  IF source_srid <= 0 THEN
    RAISE EXCEPTION 'source_srid must be a positive EPSG code';
  END IF;
  IF ST_SRID(input_geom) NOT IN (0, source_srid) THEN
    RAISE EXCEPTION 'geometry SRID % does not match declared SRID %', ST_SRID(input_geom), source_srid;
  END IF;

  normalized := CASE
    WHEN ST_SRID(input_geom) = 0 THEN ST_SetSRID(input_geom, source_srid)
    ELSE input_geom
  END;
  IF source_srid <> 4326 THEN
    normalized := ST_Transform(normalized, 4326);
  END IF;
  normalized := ST_Multi(ST_CollectionExtract(ST_MakeValid(normalized), 3));

  IF ST_IsEmpty(normalized) THEN
    RAISE EXCEPTION 'geometry has no polygon component after normalization';
  END IF;
  RETURN normalized::geometry(MultiPolygon, 4326);
END;
$$;

-- 面积统一按 geography 椭球模型计算，返回公顷，避免直接对经纬度 geometry 求面积。
CREATE OR REPLACE FUNCTION main_grain_area_hectares(input_geom geometry)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
  SELECT round((ST_Area(input_geom::geography) / 10000.0)::numeric, 4);
$$;

-- 代表性空间汇总同时验证相交、包含、交集和 geography 面积四项冻结能力。
CREATE OR REPLACE FUNCTION main_grain_spatial_summary(
  requested_region_code TEXT,
  requested_module_key TEXT DEFAULT NULL,
  requested_sub_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  intersecting_count BIGINT,
  within_count BIGINT,
  feature_area_hectares NUMERIC,
  intersection_area_hectares NUMERIC
)
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  WITH selected_region AS (
    SELECT geom
    FROM administrative_region
    WHERE region_code = requested_region_code
  ),
  intersecting AS (
    SELECT
      feature.geom AS feature_geom,
      region.geom AS region_geom,
      ST_Intersection(feature.geom, region.geom) AS clipped_geom
    FROM agricultural_feature AS feature
    CROSS JOIN selected_region AS region
    WHERE ST_Intersects(feature.geom, region.geom)
      AND (requested_module_key IS NULL OR feature.module_key = requested_module_key)
      AND (requested_sub_id IS NULL OR feature.sub_id = requested_sub_id)
  )
  SELECT
    count(*)::BIGINT,
    count(*) FILTER (WHERE ST_Within(feature_geom, region_geom))::BIGINT,
    COALESCE(round((sum(ST_Area(feature_geom::geography)) / 10000.0)::numeric, 4), 0),
    COALESCE(round((sum(ST_Area(clipped_geom::geography)) / 10000.0)::numeric, 4), 0)
  FROM intersecting;
$$;

COMMENT ON FUNCTION main_grain_normalize_geometry(geometry, INTEGER) IS '导入几何修复、升维和 SRID 4326 归一化入口';
COMMENT ON FUNCTION main_grain_area_hectares(geometry) IS '使用 geography 椭球面积返回公顷';
COMMENT ON FUNCTION main_grain_spatial_summary(TEXT, TEXT, TEXT) IS '按行政区统计相交、包含及交集面积';

COMMIT;
