import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { resolvePsqlExecutable } from '../../tools/data-import/lib/psql.mjs'

const testDir = path.dirname(fileURLToPath(import.meta.url))
const worktree = path.resolve(testDir, '..', '..')
const node = process.execPath

function runJson(script, args = [], env = {}) {
  const stdout = execFileSync(node, [path.join(worktree, script), ...args], {
    cwd: worktree,
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: '', ...env },
  })
  return JSON.parse(stdout)
}

function createExecutable(root, ...segments) {
  const executable = path.join(root, ...segments)
  mkdirSync(path.dirname(executable), { recursive: true })
  writeFileSync(executable, '')
  return executable
}

test('确定性验证器证明冻结表、12页面和空间契约均被覆盖', () => {
  const result = runJson('database/verify.mjs', ['--json'])

  assert.equal(result.status, 'MANUAL_REQUIRED')
  assert.deepEqual(result.tables, [
    'administrative_region',
    'agricultural_feature',
    'auth_user',
    'dashboard_payload',
    'map_service',
    'screen_timeline',
  ])
  assert.equal(result.dashboardPages.length, 12)
  assert.equal(result.dashboardEndpoints.length, 33)
  assert.deepEqual(result.spatialOperations, [
    'ST_Area(geom::geography)',
    'ST_Intersection',
    'ST_Intersects',
    'ST_Within',
  ])
  assert.equal(result.gistIndexes, 2)
  assert.equal(result.seedSpatialFeatures >= 2, true)
  assert.equal(result.seedMapServices, 10)
  assert.equal(result.plantingTaskMapServiceEmpty, true)
  assert.equal(result.plantingTaskVectorWmsEmpty, true)
})

test('psql 解析优先使用显式 MAIN_GRAIN_PSQL，其次才是 PATH 和 Windows 标准目录', (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'fork03-psql-priority-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const explicit = createExecutable(root, 'explicit', 'psql.exe')
  const pathExecutable = createExecutable(root, 'path-bin', 'psql.exe')
  createExecutable(root, 'program-files', 'PostgreSQL', '18', 'bin', 'psql.exe')

  const result = runJson('database/verify.mjs', ['--json'], {
    MAIN_GRAIN_PSQL: explicit,
    PATH: path.dirname(pathExecutable),
    ProgramFiles: path.join(root, 'program-files'),
  })

  assert.equal(result.psqlExecutable, explicit)
  assert.equal(result.psqlResolution, 'environment')
})

test('psql 解析在未显式配置时优先使用 PATH', (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'fork03-psql-path-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const pathExecutable = createExecutable(root, 'path-bin', 'psql.exe')
  createExecutable(root, 'program-files', 'PostgreSQL', '18', 'bin', 'psql.exe')

  const result = runJson('database/verify.mjs', ['--json'], {
    MAIN_GRAIN_PSQL: '',
    PATH: path.dirname(pathExecutable),
    ProgramFiles: path.join(root, 'program-files'),
  })

  assert.equal(result.psqlExecutable, pathExecutable)
  assert.equal(result.psqlResolution, 'path')
})

test('psql 解析可检测 Windows PostgreSQL 标准安装目录并选择最高版本', (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'fork03-psql-standard-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const programFiles = path.join(root, 'program-files')
  createExecutable(root, 'program-files', 'PostgreSQL', '17', 'bin', 'psql.exe')
  const expected = createExecutable(root, 'program-files', 'PostgreSQL', '18', 'bin', 'psql.exe')

  const result = resolvePsqlExecutable({
    platform: 'win32',
    env: {
      MAIN_GRAIN_PSQL: '',
      PATH: '',
      ProgramFiles: programFiles,
      'ProgramFiles(x86)': '',
    },
  })

  assert.equal(result.executable, expected)
  assert.equal(result.source, 'windows-standard')
})

test('GeoJSON dry-run 将 Polygon 归一化为 MultiPolygon 并生成稳定 upsert 键', () => {
  const args = [
    '--input', 'tools/data-import/fixtures/sample.geojson',
    '--format', 'geojson',
    '--source-srid', '4326',
    '--dry-run',
    '--json',
  ]
  const first = runJson('tools/data-import/import.mjs', args)
  const second = runJson('tools/data-import/import.mjs', args)

  assert.equal(first.status, 'MANUAL_REQUIRED')
  assert.equal(first.recordCount, 2)
  assert.deepEqual(first.geometryTypes, ['MultiPolygon'])
  assert.deepEqual(first.stableKeys, second.stableKeys)
  assert.equal(first.sqlDigest, second.sqlDigest)
  assert.match(first.sqlPreview, /ON CONFLICT \(feature_key\) DO UPDATE/u)
})

test('CSV dry-run 使用显式边界框生成 4326 MultiPolygon', () => {
  const result = runJson('tools/data-import/import.mjs', [
    '--input', 'tools/data-import/fixtures/sample.csv',
    '--format', 'csv',
    '--source-srid', '4326',
    '--dry-run',
    '--json',
  ])

  assert.equal(result.recordCount, 2)
  assert.deepEqual(result.geometryTypes, ['MultiPolygon'])
  assert.equal(result.sourceSrid, 4326)
  assert.equal(new Set(result.stableKeys).size, 2)
})

test('SHP dry-run 在未执行 GDAL 时给出确定性内网转换计划', () => {
  const result = runJson('tools/data-import/import.mjs', [
    '--input', 'customer-data.shp',
    '--format', 'shp',
    '--source-srid', '4490',
    '--dry-run',
    '--plan-only',
    '--json',
  ])

  assert.equal(result.status, 'MANUAL_REQUIRED')
  assert.equal(result.nextStep, 'RUN_ON_CUSTOMER_INTRANET')
  assert.equal(result.targetSrid, 4326)
  assert.match(result.command, /^ogr2ogr /u)
  assert.doesNotMatch(result.command, /https?:\/\//u)
})

test('导入器拒绝不受支持的 SRID，且不尝试连接数据库', () => {
  const result = spawnSync(node, [
    path.join(worktree, 'tools/data-import/import.mjs'),
    '--input', 'tools/data-import/fixtures/sample.geojson',
    '--format', 'geojson',
    '--source-srid', '0',
    '--dry-run',
    '--json',
  ], {
    cwd: worktree,
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: '' },
  })

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /source-srid 必须是正整数/u)
})
