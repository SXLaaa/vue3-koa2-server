const test = require('node:test')
const assert = require('node:assert/strict')
const { existsSync, readFileSync } = require('node:fs')
const path = require('node:path')

test('绿色增粮请求参数归一化为互不串用的查询变体', () => {
  const { inferContext } = require('../services/dashboardService')

  assert.equal(
    inferContext('queryGreenGrainIncreaseStatistics', {}).requestVariant,
    'subject-types:1,2,3'
  )
  assert.equal(
    inferContext('queryGreenGrainIncreaseList', { subjectTypeList: [3, 1, 2, 2], subjectName: '  ' }).requestVariant,
    'subject-types:1,2,3|subject-name:*'
  )
  assert.equal(
    inferContext('queryGreenGrainIncreaseList', { subjectType: 1, subjectName: ' 华强合作社 ' }).requestVariant,
    'subject-type:1|subject-name:华强合作社'
  )
  assert.equal(
    inferContext('queryGreenGrainIncreaseStatisticsByArea', { subjectType: 2 }).requestVariant,
    'subject-type:2'
  )
  assert.equal(
    inferContext('queryGreenGrainIncreaseStatisticsByArea', { subjectType: 3 }).requestVariant,
    'subject-type:3'
  )
  assert.equal(
    inferContext('queryByKeyword', { subjectTypeList: [3, 1], keyWord: ' 平度 ' }).requestVariant,
    'subject-types:1,3|keyword:平度'
  )
  assert.equal(
    inferContext('queryDemonstrationSubjectDetail', { subjectId: 42 }).requestVariant,
    'subject-id:42'
  )
})

test('仓储使用查询变体隔离绿色增粮载荷', async () => {
  const { createPostgresRepository } = require('../repositories/postgresRepository')
  let captured
  const repository = createPostgresRepository({
    query: async (text, values) => {
      captured = { text, values }
      return { rows: [{ payload: { code: 200, msg: 'ok', data: [{ subjectType: 2 }] } }] }
    }
  })

  await repository.findDashboardPayload({
    moduleKey: 'farmland',
    subId: 'greenGrain',
    endpointKey: 'queryGreenGrainIncreaseStatisticsByArea',
    requestVariant: 'subject-type:2'
  })

  assert.match(captured.text, /request_variant\s*=\s*\$4/iu)
  assert.deepEqual(captured.values, [
    'farmland', 'greenGrain', 'queryGreenGrainIncreaseStatisticsByArea', 'subject-type:2'
  ])
})

test('生育期时间轴返回 periodType 并按生产季年份过滤', async () => {
  const { createPostgresRepository } = require('../repositories/postgresRepository')
  let captured
  const repository = createPostgresRepository({
    query: async (text, values) => {
      captured = { text, values }
      return {
        rows: [{
          timeYear: 2026,
          halfYear: 2,
          crop: '小麦',
          productionDate: '2025-11-20',
          periodType: '越冬期',
          checked: true,
          sortOrder: 10,
          availableYears: [2025, 2026]
        }]
      }
    }
  })

  const result = await repository.findTimeline({
    endpointKey: 'getReproductiveTimeLine',
    moduleKey: 'warning',
    subId: 'growthStage',
    crop: '小麦',
    year: 2026
  })

  assert.match(captured.text, /stage\s+AS\s+"periodType"/iu)
  assert.match(captured.text, /year\s*=\s*available_seasons\."selectedYear"/iu)
  assert.deepEqual(captured.values, ['warning', 'growthStage', '小麦', 2026])
  assert.equal(result.year, 2026)
  assert.deepEqual(result.allYear, [
    { timeYear: 2025, check: false },
    { timeYear: 2026, check: true }
  ])
  assert.equal(result.reproductiveTimeList[0].periodType, '越冬期')
  assert.equal(result.reproductiveTimeList[0].productionDate, '2025-11-20')
})

test('请求生产季不存在时回退该作物最新生产季', async () => {
  const { createPostgresRepository } = require('../repositories/postgresRepository')
  let captured
  const repository = createPostgresRepository({
    query: async (text, values) => {
      captured = { text, values }
      return {
        rows: [{
          timeYear: 2025,
          crop: '玉米',
          productionDate: '2025-08-20',
          periodType: '乳熟期',
          checked: true,
          sortOrder: 10,
          availableYears: [2025]
        }]
      }
    }
  })

  const result = await repository.findTimeline({
    endpointKey: 'getReproductiveTimeLine',
    moduleKey: 'warning',
    subId: 'growthStage',
    crop: '玉米',
    year: 2026
  })

  assert.match(captured.text, /CASE[\s\S]*\$4\s*=\s*ANY[\s\S]*max\(year\)/iu)
  assert.deepEqual(captured.values, ['warning', 'growthStage', '玉米', 2026])
  assert.equal(result.year, 2025)
  assert.equal(result.reproductiveTimeList[0].periodType, '乳熟期')
})

test('002 迁移提供查询变体键和只读模块契约视图', () => {
  const migrationDir = path.resolve(__dirname, '..', 'database', 'migrations')
  const upPath = path.join(migrationDir, '002_dashboard_contract_views.up.sql')
  const downPath = path.join(migrationDir, '002_dashboard_contract_views.down.sql')

  assert.ok(existsSync(upPath), '缺少 002_dashboard_contract_views.up.sql')
  assert.ok(existsSync(downPath), '缺少 002_dashboard_contract_views.down.sql')
  const up = readFileSync(upPath, 'utf8')
  const down = readFileSync(downPath, 'utf8')
  assert.match(up, /ADD\s+COLUMN\s+request_variant/iu)
  assert.match(up, /dashboard_payload_lookup_uq[\s\S]*request_variant/iu)
  assert.match(up, /CREATE\s+VIEW\s+dashboard_module_endpoint_v/iu)
  assert.match(up, /CREATE\s+VIEW\s+dashboard_module_read_v/iu)
  assert.match(down, /DROP\s+VIEW\s+IF\s+EXISTS\s+dashboard_module_read_v/iu)
  assert.match(down, /DROP\s+COLUMN\s+IF\s+EXISTS\s+request_variant/iu)
})

test('本地种子通过页面接口和关键查询组合覆盖检查', () => {
  let verifier
  try {
    verifier = require('../scripts/verify-dashboard-data-coverage')
  } catch {
    verifier = null
  }
  assert.equal(typeof verifier?.verifyDashboardDataCoverage, 'function', '缺少可执行的组合覆盖检查器')

  const result = verifier.verifyDashboardDataCoverage()
  assert.equal(result.routeCount, 33)
  assert.equal(result.pageCount, 12)
  assert.equal(result.missing.length, 0, result.missing.join('\n'))
  assert.equal(result.plantingTaskMapServiceEmpty, true)
  assert.ok(result.payloadCombinationCount > 43, '应检查页面、端点、年份、作物和查询变体组合，而非只数路由')
})
