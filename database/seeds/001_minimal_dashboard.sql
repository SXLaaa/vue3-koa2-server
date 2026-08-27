BEGIN;

-- 33 个接口各保留一条可展示的最小响应，并确保 12 个页面均有主记录。
WITH endpoint_seed(module_key, sub_id, endpoint_key) AS (
  VALUES
    ('farmland', 'cultivatedLand', 'queryQingDaoTotalArea'),
    ('farmland', 'cultivatedLand', 'queryQingDaoGroupByYear'),
    ('farmland', 'greenGrain', 'queryDemonstrationSubjectDetail'),
    ('farmland', 'highStandard', 'queryQingDaoGroupByArea'),
    ('farmland', 'basicProtection', 'queryProtectionMonitoringTotal'),
    ('farmland', 'basicProtection', 'queryProtectionMonitoringByArea'),
    ('farmland', 'highStandard', 'getVectorTableWms'),
    ('farmland', 'cultivatedLand', 'getTimeLine'),
    ('farmland', 'greenGrain', 'queryGreenGrainIncreaseStatistics'),
    ('farmland', 'greenGrain', 'queryGreenGrainIncreaseList'),
    ('farmland', 'greenGrain', 'queryGreenGrainIncreaseStatisticsByArea'),
    ('farmland', 'cultivatedLand', 'queryReportList'),
    ('security', 'plantingTask', 'queryPlantingTaskStatistics'),
    ('security', 'plantingTask', 'queryPlantingTaskByArea'),
    ('security', 'plantingTask', 'statisticsPlantingTaskByArea'),
    ('security', 'cropDistribution', 'queryProtectionMonitoringByYear'),
    ('security', 'yieldEstimate', 'statisticsYield'),
    ('security', 'yieldEstimate', 'queryYieldTotalByYear'),
    ('security', 'yieldEstimate', 'queryYieldTotalByArea'),
    ('warning', 'growthStage', 'getReproductiveTimeLine'),
    ('warning', 'growthStage', 'queryReproductiveAnalysis'),
    ('warning', 'growth', 'queryGrowthBarChart'),
    ('warning', 'growth', 'queryGrowthAnalysisByYear'),
    ('warning', 'maturity', 'getMaturityStageByDate'),
    ('warning', 'maturity', 'queryMaturityStageByYear'),
    ('warning', 'seedling', 'queryReproductivePeriodByDate'),
    ('warning', 'maturity', 'queryBestHarvestTime'),
    ('warning', 'weatherDisaster', 'queryDisasterStatistics'),
    ('warning', 'seedling', 'queryCropType'),
    ('warning', 'weatherDisaster', 'queryWeather'),
    ('warning', 'seedling', 'querySeedlingConditionAnalysis'),
    ('farmland', 'greenGrain', 'queryByKeyword'),
    ('warning', 'weatherDisaster', 'queryPestWarningByDate')
),
prepared AS (
  SELECT
    module_key,
    sub_id,
    endpoint_key,
    2026::SMALLINT AS year,
    CASE WHEN module_key = 'warning' THEN NULL ELSE 1::SMALLINT END AS half_year,
    CASE WHEN sub_id IN ('cropDistribution', 'yieldEstimate', 'growthStage', 'seedling') THEN '小麦' END AS crop,
    CASE WHEN module_key = 'warning' THEN DATE '2026-05-25' END AS observation_date,
    '370200'::VARCHAR AS district_code,
    CASE
      WHEN endpoint_key LIKE 'queryGreenGrain%' OR endpoint_key = 'queryByKeyword'
        THEN '{"subjectTypeList":[1,2,3]}'::jsonb
      WHEN sub_id IN ('cropDistribution', 'yieldEstimate')
        THEN '{"cropType":0,"typeName":"小麦","unit":2,"lastYear":"halfYear"}'::jsonb
      ELSE '{}'::jsonb
    END AS request_context,
    CASE
      WHEN endpoint_key = 'queryReportList' THEN
        jsonb_build_object('code', 200, 'msg', '本地最小种子', 'total', 1, 'rows', jsonb_build_array(jsonb_build_object('title', '本地示例报告')))
      WHEN endpoint_key = 'getVectorTableWms' THEN
        jsonb_build_object('code', 200, 'msg', '{"serviceType":"WMS","url":"/geoserver/main-grain/wms"}')
      WHEN endpoint_key = 'queryMaturityStageByYear' THEN
        jsonb_build_object('code', 200, 'msg', '本地最小种子', 'data', jsonb_build_array(jsonb_build_object('name', '青岛市', 'veryDad', 88)))
      WHEN endpoint_key = 'queryCropType' THEN
        jsonb_build_object('code', 200, 'msg', '本地最小种子', 'data', jsonb_build_array(
          jsonb_build_object('name', '小麦', 'value', 0),
          jsonb_build_object('name', '玉米', 'value', 1)
        ))
      WHEN endpoint_key IN (
        'getTimeLine',
        'queryGreenGrainIncreaseStatistics',
        'queryGreenGrainIncreaseList',
        'queryGreenGrainIncreaseStatisticsByArea',
        'queryPlantingTaskByArea',
        'queryYieldTotalByYear',
        'queryYieldTotalByArea',
        'querySeedlingConditionAnalysis',
        'queryByKeyword'
      ) THEN jsonb_build_object('code', 200, 'msg', '本地最小种子', 'data', '[]'::jsonb)
      ELSE jsonb_build_object(
        'code', 200,
        'msg', '本地最小种子',
        'data', jsonb_build_object('seed', true, 'moduleKey', module_key, 'subId', sub_id)
      )
    END AS payload
  FROM endpoint_seed
)
INSERT INTO dashboard_payload (
  module_key, sub_id, endpoint_key, year, half_year, crop, observation_date,
  district_code, request_context, payload
)
SELECT
  module_key, sub_id, endpoint_key, year, half_year, crop, observation_date,
  district_code, request_context, payload
FROM prepared
ON CONFLICT DO NOTHING;

-- 每个页面一条稳定时间轴记录；后续替换时按页面、作物、年月日维度写入更多记录。
INSERT INTO screen_timeline (
  module_key, sub_id, timeline_type, year, half_year, crop, observation_date,
  stage, label, sort_order, active
)
VALUES
  ('farmland', 'cultivatedLand', 'business', 2026, 1, NULL, NULL, NULL, '2026 上半年', 10, TRUE),
  ('farmland', 'highStandard', 'business', 2026, 1, NULL, NULL, NULL, '2026 上半年', 10, TRUE),
  ('farmland', 'basicProtection', 'business', 2026, 1, NULL, NULL, NULL, '2026 上半年', 10, TRUE),
  ('farmland', 'greenGrain', 'business', 2026, 1, NULL, NULL, NULL, '2026 上半年', 10, TRUE),
  ('security', 'plantingTask', 'business', 2026, 1, NULL, NULL, NULL, '2026 上半年', 10, TRUE),
  ('security', 'cropDistribution', 'business', 2026, 1, '小麦', NULL, NULL, '2026 小麦', 10, TRUE),
  ('security', 'yieldEstimate', 'business', 2026, 1, '小麦', NULL, NULL, '2026 小麦', 10, TRUE),
  ('warning', 'growthStage', 'reproductive', 2026, NULL, '小麦', DATE '2026-05-25', '灌浆期', '2026-05-25 灌浆期', 10, TRUE),
  ('warning', 'seedling', 'reproductive', 2026, NULL, '小麦', DATE '2026-05-15', '拔节期', '2026-05-15 拔节期', 10, TRUE),
  ('warning', 'growth', 'reproductive', 2026, NULL, '小麦', DATE '2026-05-15', '拔节期', '2026-05-15 拔节期', 10, TRUE),
  ('warning', 'maturity', 'reproductive', 2026, NULL, '小麦', DATE '2026-06-05', '成熟期', '2026-06-05 成熟期', 10, TRUE),
  ('warning', 'weatherDisaster', 'reproductive', 2026, NULL, '小麦', DATE '2026-05-15', '拔节期', '2026-05-15 拔节期', 10, TRUE)
ON CONFLICT DO NOTHING;

-- 使用相对或本地占位 URL，既能验证查找维度，又不会把客户服务地址写入代码。
-- 清理 Attempt 1 曾写入的种植任务占位服务；该页面由区县统计在前端着色，地图查询应为空。
DELETE FROM map_service
WHERE module_key = 'security'
  AND sub_id = 'plantingTask'
  AND category = 'planting_task'
  AND server = 'local'
  AND metadata @> '{"seed":true}'::jsonb;

INSERT INTO map_service (
  module_key, sub_id, category, year, half_year, crop, stage, observation_date,
  server, service_type, service_url, layer_name, fallback_srs, metadata
)
VALUES
  ('farmland', 'cultivatedLand', 'farmland_monitoring', 2026, 1, NULL, NULL, NULL, 'local', 'wms', '/geoserver/main-grain/wms', 'main_grain:farmland_monitoring_2026', 'EPSG:4326', '{"seed":true}'),
  ('farmland', 'highStandard', 'high_standard_farmland', 2026, 1, NULL, NULL, NULL, 'local', 'wms', '/geoserver/main-grain/wms', 'main_grain:high_standard_farmland_2026', 'EPSG:4326', '{"seed":true}'),
  ('farmland', 'basicProtection', 'protection_monitoring', 2026, 1, NULL, NULL, NULL, 'local', 'wms', '/geoserver/main-grain/wms', 'main_grain:protection_monitoring_2026', 'EPSG:4326', '{"seed":true}'),
  ('security', 'cropDistribution', 'crop_distribution', 2026, 1, '小麦', NULL, NULL, 'local', 'wms', '/geoserver/main-grain/wms', 'main_grain:crop_distribution_2026_xm', 'EPSG:4326', '{"seed":true}'),
  ('security', 'yieldEstimate', 'crop_yield', 2026, 1, '小麦', NULL, NULL, 'local', 'wms', '/geoserver/main-grain/wms', 'main_grain:crop_yield_2026_xm', 'EPSG:4326', '{"seed":true}'),
  ('warning', 'growthStage', 'reproductive_period', 2026, NULL, '小麦', '灌浆期', DATE '2026-05-25', 'local', 'wms', '/geoserver/main-grain/wms', 'main_grain:reproductive_period_20260525_xm', 'EPSG:4326', '{"seed":true}'),
  ('warning', 'seedling', 'seedling_condition', 2026, NULL, '小麦', '拔节期', DATE '2026-05-15', 'local', 'wms', '/geoserver/main-grain/wms', 'main_grain:seedling_condition_20260515_xm', 'EPSG:4326', '{"seed":true}'),
  ('warning', 'growth', 'growth_analysis', 2026, NULL, '小麦', '拔节期', DATE '2026-05-15', 'local', 'xyz', '/local-map/growth/{z}/{x}/{y}.png', NULL, 'EPSG:4326', '{"seed":true}'),
  ('warning', 'maturity', 'maturation_prediction', 2026, NULL, '小麦', '成熟期', DATE '2026-06-05', 'local', 'image', '/local-map/maturity/2026-06-05.png', NULL, 'EPSG:4326', '{"seed":true}'),
  ('warning', 'weatherDisaster', 'meteorological_warning', 2026, NULL, '小麦', '拔节期', DATE '2026-05-15', 'local', 'image', '/local-map/weather/2026-05-15.png', NULL, 'EPSG:4326', '{"seed":true}')
ON CONFLICT DO NOTHING;

INSERT INTO administrative_region (region_code, parent_code, name, region_level, properties, geom)
VALUES
  ('370200', NULL, '青岛市', 2, '{"seed":true}', ST_GeomFromText('MULTIPOLYGON(((119.50 35.50,121.50 35.50,121.50 37.20,119.50 37.20,119.50 35.50)))', 4326)),
  ('370215', '370200', '即墨区示例', 3, '{"seed":true}', ST_GeomFromText('MULTIPOLYGON(((120.10 36.25,120.80 36.25,120.80 36.80,120.10 36.80,120.10 36.25)))', 4326)),
  ('370281', '370200', '胶州市示例', 3, '{"seed":true}', ST_GeomFromText('MULTIPOLYGON(((119.70 36.00,120.30 36.00,120.30 36.50,119.70 36.50,119.70 36.00)))', 4326))
ON CONFLICT (region_code) DO UPDATE SET
  parent_code = EXCLUDED.parent_code,
  name = EXCLUDED.name,
  region_level = EXCLUDED.region_level,
  properties = EXCLUDED.properties,
  geom = EXCLUDED.geom;

-- 一条完全位于即墨示例区，另一条跨越胶州示例区边界，用于 Within/Intersection 验证。
INSERT INTO agricultural_feature (
  feature_key, source_id, module_key, sub_id, category, year, half_year, crop,
  district_code, properties, geom
)
VALUES
  ('seed:qd-wheat-001', 'qd-wheat-001', 'security', 'cropDistribution', 'crop_distribution', 2026, 1, '小麦', '370215', '{"seed":true}', ST_GeomFromText('MULTIPOLYGON(((120.25 36.30,120.32 36.30,120.32 36.36,120.25 36.36,120.25 36.30)))', 4326)),
  ('seed:qd-corn-001', 'qd-corn-001', 'security', 'yieldEstimate', 'crop_yield', 2026, 2, '玉米', '370281', '{"seed":true}', ST_GeomFromText('MULTIPOLYGON(((120.02 36.10,120.38 36.10,120.38 36.22,120.02 36.22,120.02 36.10)))', 4326))
ON CONFLICT (feature_key) DO UPDATE SET
  source_id = EXCLUDED.source_id,
  module_key = EXCLUDED.module_key,
  sub_id = EXCLUDED.sub_id,
  category = EXCLUDED.category,
  year = EXCLUDED.year,
  half_year = EXCLUDED.half_year,
  crop = EXCLUDED.crop,
  district_code = EXCLUDED.district_code,
  properties = EXCLUDED.properties,
  geom = EXCLUDED.geom,
  updated_at = CURRENT_TIMESTAMP;

COMMIT;
