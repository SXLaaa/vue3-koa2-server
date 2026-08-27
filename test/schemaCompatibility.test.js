const test = require('node:test')
const assert = require('node:assert/strict')

function captureClient(rows = []) {
  const calls = []
  return {
    calls,
    query: async (text, values) => {
      calls.push({ text, values })
      return { rows }
    }
  }
}

test('dashboard_payload 按端点隔离，未提供维度回退最小种子且提供维度精确匹配', async () => {
  const { createPostgresRepository } = require('../repositories/postgresRepository')
  const client = captureClient([{ payload: { code: 200, msg: '操作成功', data: [] } }])
  const repository = createPostgresRepository(client)

  await repository.findDashboardPayload({
    moduleKey: 'security',
    subId: 'cropDistribution',
    endpointKey: 'queryProtectionMonitoringByArea',
    year: null,
    halfYear: null,
    crop: null,
    observationDate: null,
    districtCode: null
  })
  await repository.findDashboardPayload({
    moduleKey: 'security',
    subId: 'cropDistribution',
    endpointKey: 'queryProtectionMonitoringByArea',
    year: 2026,
    halfYear: 1,
    crop: '小麦',
    observationDate: '2026-05-01',
    districtCode: '370200'
  })

  assert.match(client.calls[0].text, /endpoint_key\s*=\s*\$3/i)
  assert.deepEqual(client.calls[0].values, ['security', 'cropDistribution', 'queryProtectionMonitoringByArea'])
  assert.doesNotMatch(client.calls[0].text, /year[^\n]*(?:=|distinct)\s*\$\d/i)
  assert.match(client.calls[0].text, /ORDER BY[\s\S]*NULLS FIRST[\s\S]*updated_at DESC[\s\S]*id DESC/i)

  assert.match(client.calls[1].text, /year\s*=\s*\$4/i)
  assert.match(client.calls[1].text, /half_year\s*=\s*\$5/i)
  assert.match(client.calls[1].text, /crop\s*=\s*\$6/i)
  assert.match(client.calls[1].text, /observation_date\s*=\s*\$7::date/i)
  assert.match(client.calls[1].text, /district_code\s*=\s*\$8/i)
  assert.deepEqual(client.calls[1].values, [
    'security', 'cropDistribution', 'queryProtectionMonitoringByArea',
    2026, 1, '小麦', '2026-05-01', '370200'
  ])
})

test('日期上下文只产生真实 observation_date，并将 columnKey 映射到冻结模块', () => {
  const { inferContext } = require('../services/dashboardService')

  assert.deepEqual(inferContext('queryGrowthBarChart', {
    columnKey: 'growth_analysis',
    yearDay: '2026-02-28',
    typeName: '小麦'
  }), {
    endpointKey: 'queryGrowthBarChart',
    moduleKey: 'warning',
    subId: 'growth',
    columnKey: 'growth_analysis',
    year: 2026,
    halfYear: null,
    crop: '小麦',
    observationDate: '2026-02-28',
    districtCode: null
  })
  assert.equal(inferContext('queryGrowthBarChart', { columnKey: 'growth_analysis', yearDay: '2026' }).observationDate, null)
  assert.equal(inferContext('queryGrowthBarChart', { columnKey: 'growth_analysis', yearDay: '2026-02-30' }).observationDate, null)
  assert.equal(inferContext('queryGrowthBarChart', { columnKey: 'growth_analysis', yearMonth: '2026-08' }).observationDate, null)
  assert.equal(inferContext('queryGrowthBarChart', { columnKey: 'growth_analysis', yearDay: '20260827' }).observationDate, '2026-08-27')
})

test('screen_timeline 只使用冻结列并稳定生成三组生育期时间轴', async () => {
  const { createPostgresRepository } = require('../repositories/postgresRepository')
  const client = captureClient([
    { timeYear: 2026, halfYear: 1, crop: '小麦', productionDate: '2026-05-02', stage: '拔节', label: '5月2日', checked: false, sortOrder: 3 },
    { timeYear: 2025, halfYear: 2, crop: '小麦', productionDate: '2025-12-01', stage: '越冬', label: '12月1日', checked: true, sortOrder: 1 },
    { timeYear: 2026, halfYear: 1, crop: '小麦', productionDate: '2026-05-01', stage: '返青', label: '5月1日', checked: true, sortOrder: 2 }
  ])
  const repository = createPostgresRepository(client)

  const result = await repository.findTimeline({
    endpointKey: 'getReproductiveTimeLine',
    moduleKey: 'warning',
    subId: 'growthStage',
    crop: '小麦'
  })

  assert.match(client.calls[0].text, /year\s+AS\s+"timeYear"/i)
  assert.match(client.calls[0].text, /active\s+AS\s+checked/i)
  assert.doesNotMatch(client.calls[0].text, /\btime_year\b|\bis_default\b/i)
  assert.deepEqual(result.allYear, [
    { timeYear: 2025, check: true },
    { timeYear: 2026, check: true }
  ])
  assert.deepEqual(result.allMonth, [
    { timeYear: 2025, timeMonth: 12, check: true },
    { timeYear: 2026, timeMonth: 5, check: true }
  ])
  assert.deepEqual(result.reproductiveTimeList.map(({ productionDate }) => productionDate), [
    '2025-12-01', '2026-05-01', '2026-05-02'
  ])
})

test('map_service 使用 metadata.extent、enabled 与九个冻结查找维度', async () => {
  const { createPostgresRepository } = require('../repositories/postgresRepository')
  const client = captureClient([{
    service_url: '/geoserver/local/wms',
    layer_name: 'local:wheat',
    metadata: { extent: [120, 35, 121, 36] }
  }])
  const repository = createPostgresRepository(client)

  assert.deepEqual(await repository.findMapService({
    moduleKey: 'security', subId: 'cropDistribution', category: 'crop_distribution',
    year: 2026, halfYear: 1, crop: '小麦', stage: 'mature',
    observationDate: '2026-06-01', server: 'local'
  }), {
    msg: '/geoserver/local/wms',
    extent: [120, 35, 121, 36],
    metadata: { extent: [120, 35, 121, 36] }
  })
  assert.match(client.calls[0].text, /enabled\s*=\s*TRUE/i)
  assert.match(client.calls[0].text, /observation_date\s*=\s*\$8::date/i)
  assert.doesNotMatch(client.calls[0].text, /SELECT[\s\S]*\bextent\b[\s\S]*FROM map_service/i)
  assert.deepEqual(client.calls[0].values, [
    'security', 'cropDistribution', 'crop_distribution', 2026, 1, '小麦',
    'mature', '2026-06-01', 'local'
  ])
})

test('getVectorTableWms 默认用前端 columnKey 作为地图 category', async () => {
  const { createDashboardService } = require('../services/dashboardService')
  let captured
  const service = createDashboardService({
    repository: {
      findDashboardPayload: async () => null,
      findTimeline: async () => [],
      findMapService: async (context) => { captured = context; return null }
    },
    timeoutMs: 50
  })

  assert.deepEqual(await service.execute('getVectorTableWms', {
    columnKey: 'planting_task', year: 2026
  }), { code: 200, msg: '', extent: null })
  assert.equal(captured.moduleKey, 'security')
  assert.equal(captured.category, 'planting_task')
})

test('空间 SQL 使用 category 与 feature_key，且不引用旧 feature_type/id 列', async () => {
  const { createSpatialRepository } = require('../repositories/spatialRepository')
  const client = captureClient([{ contained: true, feature_count: '1', area_square_meters: '12.5' }])
  const repository = createSpatialRepository(client)

  await repository.findIntersections({ regionCode: '370200', category: 'wheat' })
  await repository.isFeatureWithinRegion({ featureId: 'parcel-001', regionCode: '370200' })
  await repository.calculateIntersectionArea({ regionCode: '370200', category: 'wheat' })

  assert.match(client.calls[0].text, /f\.feature_key\s+AS\s+feature_id/i)
  assert.match(client.calls[0].text, /f\.category\s*=\s*\$2/i)
  assert.match(client.calls[1].text, /f\.feature_key\s*=\s*\$1/i)
  assert.match(client.calls[2].text, /f\.category\s*=\s*\$2/i)
  for (const { text } of client.calls) {
    assert.doesNotMatch(text, /\bfeature_type\b|\bf\.id\b/i)
  }
  assert.deepEqual(client.calls[1].values, ['parcel-001', '370200'])
})
