const test = require('node:test')
const assert = require('node:assert/strict')

const EXPECTED_ENDPOINTS = [
  ['POST', '/screen/queryQingDaoTotalArea'],
  ['POST', '/screen/queryQingDaoGroupByYear'],
  ['GET', '/demonstrationSubject/queryDemonstrationSubjectDetail'],
  ['POST', '/screen/queryQingDaoGroupByArea'],
  ['POST', '/screen/queryProtectionMonitoringTotal'],
  ['POST', '/screen/queryProtectionMonitoringByArea'],
  ['POST', '/screen/getVectorTableWms'],
  ['POST', '/screen/getTimeLine'],
  ['POST', '/screen/queryGreenGrainIncreaseStatistics'],
  ['POST', '/screen/queryGreenGrainIncreaseList'],
  ['POST', '/screen/queryGreenGrainIncreaseStatisticsByArea'],
  ['POST', '/screen/queryReportList'],
  ['POST', '/screen/queryPlantingTaskStatistics'],
  ['POST', '/screen/queryPlantingTaskByArea'],
  ['POST', '/screen/statisticsPlantingTaskByArea'],
  ['POST', '/screen/queryProtectionMonitoringByYear'],
  ['POST', '/screen/statisticsYield'],
  ['POST', '/screen/queryYieldTotalByYear'],
  ['POST', '/screen/queryYieldTotalByArea'],
  ['POST', '/screen/getReproductiveTimeLine'],
  ['POST', '/screen/queryReproductiveAnalysis'],
  ['POST', '/screen/queryGrowthBarChart'],
  ['POST', '/screen/queryGrowthAnalysisByYear'],
  ['POST', '/screen/getMaturityStageByDate'],
  ['POST', '/screen/queryMaturityStageByYear'],
  ['POST', '/screen/queryReproductivePeriodByDate'],
  ['POST', '/screen/queryBestHarvestTime'],
  ['POST', '/screen/queryDisasterStatistics'],
  ['POST', '/screen/queryCropType'],
  ['POST', '/screen/queryWeather'],
  ['POST', '/screen/querySeedlingConditionAnalysis'],
  ['POST', '/screen/queryByKeyword'],
  ['POST', '/screen/queryPestWarningByDate']
]

test('端点清单严格覆盖冻结契约中的 32 POST 与 1 GET', () => {
  const { DASHBOARD_ENDPOINTS } = require('../contracts/dashboardEndpoints')
  const actual = DASHBOARD_ENDPOINTS.map(({ method, path }) => [method, path])

  assert.equal(actual.length, 33)
  assert.deepEqual(actual, EXPECTED_ENDPOINTS)
})

test('33 个端点在缺少数据时均返回可消费的成功空载荷', async () => {
  const { DASHBOARD_ENDPOINTS } = require('../contracts/dashboardEndpoints')
  const { createDashboardService } = require('../services/dashboardService')
  const service = createDashboardService({
    repository: {
      findDashboardPayload: async () => null,
      findTimeline: async () => [],
      findMapService: async () => null
    },
    timeoutMs: 50
  })

  for (const endpoint of DASHBOARD_ENDPOINTS) {
    const response = await service.execute(endpoint.key, {})
    assert.equal(response.code, 200, endpoint.key)
    assert.equal(typeof response.msg, 'string', endpoint.key)
    if (endpoint.key === 'queryReportList') {
      assert.deepEqual(response.rows, [], endpoint.key)
      assert.equal(response.total, 0, endpoint.key)
    } else {
      assert.ok(Object.hasOwn(response, 'data') || Object.hasOwn(response, 'extent'), endpoint.key)
    }
  }
})

test('JSONB 中已存储的契约 envelope 原样返回并保留 veryDad 拼写', async () => {
  const { createDashboardService } = require('../services/dashboardService')
  const stored = { code: 200, msg: '操作成功', data: { veryDad: 3, veryDadRate: 0.1 } }
  const service = createDashboardService({
    repository: {
      findDashboardPayload: async () => stored,
      findTimeline: async () => [],
      findMapService: async () => null
    },
    timeoutMs: 50
  })

  assert.deepEqual(await service.execute('queryGrowthBarChart', {
    columnKey: 'growth_analysis', typeName: '小麦', yearDay: '2026-05-01'
  }), stored)
})
