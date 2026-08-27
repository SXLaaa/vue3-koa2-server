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
    layer_name: 'local:小麦',
    service_type: 'wms',
    fallback_srs: 'EPSG:4490',
    metadata: { extent: [120, 35, 121, 36] }
  }])
  const repository = createPostgresRepository(client)

  const result = await repository.findMapService({
    moduleKey: 'security', subId: 'cropDistribution', category: 'crop_distribution',
    year: 2026, halfYear: 1, crop: '小麦', stage: 'mature',
    observationDate: '2026-06-01', server: 'local'
  })
  const query = result.msg.slice(result.msg.indexOf('?') + 1)
  const params = new URLSearchParams(query)

  assert.equal(result.msg.startsWith('/geoserver/local/wms?'), true)
  assert.equal(params.get('layers'), 'local:小麦')
  assert.equal(params.get('service'), 'WMS')
  assert.equal(params.get('version'), '1.1.0')
  assert.equal(params.get('request'), 'GetMap')
  assert.equal(params.get('styles'), '')
  assert.equal(params.get('format'), 'image/png')
  assert.equal(params.get('transparent'), 'true')
  assert.equal(params.get('srs'), 'EPSG:4490')
  assert.deepEqual(result.extent, [120, 35, 121, 36])
  assert.deepEqual(result.metadata, { extent: [120, 35, 121, 36] })
  assert.match(client.calls[0].text, /enabled\s*=\s*TRUE/i)
  assert.match(client.calls[0].text, /observation_date\s*=\s*\$8::date/i)
  assert.match(client.calls[0].text, /service_type[\s\S]*service_url[\s\S]*layer_name[\s\S]*fallback_srs[\s\S]*metadata/i)
  assert.doesNotMatch(client.calls[0].text, /SELECT[\s\S]*\bextent\b[\s\S]*FROM map_service/i)
  assert.deepEqual(client.calls[0].values, [
    'security', 'cropDistribution', 'crop_distribution', 2026, 1, '小麦',
    'mature', '2026-06-01', 'local'
  ])
})

test('WMS 已含 layers 时不重复追加且非 WMS 服务原样返回', async () => {
  const { createPostgresRepository } = require('../repositories/postgresRepository')
  const originalWms = '/geoserver/local/wms?service=WMS&layers=local%3Awheat&styles='
  const mixedCaseWms = '/geoserver/local/wms?service=WMS&LaYeRs=local%3Awheat'
  const rows = [
    { service_url: originalWms, layer_name: 'local:wheat', service_type: 'wms', fallback_srs: null, metadata: {} },
    { service_url: mixedCaseWms, layer_name: 'local:wheat', service_type: 'wms', fallback_srs: null, metadata: {} },
    { service_url: '/geoserver/default/wms?token=local#map', layer_name: 'local:corn', service_type: 'wms', fallback_srs: null, metadata: {} },
    { service_url: '/tiles/{z}/{x}/{y}.png', layer_name: 'ignored', service_type: 'xyz', fallback_srs: null, metadata: {} },
    { service_url: '/images/wheat.png', layer_name: 'ignored', service_type: 'image', fallback_srs: null, metadata: {} }
  ]
  let index = 0
  const repository = createPostgresRepository({ query: async () => ({ rows: [rows[index++]] }) })

  const wms = await repository.findMapService({ moduleKey: 'security', subId: 'cropDistribution' })
  const mixedCase = await repository.findMapService({ moduleKey: 'security', subId: 'cropDistribution' })
  const defaultSrs = await repository.findMapService({ moduleKey: 'security', subId: 'cropDistribution' })
  const xyz = await repository.findMapService({ moduleKey: 'security', subId: 'cropDistribution' })
  const image = await repository.findMapService({ moduleKey: 'security', subId: 'cropDistribution' })
  const query = wms.msg.slice(wms.msg.indexOf('?') + 1)

  assert.equal(wms.msg, originalWms)
  assert.equal(new URLSearchParams(query).get('layers'), 'local:wheat')
  assert.equal([...new URLSearchParams(query).keys()].filter((key) => key.toLowerCase() === 'layers').length, 1)
  assert.equal(mixedCase.msg, mixedCaseWms)
  assert.equal([...new URLSearchParams(mixedCase.msg.split('?')[1]).keys()].filter((key) => key.toLowerCase() === 'layers').length, 1)
  const defaultQuery = defaultSrs.msg.slice(defaultSrs.msg.indexOf('?') + 1).split('#')[0]
  assert.equal(new URLSearchParams(defaultQuery).get('layers'), 'local:corn')
  assert.equal(new URLSearchParams(defaultQuery).get('srs'), 'EPSG:4326')
  assert.equal(defaultSrs.msg.startsWith('/geoserver/default/wms?token=local&'), true)
  assert.equal(xyz.msg, '/tiles/{z}/{x}/{y}.png')
  assert.equal(image.msg, '/images/wheat.png')
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
