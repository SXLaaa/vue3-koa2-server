BEGIN;

ALTER TABLE dashboard_payload
  ADD COLUMN request_variant VARCHAR(192) NOT NULL DEFAULT 'default';

DROP INDEX dashboard_payload_lookup_uq;
DROP INDEX dashboard_payload_query_idx;

-- request_variant 是绿色增粮分类、检索词和主体详情请求的一等物理查询键。
CREATE UNIQUE INDEX dashboard_payload_lookup_uq ON dashboard_payload (
  module_key,
  sub_id,
  endpoint_key,
  request_variant,
  COALESCE(year, 0),
  COALESCE(half_year, 0),
  COALESCE(crop, ''),
  COALESCE(observation_date, DATE '1900-01-01'),
  COALESCE(district_code, '')
);
CREATE INDEX dashboard_payload_query_idx ON dashboard_payload (
  module_key, sub_id, endpoint_key, request_variant,
  year, half_year, crop, observation_date, district_code
);

-- 统一呈现模块、页面、接口、物理表和实际查询键；UNION ALL 使该视图保持只读。
CREATE VIEW dashboard_module_endpoint_v AS
SELECT
  module_key,
  sub_id,
  endpoint_key,
  'dashboard_payload'::TEXT AS physical_table,
  concat_ws('|',
    module_key,
    sub_id,
    endpoint_key,
    request_variant,
    COALESCE(year::TEXT, '*'),
    COALESCE(half_year::TEXT, '*'),
    COALESCE(crop, '*'),
    COALESCE(observation_date::TEXT, '*'),
    COALESCE(district_code, '*')
  ) AS query_key,
  request_variant,
  year,
  half_year,
  crop,
  observation_date,
  district_code
FROM dashboard_payload
UNION ALL
SELECT
  module_key,
  sub_id,
  CASE timeline_type
    WHEN 'reproductive' THEN 'getReproductiveTimeLine'
    ELSE 'getTimeLine'
  END AS endpoint_key,
  'screen_timeline'::TEXT AS physical_table,
  concat_ws('|', module_key, sub_id, timeline_type, year::TEXT, COALESCE(crop, '*')) AS query_key,
  timeline_type AS request_variant,
  year,
  half_year,
  crop,
  observation_date,
  NULL::VARCHAR(16) AS district_code
FROM screen_timeline
UNION ALL
SELECT
  module_key,
  sub_id,
  'getVectorTableWms' AS endpoint_key,
  'map_service'::TEXT AS physical_table,
  concat_ws('|',
    module_key,
    sub_id,
    category,
    COALESCE(year::TEXT, '*'),
    COALESCE(half_year::TEXT, '*'),
    COALESCE(crop, '*'),
    COALESCE(stage, '*'),
    COALESCE(observation_date::TEXT, '*'),
    server
  ) AS query_key,
  category AS request_variant,
  year,
  half_year,
  crop,
  observation_date,
  NULL::VARCHAR(16) AS district_code
FROM map_service
WHERE enabled = TRUE;

-- 聚合视图面向排查和验收，只读列出每个页面当前可寻址的接口绑定。
CREATE VIEW dashboard_module_read_v AS
SELECT
  module_key,
  sub_id,
  jsonb_agg(
    jsonb_build_object(
      'endpointKey', endpoint_key,
      'physicalTable', physical_table,
      'queryKey', query_key
    )
    ORDER BY endpoint_key, physical_table, query_key
  ) AS endpoint_bindings
FROM dashboard_module_endpoint_v
GROUP BY module_key, sub_id;

COMMENT ON VIEW dashboard_module_endpoint_v IS '模块-页面-接口-物理表及查询键只读明细';
COMMENT ON VIEW dashboard_module_read_v IS '按模块页面聚合的接口绑定只读视图';

COMMIT;
