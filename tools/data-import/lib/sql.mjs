import { createHash } from 'node:crypto'
import { canonicalJson } from './geometry.mjs'

function sqlText(value) {
  return value === null || value === undefined ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`
}

function sqlInteger(value) {
  return value === null || value === undefined ? 'NULL' : String(value)
}

// 记录按 feature_key 排序后生成同一份 SQL，输入顺序变化不会影响 upsert 内容和摘要。
export function buildUpsertSql(records, sourceSrid) {
  const statements = [...records]
    .sort((left, right) => left.feature_key.localeCompare(right.feature_key, 'en'))
    .map((record) => `INSERT INTO agricultural_feature (
  feature_key, source_id, module_key, sub_id, category, year, half_year, crop,
  stage, observation_date, district_code, properties, geom
) VALUES (
  ${sqlText(record.feature_key)}, ${sqlText(record.source_id)}, ${sqlText(record.module_key)},
  ${sqlText(record.sub_id)}, ${sqlText(record.category)}, ${sqlInteger(record.year)},
  ${sqlInteger(record.half_year)}, ${sqlText(record.crop)}, ${sqlText(record.stage)},
  ${sqlText(record.observation_date)}::date, ${sqlText(record.district_code)},
  ${sqlText(canonicalJson(record.properties))}::jsonb,
  main_grain_normalize_geometry(ST_GeomFromGeoJSON(${sqlText(canonicalJson(record.geometry))}), ${sourceSrid})
) ON CONFLICT (feature_key) DO UPDATE SET
  source_id = EXCLUDED.source_id,
  module_key = EXCLUDED.module_key,
  sub_id = EXCLUDED.sub_id,
  category = EXCLUDED.category,
  year = EXCLUDED.year,
  half_year = EXCLUDED.half_year,
  crop = EXCLUDED.crop,
  stage = EXCLUDED.stage,
  observation_date = EXCLUDED.observation_date,
  district_code = EXCLUDED.district_code,
  properties = EXCLUDED.properties,
  geom = EXCLUDED.geom,
  updated_at = CURRENT_TIMESTAMP;`)

  return `BEGIN;\n\n${statements.join('\n\n')}\n\nCOMMIT;\n`
}

export function sqlDigest(sql) {
  return createHash('sha256').update(sql).digest('hex')
}
