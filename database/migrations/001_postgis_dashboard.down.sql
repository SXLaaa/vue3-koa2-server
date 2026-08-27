BEGIN;

DROP FUNCTION IF EXISTS main_grain_spatial_summary(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS main_grain_area_hectares(geometry);
DROP FUNCTION IF EXISTS main_grain_normalize_geometry(geometry, INTEGER);

DROP TABLE IF EXISTS agricultural_feature;
DROP TABLE IF EXISTS administrative_region;
DROP TABLE IF EXISTS map_service;
DROP TABLE IF EXISTS screen_timeline;
DROP TABLE IF EXISTS dashboard_payload;
DROP TABLE IF EXISTS auth_user;

-- PostGIS 扩展可能由同库其他业务共享，回滚仅移除本迁移对象，不删除扩展。
COMMIT;
