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

function buildReproductiveTimeline(rows, requestedYear) {
  const availableYears = Array.isArray(rows[0]?.availableYears)
    ? rows[0].availableYears.map(Number).filter(Number.isInteger)
    : []
  const sortedRows = sortTimelineRows(rows).map((row) => {
    const { availableYears: ignored, ...timelineRow } = row
    return {
      ...timelineRow,
      productionDate: dateText(row.productionDate)
    }
  })
  const rowYears = new Map()
  const months = new Map()
  for (const row of sortedRows) {
    const year = Number(row.timeYear)
    if (Number.isInteger(year)) rowYears.set(year, Boolean(rowYears.get(year) || row.checked))
    const date = row.productionDate
    if (date) {
      const monthKey = date.slice(0, 7)
      months.set(monthKey, Boolean(months.get(monthKey) || row.checked))
    }
  }
  const years = [...new Set([...availableYears, ...rowYears.keys()])].sort((left, right) => left - right)
  const normalizedRequestedYear = Number(requestedYear)
  const selectedYear = years.includes(normalizedRequestedYear)
    ? normalizedRequestedYear
    : years.find((year) => rowYears.get(year)) ?? years.at(-1)
  return {
    reproductiveTimeList: sortedRows.filter((row) => row.productionDate),
    allMonth: [...months.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, check]) => ({
      timeYear: Number(key.slice(0, 4)),
      timeMonth: Number(key.slice(5, 7)),
      check
    })),
    allYear: years.map((timeYear) => ({
      timeYear,
      check: requestedYear === null || requestedYear === undefined
        ? Boolean(rowYears.get(timeYear))
        : timeYear === selectedYear
    })),
    year: selectedYear
  }
}

function hasLayersParameter(serviceUrl) {
  const queryStart = serviceUrl.indexOf('?')
  if (queryStart < 0) return false
  const fragmentStart = serviceUrl.indexOf('#', queryStart)
  const query = serviceUrl.slice(queryStart + 1, fragmentStart < 0 ? undefined : fragmentStart)
  return [...new URLSearchParams(query).keys()].some((key) => key.toLowerCase() === 'layers')
}

/**
 * 将冻结表中分离存储的 WMS 地址与图层名合并成旧前端可直接解析的相对或绝对 URL。
 */
function mapServiceUrl(row) {
  const serviceUrl = typeof row.service_url === 'string' ? row.service_url : ''
  const layerName = typeof row.layer_name === 'string' ? row.layer_name : ''
  if (row.service_type !== 'wms' || !serviceUrl || !layerName || hasLayersParameter(serviceUrl)) return serviceUrl

  const fragmentStart = serviceUrl.indexOf('#')
  const fragment = fragmentStart < 0 ? '' : serviceUrl.slice(fragmentStart)
  const baseUrl = fragmentStart < 0 ? serviceUrl : serviceUrl.slice(0, fragmentStart)
  const separator = baseUrl.includes('?')
    ? (baseUrl.endsWith('?') || baseUrl.endsWith('&') ? '' : '&')
    : '?'
  const params = new URLSearchParams([
    ['service', 'WMS'],
    ['version', '1.1.0'],
    ['request', 'GetMap'],
    ['layers', layerName],
    ['styles', ''],
    ['format', 'image/png'],
    ['transparent', 'true'],
    ['srs', row.fallback_srs || 'EPSG:4326']
  ])
  return `${baseUrl}${separator}${params.toString()}${fragment}`
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
      // 规范化变体是绿色增粮同路由多参数载荷的独立查询键。
      appendExactFilter(clauses, values, 'request_variant', context.requestVariant)
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
      const availableClauses = ['module_key = $1', 'sub_id = $2']
      appendExactFilter(availableClauses, values, 'crop', context.crop)
      const clauses = [...availableClauses]
      // 生育期优先命中指定生产季；该作物无此年份时稳定回退最新可用生产季。
      const hasRequestedSeason = context.endpointKey === 'getReproductiveTimeLine'
        && context.year !== null
        && context.year !== undefined
      if (hasRequestedSeason) values.push(context.year)
      const requestedSeasonParameter = hasRequestedSeason ? `$${values.length}` : null
      const result = await client.query(`
        WITH available_seasons AS (
          SELECT
            array_agg(DISTINCT year ORDER BY year) AS years
            ${requestedSeasonParameter
              ? `, CASE
                  WHEN ${requestedSeasonParameter} = ANY(array_agg(DISTINCT year ORDER BY year))
                    THEN ${requestedSeasonParameter}
                  ELSE max(year)
                END AS "selectedYear"`
              : ''}
          FROM screen_timeline
          WHERE ${availableClauses.join('\n            AND ')}
        )
        SELECT year AS "timeYear", half_year AS "halfYear",
               crop, observation_date AS "productionDate",
               stage AS "periodType", label,
               sort_order AS "sortOrder", active AS checked,
               available_seasons.years AS "availableYears"
        FROM screen_timeline
        CROSS JOIN available_seasons
        WHERE ${clauses.join('\n          AND ')}
          ${requestedSeasonParameter ? 'AND year = available_seasons."selectedYear"' : ''}
        ORDER BY sort_order, observation_date, year, half_year, id
      `, values)
      const rows = result && Array.isArray(result.rows) ? result.rows : []
      if (context.endpointKey !== 'getReproductiveTimeLine') return sortTimelineRows(rows)
      return buildReproductiveTimeline(rows, context.year)
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
        SELECT service_type, service_url, layer_name, fallback_srs, metadata
        FROM map_service
        WHERE ${clauses.join('\n          AND ')}
        ORDER BY server, service_type, service_url, id DESC
        LIMIT 1
      `, values)
      const row = firstRow(result)
      if (!row) return null
      const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
      return {
        msg: mapServiceUrl(row),
        extent: metadata.extent ?? null,
        metadata
      }
    }
  }
}

module.exports = { createPostgresRepository }
