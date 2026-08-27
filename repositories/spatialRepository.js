/**
 * 空间仓储封装 PostGIS 计算。几何相交、包含和面积均在数据库内完成，调用方只传业务筛选值。
 */
function createSpatialRepository(client) {
  if (!client || typeof client.query !== 'function') throw new Error('PostgreSQL query client is required')

  return {
    async findIntersections({ regionCode, featureType }) {
      const result = await client.query(`
        SELECT f.id AS feature_id, f.feature_type, f.properties
        FROM agricultural_feature f
        JOIN administrative_region r ON r.region_code = $1
        WHERE f.feature_type = $2
          AND ST_Intersects(f.geom, r.geom)
        ORDER BY f.id
      `, [regionCode, featureType])
      return result.rows || []
    },

    async isFeatureWithinRegion({ featureId, regionCode }) {
      const result = await client.query(`
        SELECT ST_Within(f.geom, r.geom) AS contained
        FROM agricultural_feature f
        JOIN administrative_region r ON r.region_code = $2
        WHERE f.id = $1
        LIMIT 1
      `, [featureId, regionCode])
      return Boolean(result.rows && result.rows[0] && result.rows[0].contained)
    },

    async calculateIntersectionArea({ regionCode, featureType }) {
      const result = await client.query(`
        SELECT COUNT(*) AS feature_count,
               COALESCE(SUM(ST_Area(ST_Intersection(f.geom, r.geom)::geography)), 0) AS area_square_meters
        FROM agricultural_feature f
        JOIN administrative_region r ON r.region_code = $1
        WHERE f.feature_type = $2
          AND ST_Intersects(f.geom, r.geom)
      `, [regionCode, featureType])
      const row = result.rows && result.rows[0] ? result.rows[0] : {}
      return {
        featureCount: Number(row.feature_count || 0),
        areaSquareMeters: Number(row.area_square_meters || 0)
      }
    }
  }
}

module.exports = { createSpatialRepository }
