import { createHash } from 'node:crypto'

const dimensionFields = [
  'source_id',
  'module_key',
  'sub_id',
  'category',
  'year',
  'half_year',
  'crop',
  'stage',
  'observation_date',
  'district_code',
]

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]))
  }
  return value
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value))
}

function assertPosition(position, sourceSrid) {
  if (!Array.isArray(position) || position.length < 2) throw new Error('几何坐标必须至少包含 x/y')
  const [x, y] = position
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('几何坐标必须是有限数字')
  if (sourceSrid === 4326 && (x < -180 || x > 180 || y < -90 || y > 90)) {
    throw new Error(`EPSG:4326 坐标越界：${x},${y}`)
  }
}

function assertRing(ring, sourceSrid) {
  if (!Array.isArray(ring) || ring.length < 4) throw new Error('多边形环至少需要四个坐标点')
  for (const position of ring) assertPosition(position, sourceSrid)
  const first = ring[0]
  const last = ring.at(-1)
  if (first[0] !== last[0] || first[1] !== last[1]) throw new Error('多边形环必须闭合')
}

function assertPolygon(polygon, sourceSrid) {
  if (!Array.isArray(polygon) || polygon.length === 0) throw new Error('Polygon 至少需要一个外环')
  for (const ring of polygon) assertRing(ring, sourceSrid)
}

// 导入边界只接受面数据；Polygon 在进入 SQL 前统一升为 MultiPolygon。
export function normalizeGeometry(geometry, sourceSrid) {
  if (!geometry || typeof geometry !== 'object') throw new Error('记录缺少 geometry')
  let coordinates
  if (geometry.type === 'Polygon') {
    assertPolygon(geometry.coordinates, sourceSrid)
    coordinates = [geometry.coordinates]
  } else if (geometry.type === 'MultiPolygon') {
    if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) throw new Error('MultiPolygon 不能为空')
    for (const polygon of geometry.coordinates) assertPolygon(polygon, sourceSrid)
    coordinates = geometry.coordinates
  } else {
    throw new Error(`仅支持 Polygon/MultiPolygon，收到 ${String(geometry.type)}`)
  }
  return { type: 'MultiPolygon', coordinates }
}

function normalizeInteger(value, field) {
  if (value === undefined || value === null || value === '') return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) throw new Error(`${field} 必须是整数`)
  return parsed
}

function normalizeText(value) {
  if (value === undefined || value === null) return null
  const text = String(value).trim()
  return text || null
}

function validateDimensions(record) {
  if (!['farmland', 'security', 'warning'].includes(record.module_key)) {
    throw new Error(`module_key 必须是 farmland/security/warning，收到 ${String(record.module_key)}`)
  }
  if (!record.sub_id) throw new Error('sub_id 不能为空')
  if (!record.category) throw new Error('category 不能为空')
  if (record.year !== null && (record.year < 1900 || record.year > 2200)) throw new Error('year 必须在 1900..2200')
  if (record.half_year !== null && ![1, 2].includes(record.half_year)) throw new Error('half_year 只能是 1 或 2')
  if (record.observation_date && !/^\d{4}-\d{2}-\d{2}$/u.test(record.observation_date)) {
    throw new Error('observation_date 必须使用 YYYY-MM-DD')
  }
}

function stableFeatureKey(properties, geometry) {
  const explicit = normalizeText(properties.feature_key)
  if (explicit) return explicit
  const sourceId = normalizeText(properties.source_id)
  if (sourceId) return `source:${sourceId}`
  const signature = canonicalJson({
    dimensions: Object.fromEntries(dimensionFields.map((field) => [field, properties[field] ?? null])),
    geometry,
  })
  return `sha256:${createHash('sha256').update(signature).digest('hex')}`
}

// 字段映射先把客户列名投影为冻结列名，再计算稳定键，确保同一 source_id 重复导入走 upsert。
export function normalizeFeature(feature, sourceSrid, fieldMap = {}) {
  if (!feature || feature.type !== 'Feature') throw new Error('输入必须包含 GeoJSON Feature')
  const original = feature.properties && typeof feature.properties === 'object' ? feature.properties : {}
  const mapped = { ...original }
  for (const [target, source] of Object.entries(fieldMap)) {
    if (source in original) mapped[target] = original[source]
  }
  if (!mapped.source_id && feature.id !== undefined && feature.id !== null) mapped.source_id = String(feature.id)

  const geometry = normalizeGeometry(feature.geometry, sourceSrid)
  const record = {
    feature_key: stableFeatureKey(mapped, geometry),
    source_id: normalizeText(mapped.source_id),
    module_key: normalizeText(mapped.module_key),
    sub_id: normalizeText(mapped.sub_id),
    category: normalizeText(mapped.category),
    year: normalizeInteger(mapped.year, 'year'),
    half_year: normalizeInteger(mapped.half_year, 'half_year'),
    crop: normalizeText(mapped.crop),
    stage: normalizeText(mapped.stage),
    observation_date: normalizeText(mapped.observation_date),
    district_code: normalizeText(mapped.district_code),
    properties: canonicalize(original),
    geometry,
  }
  validateDimensions(record)
  return record
}
