const test = require('node:test')
const assert = require('node:assert/strict')

test('一个查询超时不会阻塞随后无关端点返回', async () => {
  const { createDashboardService, RequestTimeoutError } = require('../services/dashboardService')
  const never = new Promise(() => {})
  const repository = {
    findDashboardPayload: async ({ endpointKey }) => endpointKey === 'queryWeather'
      ? never
      : { plan: 12 },
    findTimeline: async () => [],
    findMapService: async () => null
  }
  const service = createDashboardService({ repository, timeoutMs: 20 })

  const timedOut = service.execute('queryWeather', {})
  const unrelated = await service.execute('queryPlantingTaskStatistics', { year: '2026' })

  assert.deepEqual(unrelated, { code: 200, msg: '操作成功', data: { plan: 12 } })
  await assert.rejects(timedOut, RequestTimeoutError)
})

test('一个查询失败不会改变后续请求的空载荷语义', async () => {
  const { createDashboardService } = require('../services/dashboardService')
  let calls = 0
  const service = createDashboardService({
    repository: {
      findDashboardPayload: async () => {
        calls += 1
        if (calls === 1) throw new Error('database unavailable')
        return null
      },
      findTimeline: async () => [],
      findMapService: async () => null
    },
    timeoutMs: 50
  })

  await assert.rejects(service.execute('queryWeather', {}), /database unavailable/)
  assert.deepEqual(await service.execute('queryCropType', {}), {
    code: 200,
    msg: '操作成功',
    data: []
  })
})
