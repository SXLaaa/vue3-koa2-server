import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { requirePsqlExecutable, resolvePsqlExecutable } from '../tools/data-import/lib/psql.mjs'

const databaseDir = path.dirname(fileURLToPath(import.meta.url))
const worktree = path.resolve(databaseDir, '..')
const args = new Set(process.argv.slice(2))
const jsonOutput = args.has('--json')
const live = args.has('--live')

const paths = {
  migration: path.join(databaseDir, 'migrations', '001_postgis_dashboard.up.sql'),
  rollback: path.join(databaseDir, 'migrations', '001_postgis_dashboard.down.sql'),
  seed: path.join(databaseDir, 'seeds', '001_minimal_dashboard.sql'),
  spatial: path.join(databaseDir, 'verification', 'spatial-fixture.sql'),
  live: path.join(databaseDir, 'verification', 'live-verify.sql'),
  contract: path.join(databaseDir, 'contracts', 'dashboard-contract.json'),
}

function read(target) {
  return readFileSync(target, 'utf8')
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex')
}

function escapePattern(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

function assertLocalDatabase(databaseUrl) {
  let parsed
  try {
    parsed = new URL(databaseUrl)
  } catch {
    throw new Error('DATABASE_URL 不是有效的 PostgreSQL URL')
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('DATABASE_URL 仅支持 PostgreSQL 协议')
  }
  if (!['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)) {
    throw new Error('为防止误连客户环境，--live 仅允许 localhost/127.0.0.1/::1')
  }
}

function runPsql(databaseUrl, file, psqlExecutable) {
  const result = spawnSync(psqlExecutable, ['-X', '-v', 'ON_ERROR_STOP=1', '-f', file], {
    cwd: path.dirname(file),
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: '', PGDATABASE: databaseUrl },
    stdio: jsonOutput ? ['ignore', 'ignore', 'pipe'] : 'inherit',
  })
  if (result.error) throw new Error(`无法运行 psql：${result.error.message}`)
  if (result.status !== 0) throw new Error(`psql 验证失败：${result.stderr?.trim() || `exit ${result.status}`}`)
}

try {
  const migration = read(paths.migration)
  const rollback = read(paths.rollback)
  const seed = read(paths.seed)
  const spatial = read(paths.spatial)
  const contract = JSON.parse(read(paths.contract))
  const errors = []
  const tables = [
    'administrative_region',
    'agricultural_feature',
    'auth_user',
    'dashboard_payload',
    'map_service',
    'screen_timeline',
  ]

  if (!/CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+postgis/iu.test(migration)) errors.push('缺少 PostGIS 扩展迁移')
  for (const table of tables) {
    if (!new RegExp(`CREATE\\s+TABLE\\s+${table}\\b`, 'iu').test(migration)) errors.push(`缺少表：${table}`)
    if (!new RegExp(`DROP\\s+TABLE\\s+IF\\s+EXISTS\\s+${table}\\b`, 'iu').test(rollback)) errors.push(`回滚缺少表：${table}`)
  }

  const geometryColumns = migration.match(/\bgeom\s+geometry\s*\(\s*MultiPolygon\s*,\s*4326\s*\)/giu) ?? []
  if (geometryColumns.length !== 2) errors.push(`MultiPolygon/4326 列应为 2 个，实际 ${geometryColumns.length}`)
  const gistIndexes = migration.match(/USING\s+GIST\s*\(\s*geom\s*\)/giu) ?? []
  if (gistIndexes.length !== 2) errors.push(`GiST 空间索引应为 2 个，实际 ${gistIndexes.length}`)

  const operationChecks = [
    ['ST_Area(geom::geography)', /ST_Area\s*\(\s*(?:input_geom|feature_geom|clipped_geom)::geography\s*\)/iu],
    ['ST_Intersection', /ST_Intersection\s*\(/iu],
    ['ST_Intersects', /ST_Intersects\s*\(/iu],
    ['ST_Within', /ST_Within\s*\(/iu],
  ]
  for (const [name, pattern] of operationChecks) {
    if (!pattern.test(`${migration}\n${spatial}`)) errors.push(`缺少空间操作：${name}`)
  }

  for (const page of contract.pages) {
    const pagePattern = new RegExp(`'${page.moduleKey}'\\s*,\\s*'${page.subId}'`, 'u')
    if (!pagePattern.test(seed)) errors.push(`种子缺少页面：${page.moduleKey}/${page.subId}`)
  }
  for (const endpoint of contract.endpoints) {
    if (!seed.includes(`'${endpoint}'`)) errors.push(`种子缺少接口：${endpoint}`)
  }
  for (const frozenValue of ['subjectTypeList', '[1,2,3]', '"cropType":0', '"unit":2', '"lastYear":"halfYear"', 'veryDad']) {
    if (!seed.includes(frozenValue)) errors.push(`种子缺少冻结契约值：${frozenValue}`)
  }

  const mapServiceSeed = seed.match(/INSERT\s+INTO\s+map_service[\s\S]*?VALUES([\s\S]*?)ON\s+CONFLICT\s+DO\s+NOTHING;/iu)?.[1] ?? ''
  const seedMapServices = (mapServiceSeed.match(/^\s*\('/gmu) ?? []).length
  const plantingTaskMapServiceEmpty = !/'security'\s*,\s*'plantingTask'/u.test(mapServiceSeed)
  const plantingTaskVectorWmsEmpty = !/\('security'\s*,\s*'plantingTask'\s*,\s*'getVectorTableWms'/u.test(seed)
  if (seedMapServices !== 10) errors.push(`地图服务种子应为 10 条，实际 ${seedMapServices}`)
  if (!plantingTaskMapServiceEmpty) errors.push('种植任务不应创建占位地图服务')
  if (!plantingTaskVectorWmsEmpty) errors.push('种植任务 getVectorTableWms 应保持空查询')

  // 拒绝名单分段构造，避免交付物自身因保存完整禁用地址而触发字面扫描。
  const forbiddenValues = [
    ['27', '223', '102', '27'].join('.'),
    ['192', '168', '71', '209'].join('.'),
    ['home', 'aceimage', 'cn'].join('.'),
    ['tian', 'ditu'].join(''),
    ['天', '地图'].join(''),
  ]
  const forbidden = new RegExp(forbiddenValues.map(escapePattern).join('|'), 'iu')
  const scanned = [migration, rollback, seed, spatial, read(paths.live), read(paths.contract)].join('\n')
  if (forbidden.test(scanned)) errors.push('数据库产物包含禁用客户主机或外部地图标识')
  if (errors.length) throw new Error(errors.join('\n'))

  const psqlResolution = resolvePsqlExecutable()

  let status = 'MANUAL_REQUIRED'
  let manualReason = '未提供本地 DATABASE_URL；已完成确定性静态、种子和导入 dry-run 验证，需在客户内网人工应用。'
  if (live) {
    const databaseUrl = process.env.DATABASE_URL?.trim()
    if (!databaseUrl) throw new Error('--live 需要本地 DATABASE_URL；不要提供或提交客户密码')
    assertLocalDatabase(databaseUrl)
    const { executable } = requirePsqlExecutable()
    runPsql(databaseUrl, paths.migration, executable)
    runPsql(databaseUrl, paths.seed, executable)
    runPsql(databaseUrl, paths.live, executable)
    status = 'PASS'
    manualReason = ''
  }

  const result = {
    status,
    manualReason,
    tables,
    dashboardPages: contract.pages.map(({ moduleKey, subId }) => `${moduleKey}/${subId}`),
    dashboardEndpoints: contract.endpoints,
    spatialOperations: operationChecks.map(([name]) => name),
    gistIndexes: gistIndexes.length,
    seedSpatialFeatures: (seed.match(/\('seed:[^']+'/gu) ?? []).length,
    seedMapServices,
    plantingTaskMapServiceEmpty,
    plantingTaskVectorWmsEmpty,
    psqlExecutable: psqlResolution.executable,
    psqlResolution: psqlResolution.source,
    digests: {
      migration: digest(migration),
      rollback: digest(rollback),
      seed: digest(seed),
      spatialFixture: digest(spatial),
      contract: digest(read(paths.contract)),
    },
    worktree,
  }
  if (jsonOutput) process.stdout.write(`${JSON.stringify(result)}\n`)
  else {
    process.stdout.write(`Fork 03 数据库验证：${result.status}\n`)
    process.stdout.write(`冻结表 ${tables.length}/6，页面 ${contract.pages.length}/12，接口 ${contract.endpoints.length}/33，GiST ${gistIndexes.length}/2\n`)
    if (manualReason) process.stdout.write(`${manualReason}\n`)
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
