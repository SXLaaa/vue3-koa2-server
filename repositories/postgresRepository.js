function firstRow(result) {
  return result && Array.isArray(result.rows) ? result.rows[0] : undefined
}

function extractEndpointPayload(payload, endpointKey) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload ?? null
  if (payload.endpoints && Object.hasOwn(payload.endpoints, endpointKey)) return payload.endpoints[endpointKey]
  if (Object.hasOwn(payload, endpointKey)) return payload[endpointKey]
  return payload
}

/**
 * PostgreSQL 仓储是认证与大屏查询的唯一持久层接口；所有业务输入都通过参数数组传递。
 */
function createPostgresRepository(client) {
  if (!client || typeof client.query !== 'function') throw new Error('PostgreSQL query client is required')

  return {
    async findUserByUsername(username) {
      const result = await client.query(`
        SELECT id, username, password_hash, display_name, status
        FROM auth_user
        WHERE username = $1
        LIMIT 1
      `, [username])
      const row = firstRow(result)
      return row ? {
        id: row.id,
        username: row.username,
        passwordHash: row.password_hash,
        displayName: row.display_name,
        status: row.status
      } : null
    },

    async findDashboardPayload(context) {
      const values = [
        context.moduleKey, context.subId, context.year, context.halfYear,
        context.crop, context.observationDate, context.districtCode
      ]
      const result = await client.query(`
        SELECT payload
        FROM dashboard_payload
        WHERE module_key = $1
          AND sub_id IS NOT DISTINCT FROM $2
          AND year::text IS NOT DISTINCT FROM $3
          AND half_year::text IS NOT DISTINCT FROM $4
          AND crop IS NOT DISTINCT FROM $5
          AND observation_date IS NOT DISTINCT FROM $6::date
          AND district_code IS NOT DISTINCT FROM $7
        LIMIT 1
      `, values)
      const row = firstRow(result)
      return row ? extractEndpointPayload(row.payload, context.endpointKey) : null
    },

    async findTimeline(context) {
      const result = await client.query(`
        SELECT time_year AS "timeYear", half_year AS "halfYear",
               crop, observation_date AS "productionDate", stage,
               is_default AS checked
        FROM screen_timeline
        WHERE module_key = $1
          AND sub_id = $2
          AND crop IS NOT DISTINCT FROM $3
        ORDER BY sort_order, observation_date, time_year, half_year
      `, [context.moduleKey, context.subId, context.crop])
      const rows = result && Array.isArray(result.rows) ? result.rows : []
      if (context.endpointKey !== 'getReproductiveTimeLine') return rows
      return {
        reproductiveTimeList: rows.filter((row) => row.productionDate),
        allMonth: [],
        allYear: [...new Set(rows.map((row) => row.timeYear).filter(Boolean))]
      }
    },

    async findMapService(context) {
      const values = [
        context.moduleKey, context.subId, context.category || null, context.year,
        context.halfYear, context.crop, context.stage || null, context.server || null
      ]
      const result = await client.query(`
        SELECT service_url, layer_name, extent, metadata
        FROM map_service
        WHERE module_key = $1
          AND sub_id IS NOT DISTINCT FROM $2
          AND category IS NOT DISTINCT FROM $3
          AND year::text IS NOT DISTINCT FROM $4
          AND half_year::text IS NOT DISTINCT FROM $5
          AND crop IS NOT DISTINCT FROM $6
          AND stage IS NOT DISTINCT FROM $7
          AND server IS NOT DISTINCT FROM $8
        LIMIT 1
      `, values)
      const row = firstRow(result)
      if (!row) return null
      return {
        msg: row.service_url || row.layer_name || '',
        extent: row.extent ?? null,
        metadata: row.metadata ?? null
      }
    }
  }
}

module.exports = { createPostgresRepository }
