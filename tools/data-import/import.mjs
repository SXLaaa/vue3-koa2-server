import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { csvToFeatures } from './lib/csv.mjs'
import { normalizeFeature } from './lib/geometry.mjs'
import { buildUpsertSql, sqlDigest } from './lib/sql.mjs'

function parseArguments(argv) {
  const options = {
    dryRun: true,
    apply: false,
    json: false,
    planOnly: false,
    allowLocalDatabase: false,
  }
  const valueOptions = new Map([
    ['--input', 'input'],
    ['--format', 'format'],
    ['--source-srid', 'sourceSrid'],
    ['--mapping', 'mapping'],
    ['--output', 'output'],
  ])
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (valueOptions.has(argument)) {
      const value = argv[index + 1]
      if (!value || value.startsWith('--')) throw new Error(`${argument} 缺少参数值`)
      options[valueOptions.get(argument)] = value
      index += 1
    } else if (argument === '--dry-run') options.dryRun = true
    else if (argument === '--apply') {
      options.apply = true
      options.dryRun = false
    } else if (argument === '--json') options.json = true
    else if (argument === '--plan-only') options.planOnly = true
    else if (argument === '--allow-local-database') options.allowLocalDatabase = true
    else if (argument === '--help') options.help = true
    else throw new Error(`未知参数：${argument}`)
  }
  return options
}

function usage() {
  return `用法：node tools/data-import/import.mjs --input <文件> --format <geojson|csv|shp> --source-srid <EPSG> [选项]

默认只执行 dry-run，不连接数据库。
  --mapping <json>           客户字段到冻结字段的映射
  --output <sql>             将确定性 upsert SQL 写入文件
  --plan-only                仅输出 SHP 的 GDAL 内网转换计划
  --apply                    通过 psql 应用到数据库
  --allow-local-database     --apply 必需，且 DATABASE_URL 必须指向本机
  --json                     输出机器可读 JSON
`
}

function parseSourceSrid(value) {
  const sourceSrid = Number(value)
  if (!Number.isInteger(sourceSrid) || sourceSrid <= 0) throw new Error('source-srid 必须是正整数')
  return sourceSrid
}

function readFieldMap(mappingPath) {
  if (!mappingPath) return {}
  const value = JSON.parse(readFileSync(path.resolve(mappingPath), 'utf8'))
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('mapping 必须是 JSON 对象')
  for (const [target, source] of Object.entries(value)) {
    if (!target.trim() || typeof source !== 'string' || !source.trim()) throw new Error('mapping 的键和值必须是非空字段名')
  }
  return value
}

function loadGeoJson(text) {
  const value = JSON.parse(text)
  if (value?.type === 'FeatureCollection' && Array.isArray(value.features)) return value.features
  if (value?.type === 'Feature') return [value]
  throw new Error('GeoJSON 必须是 Feature 或 FeatureCollection')
}

function quoteCommand(value) {
  return `"${String(value).replaceAll('"', '\\"')}"`
}

// SHP 统一由 GDAL 输出到 /vsistdout/，不写临时文件；所有转换均在客户内网本机完成。
function shapefilePlan(input, sourceSrid) {
  const argumentsList = [
    '-f', 'GeoJSON', '/vsistdout/', input,
    '-s_srs', `EPSG:${sourceSrid}`,
    '-t_srs', 'EPSG:4326',
    '-nlt', 'PROMOTE_TO_MULTI',
    '-makevalid',
  ]
  return {
    executable: 'ogr2ogr',
    argumentsList,
    command: `ogr2ogr ${argumentsList.map(quoteCommand).join(' ')}`,
  }
}

function assertShapefileSidecars(input) {
  const extension = path.extname(input)
  const base = input.slice(0, input.length - extension.length)
  const required = ['.shp', '.shx', '.dbf', '.prj'].map((suffix) => `${base}${suffix}`)
  const missing = required.filter((file) => !existsSync(file))
  if (missing.length) throw new Error(`SHP 缺少必要文件：${missing.join(', ')}`)
}

function loadShapefile(input, sourceSrid) {
  assertShapefileSidecars(input)
  const plan = shapefilePlan(input, sourceSrid)
  const result = spawnSync(plan.executable, plan.argumentsList, { encoding: 'utf8' })
  if (result.error) throw new Error(`无法运行 ogr2ogr：${result.error.message}`)
  if (result.status !== 0) throw new Error(`ogr2ogr 转换失败：${result.stderr?.trim() || `exit ${result.status}`}`)
  return loadGeoJson(result.stdout)
}

function assertLocalDatabase(databaseUrl, allowed) {
  if (!allowed) throw new Error('--apply 必须同时显式传入 --allow-local-database')
  if (!databaseUrl) throw new Error('--apply 需要本地 DATABASE_URL；不要索取或提交客户密码')
  let parsed
  try {
    parsed = new URL(databaseUrl)
  } catch {
    throw new Error('DATABASE_URL 不是有效的 PostgreSQL URL')
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) throw new Error('DATABASE_URL 仅支持 PostgreSQL 协议')
  if (!['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)) {
    throw new Error('为防止误连客户环境，自动应用仅允许 localhost/127.0.0.1/::1')
  }
}

function applySql(sql, databaseUrl, allowed) {
  assertLocalDatabase(databaseUrl, allowed)
  const result = spawnSync('psql', ['-X', '-v', 'ON_ERROR_STOP=1'], {
    input: sql,
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: '', PGDATABASE: databaseUrl },
    stdio: ['pipe', 'ignore', 'pipe'],
  })
  if (result.error) throw new Error(`无法运行 psql：${result.error.message}`)
  if (result.status !== 0) throw new Error(`psql 导入失败：${result.stderr?.trim() || `exit ${result.status}`}`)
}

function outputResult(result, json) {
  if (json) process.stdout.write(`${JSON.stringify(result)}\n`)
  else {
    process.stdout.write(`导入检查：${result.status}\n`)
    if ('recordCount' in result) process.stdout.write(`记录 ${result.recordCount} 条，稳定键 ${result.stableKeys.length} 个，SQL SHA-256 ${result.sqlDigest}\n`)
    if (result.command) process.stdout.write(`内网命令：${result.command}\n`)
    if (result.status === 'MANUAL_REQUIRED') process.stdout.write('MANUAL_REQUIRED：请在客户内网核对数量后人工应用/发布。\n')
  }
}

try {
  const options = parseArguments(process.argv.slice(2))
  if (options.help) {
    process.stdout.write(usage())
    process.exit(0)
  }
  if (!options.input) throw new Error('必须提供 --input')
  const sourceSrid = parseSourceSrid(options.sourceSrid)
  const format = (options.format || path.extname(options.input).slice(1)).toLowerCase()
  if (!['geojson', 'json', 'csv', 'shp'].includes(format)) throw new Error(`不支持的格式：${format}`)

  const input = path.resolve(options.input)
  if (format === 'shp' && options.planOnly) {
    const plan = shapefilePlan(options.input, sourceSrid)
    outputResult({
      status: 'MANUAL_REQUIRED',
      nextStep: 'RUN_ON_CUSTOMER_INTRANET',
      sourceFormat: 'shp',
      sourceSrid,
      targetSrid: 4326,
      command: plan.command,
    }, options.json)
    process.exit(0)
  }

  if (!existsSync(input)) throw new Error(`输入文件不存在：${options.input}`)
  if (format !== 'shp' && sourceSrid !== 4326) {
    throw new Error('GeoJSON/CSV dry-run 仅直接接受 EPSG:4326；其他坐标系请先在内网用 ogr2ogr 转换')
  }

  let features
  let normalizedSrid = sourceSrid
  if (format === 'geojson' || format === 'json') features = loadGeoJson(readFileSync(input, 'utf8'))
  else if (format === 'csv') features = csvToFeatures(readFileSync(input, 'utf8'))
  else {
    features = loadShapefile(input, sourceSrid)
    normalizedSrid = 4326
  }
  if (features.length === 0) throw new Error('输入数据没有任何 Feature')

  const fieldMap = readFieldMap(options.mapping)
  const records = features.map((feature) => normalizeFeature(feature, normalizedSrid, fieldMap))
  const duplicateKeys = records
    .map((record) => record.feature_key)
    .filter((key, index, values) => values.indexOf(key) !== index)
  if (duplicateKeys.length) throw new Error(`输入内存在重复稳定键：${[...new Set(duplicateKeys)].join(', ')}`)

  const sql = buildUpsertSql(records, normalizedSrid)
  if (options.output) writeFileSync(path.resolve(options.output), sql, 'utf8')
  if (options.apply) applySql(sql, process.env.DATABASE_URL?.trim(), options.allowLocalDatabase)

  outputResult({
    status: options.apply ? 'PASS' : 'MANUAL_REQUIRED',
    nextStep: options.apply ? 'NONE' : 'APPLY_ON_CUSTOMER_INTRANET',
    sourceFormat: format === 'json' ? 'geojson' : format,
    sourceSrid,
    targetSrid: 4326,
    recordCount: records.length,
    stableKeys: records.map((record) => record.feature_key).sort(),
    geometryTypes: [...new Set(records.map((record) => record.geometry.type))].sort(),
    sqlDigest: sqlDigest(sql),
    sqlPreview: sql.slice(0, 4000),
  }, options.json)
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
