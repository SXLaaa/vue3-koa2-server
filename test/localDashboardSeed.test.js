const test = require('node:test')
const assert = require('node:assert/strict')
const { existsSync, readFileSync } = require('node:fs')
const path = require('node:path')

const seedPath = path.resolve(__dirname, '..', 'database', 'seeds', '002_local_dashboard.sql')

test('本地真实联调种子只向浏览器返回可访问的 GeoServer 地址', () => {
  assert.ok(existsSync(seedPath), '缺少 database/seeds/002_local_dashboard.sql')
  const seed = readFileSync(seedPath, 'utf8')

  assert.match(seed, /http:\/\/27\.223\.102\.27:8081\/geoserver\/qingdao-agro\/wms/u)
  assert.doesNotMatch(seed, /192\.168\.71\.209:8060/u)
  assert.match(seed, /qingdao-agro:farmland_monitoring_2025_209664/u)
  assert.match(seed, /qingdao-agro:crop_distribution_2026_xm_954713/u)
  assert.match(seed, /'historical'/u)
  assert.match(seed, /'new'/u)
})

test('本地真实联调种子覆盖认证、十二个页面并保持种植任务地图为空', () => {
  assert.ok(existsSync(seedPath), '缺少 database/seeds/002_local_dashboard.sql')
  const seed = readFileSync(seedPath, 'utf8')
  const expectedPages = [
    ['farmland', 'cultivatedLand'],
    ['farmland', 'highStandard'],
    ['farmland', 'basicProtection'],
    ['farmland', 'greenGrain'],
    ['security', 'plantingTask'],
    ['security', 'cropDistribution'],
    ['security', 'yieldEstimate'],
    ['warning', 'growthStage'],
    ['warning', 'seedling'],
    ['warning', 'growth'],
    ['warning', 'maturity'],
    ['warning', 'weatherDisaster'],
  ]

  assert.match(seed, /'local-acceptance'/u)
  for (const [moduleKey, subId] of expectedPages) {
    assert.match(seed, new RegExp(`'${moduleKey}'\\s*,\\s*'${subId}'`, 'u'), `${moduleKey}/${subId}`)
  }

  const mapValues = seed.match(/INSERT\s+INTO\s+map_service[\s\S]*?VALUES([\s\S]*?)ON\s+CONFLICT/iu)?.[1] ?? ''
  assert.doesNotMatch(mapValues, /'security'\s*,\s*'plantingTask'/u)
})

test('getVectorTableWms 未指定 server 时允许数据库按业务维度命中服务', async () => {
  const { createDashboardService } = require('../services/dashboardService')
  const captured = []
  const service = createDashboardService({
    repository: {
      findDashboardPayload: async () => null,
      findTimeline: async () => [],
      findMapService: async (context) => {
        captured.push(context)
        return null
      },
    },
    timeoutMs: 50,
  })

  await service.execute('getVectorTableWms', {
    columnKey: 'farmland_monitoring',
    year: 2025,
    halfYear: 2,
  })
  await service.execute('getVectorTableWms', {
    columnKey: 'farmland_monitoring',
    year: 2025,
    halfYear: 2,
    server: 'historical',
  })

  assert.equal(captured[0].server, undefined)
  assert.equal(captured[1].server, 'historical')
})
