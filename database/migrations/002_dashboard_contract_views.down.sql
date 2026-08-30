BEGIN;

DROP VIEW IF EXISTS dashboard_module_read_v;
DROP VIEW IF EXISTS dashboard_module_endpoint_v;

DROP INDEX dashboard_payload_lookup_uq;
DROP INDEX dashboard_payload_query_idx;

ALTER TABLE dashboard_payload
  DROP COLUMN IF EXISTS request_variant;

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

COMMIT;
