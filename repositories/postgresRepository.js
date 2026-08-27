function firstRow(result) {
  return result && Array.isArray(result.rows) ? result.rows[0] : undefined
}

function extractEndpointPayload(payload, endpointKey) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload ?? null
  if (payload.endpoints && Object.hasOwn(payload.endpoints, endpointKey)) return payload.endpoints[endpointKey]
  if (Object.hasOwn(payload, endpointKey)) return payload[endpointKey]
  return payload
}

function appendExactFilter(clauses, values, column, value, cast = '') {
  if (value === null || value === undefined || value === '') return
  values.push(value)
  clauses.push(`${column} = $${values.length}${cast}`)
}

function dateText(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
  const text = String(value || '')
  return /^\d{4}-\d{2}-\d{2}$/u.test(text) ? text : null
}

function sortTimelineRows(rows) {
  return [...rows].sort((left, right) =>
    Number(left.sortOrder || 0) - Number(right.sortOrder || 0) ||
    String(dateText(left.productionDate) || '').localeCompare(String(dateText(right.productionDate) || '')) ||
    Number(left.timeYear || 0) - Number(right.timeYear || 0) ||
    Number(left.halfYear || 0) - Number(right.halfYear || 0)
  )
}

function buildReproductiveTimeline(rows) {
  const sortedRows = sortTimelineRows(rows).map((row) => ({
    ...row,
    productionDate: dateText(row.productionDate)
  }))
  const years = new Map()
  const months = new Map()
  for (const row of sortedRows) {
    const year = Number(row.timeYear)
    if (Number.isInteger(year)) years.set(year, Boolean(years.get(year) || row.checked))
    const date = row.productionDate
    if (date) {
      const monthKey = date.slice(0, 7)
      months.set(monthKey, Boolean(months.get(monthKey) || row.checked))
    }
  }
  return {
    reproductiveTimeList: sortedRows.filter((row) => row.productionDate),
    allMonth: [...months.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, check]) => ({
      timeYear: Number(key.slice(0, 4)),
      timeMonth: Number(key.slice(5, 7)),
      check
    })),
    allYear: [...years.entries()].sort(([left], [right]) => left - right).map(([timeYear, check]) => ({ timeYear, check }))
  }
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
      const values = [context.moduleKey, context.subId, context.endpointKey]
      const clauses = ['module_key = $1', 'sub_id = $2', 'endpoint_key = $3']
      appendExactFilter(clauses, values, 'year', context.year)
      appendExactFilter(clauses, values, 'half_year', context.halfYear)
      appendExactFilter(clauses, values, 'crop', context.crop)
      appendExactFilter(clauses, values, 'observation_date', context.observationDate, '::date')
      appendExactFilter(clauses, values, 'district_code', context.districtCode)
      const result = await client.query(`
        SELECT payload
        FROM dashboard_payload
        WHERE ${clauses.join('\n          AND ')}
        ORDER BY year ASC NULLS FIRST,
                 half_year ASC NULLS FIRST,
                 crop ASC NULLS FIRST,
                 observation_date ASC NULLS FIRST,
                 district_code ASC NULLS FIRST,
                 updated_at DESC,
                 id DESC
        LIMIT 1
      `, values)
      const row = firstRow(result)
      return row ? extractEndpointPayload(row.payload, context.endpointKey) : null
    },

    async findTimeline(context) {
      const values = [context.moduleKey, context.subId]
      const clauses = ['module_key = $1', 'sub_id = $2']
      appendExactFilter(clauses, values, 'crop', context.crop)
      const result = await client.query(`
        SELECT year AS "timeYear", half_year AS "halfYear",
               crop, observation_date AS "productionDate", stage, label,
               sort_order AS "sortOrder", active AS checked
        FROM screen_timeline
        WHERE ${clauses.join('\n          AND ')}
        ORDER BY sort_order, observation_date, year, half_year, id
      `, values)
      const rows = result && Array.isArray(result.rows) ? result.rows : []
      if (context.endpointKey !== 'getReproductiveTimeLine') return sortTimelineRows(rows)
      return buildReproductiveTimeline(rows)
    },

    async findMapService(context) {
      const values = [context.moduleKey, context.subId]
      const clauses = ['module_key = $1', 'sub_id = $2', 'enabled = TRUE']
      appendExactFilter(clauses, values, 'category', context.category)
      appendExactFilter(clauses, values, 'year', context.year)
      appendExactFilter(clauses, values, 'half_year', context.halfYear)
      appendExactFilter(clauses, values, 'crop', context.crop)
      appendExactFilter(clauses, values, 'stage', context.stage)
      appendExactFilter(clauses, values, 'observation_date', context.observationDate, '::date')
      appendExactFilter(clauses, values, 'server', context.server)
      const result = await client.query(`
        SELECT service_url, layer_name, service_type, metadata
        FROM map_service
        WHERE ${clauses.join('\n          AND ')}
        ORDER BY server, service_type, service_url, id DESC
        LIMIT 1
      `, values)
      const row = firstRow(result)
      if (!row) return null
      const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
      return {
        msg: row.service_url || row.layer_name || '',
        extent: metadata.extent ?? null,
        metadata
      }
    }
  }
}

module.exports = { createPostgresRepository }
