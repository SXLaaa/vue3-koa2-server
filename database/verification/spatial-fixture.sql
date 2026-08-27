\set ON_ERROR_STOP on

-- geography 面积必须为正，且青岛示例区应包含两条农业要素。
DO $$
DECLARE
  result RECORD;
  wheat_area NUMERIC;
BEGIN
  SELECT main_grain_area_hectares(geom)
  INTO wheat_area
  FROM agricultural_feature
  WHERE feature_key = 'seed:qd-wheat-001';

  IF wheat_area IS NULL OR wheat_area <= 0 THEN
    RAISE EXCEPTION 'geography area fixture failed: %', wheat_area;
  END IF;

  SELECT *
  INTO result
  FROM main_grain_spatial_summary('370200', NULL, NULL);

  IF result.intersecting_count <> 2 OR result.within_count <> 2 THEN
    RAISE EXCEPTION 'Qingdao spatial fixture failed: intersecting=%, within=%', result.intersecting_count, result.within_count;
  END IF;
  IF result.feature_area_hectares <= 0 OR result.intersection_area_hectares <= 0 THEN
    RAISE EXCEPTION 'spatial area fixture failed: feature=%, intersection=%', result.feature_area_hectares, result.intersection_area_hectares;
  END IF;
END;
$$;

SELECT * FROM main_grain_spatial_summary('370215', 'security', 'cropDistribution');
SELECT * FROM main_grain_spatial_summary('370281', 'security', 'yieldEstimate');
