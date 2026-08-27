const test = require('node:test')
const assert = require('node:assert/strict')

test('页面载荷查询使用参数占位符并保留全部冻结维度', async () => {
  const { createPostgresRepository } = require('../repositories/postgresRepository')
  const calls = []
  const repository = createPostgresRepository({
    query: async (text, values) => {
      calls.push({ text, values })
      return { rows: [{ payload: { value: 8 } }] }
    }
  })

  const result = await repository.findDashboardPayload({
    endpointKey: 'statisticsYield',
    moduleKey: 'security',
    subId: 'yieldEstimate',
    year: 2026,
    halfYear: 1,
    crop: '小麦',
    observationDate: '2026-05-01',
    districtCode: '370200'
  })

  assert.deepEqual(result, { value: 8 })
  assert.match(calls[0].text, /module_key = \$1/)
  assert.match(calls[0].text, /sub_id = \$2/)
  assert.match(calls[0].text, /endpoint_key = \$3/)
  assert.match(calls[0].text, /observation_date/)
  assert.deepEqual(calls[0].values, [
    'security', 'yieldEstimate', 'statisticsYield', 2026, 1, '小麦', '2026-05-01', '370200'
  ])
  assert.equal(calls[0].text.includes('crop_yield'), false)
})

test('用户查询只按参数化用户名读取认证字段', async () => {
  const { createPostgresRepository } = require('../repositories/postgresRepository')
  let captured
  const repository = createPostgresRepository({
    query: async (text, values) => {
      captured = { text, values }
      return {
        rows: [{ id: 4, username: 'tester', password_hash: 'hash', display_name: '测试员', status: 1 }]
      }
    }
  })

  assert.deepEqual(await repository.findUserByUsername('tester'), {
    id: 4,
    username: 'tester',
    passwordHash: 'hash',
    displayName: '测试员',
    status: 1
  })
  assert.match(captured.text, /username = \$1/)
  assert.deepEqual(captured.values, ['tester'])
  assert.equal(captured.text.includes('tester'), false)
})

test('时间轴查询同时按模块、子页面和作物参数隔离', async () => {
  const { createPostgresRepository } = require('../repositories/postgresRepository')
  let captured
  const repository = createPostgresRepository({
    query: async (text, values) => {
      captured = { text, values }
      return { rows: [{ timeYear: '2026', halfYear: '1' }] }
    }
  })

  assert.deepEqual(await repository.findTimeline({
    endpointKey: 'getTimeLine',
    moduleKey: 'security',
    subId: 'cropDistribution',
    crop: '小麦'
  }), [{ timeYear: '2026', halfYear: '1' }])
  assert.match(captured.text, /sub_id = \$2/)
  assert.match(captured.text, /crop = \$3/)
  assert.deepEqual(captured.values, ['security', 'cropDistribution', '小麦'])
})

test('地图元数据查询保留冻结的八个检索维度并返回空安全描述', async () => {
  const { createPostgresRepository } = require('../repositories/postgresRepository')
  let captured
  const repository = createPostgresRepository({
    query: async (text, values) => {
      captured = { text, values }
      return { rows: [{ service_url: '', layer_name: 'local:wheat', metadata: { extent: [0, 0, 1, 1] } }] }
    }
  })
  const context = {
    moduleKey: 'security', subId: 'cropDistribution', category: 'crop_distribution',
    year: 2026, halfYear: 1, crop: '小麦', stage: 'mature',
    observationDate: '2026-06-01', server: 'local'
  }

  assert.deepEqual(await repository.findMapService(context), {
    msg: 'local:wheat', extent: [0, 0, 1, 1], metadata: { extent: [0, 0, 1, 1] }
  })
  assert.deepEqual(captured.values, [
    'security', 'cropDistribution', 'crop_distribution', 2026, 1, '小麦', 'mature', '2026-06-01', 'local'
  ])
})

test('报告类型和唯一业务端点能推导无 columnKey 请求的页面维度', () => {
  const { inferContext } = require('../services/dashboardService')

  assert.deepEqual(
    [inferContext('queryReportList', { reportType: 4 }).moduleKey, inferContext('queryReportList', { reportType: 4 }).subId],
    ['warning', 'seedling']
  )
  assert.deepEqual(
    [inferContext('queryBestHarvestTime', { year: '2026' }).moduleKey, inferContext('queryBestHarvestTime', { year: '2026' }).subId],
    ['warning', 'maturity']
  )
})
