const { DASHBOARD_ENDPOINT_BY_KEY } = require('../contracts/dashboardEndpoints')

class RequestTimeoutError extends Error {
  constructor(timeoutMs) {
    super(`请求超过 ${timeoutMs}ms 未完成`)
    this.name = 'RequestTimeoutError'
    this.status = 504
  }
}

const MODULE_TO_SUB_ID = Object.freeze({
  farmland_monitoring: 'cultivatedLand',
  high_standard_farmland: 'highStandard',
  protection_monitoring: 'basicProtection',
  planting_task: 'plantingTask',
  crop_distribution: 'cropDistribution',
  crop_yield: 'yieldEstimate',
  reproductive_period: 'growthStage',
  seedling_condition: 'seedling',
  growth_analysis: 'growth',
  maturation_prediction: 'maturity',
  meteorological_warning: 'weatherDisaster',
  pest_warning: 'weatherDisaster'
})

const ENDPOINT_DEFAULT_CONTEXT = Object.freeze({
  queryDemonstrationSubjectDetail: ['green_grain', 'greenGrain'],
  queryGreenGrainIncreaseStatistics: ['green_grain', 'greenGrain'],
  queryGreenGrainIncreaseList: ['green_grain', 'greenGrain'],
  queryGreenGrainIncreaseStatisticsByArea: ['green_grain', 'greenGrain'],
  queryByKeyword: ['green_grain', 'greenGrain'],
  queryPlantingTaskStatistics: ['planting_task', 'plantingTask'],
  queryPlantingTaskByArea: ['planting_task', 'plantingTask'],
  statisticsPlantingTaskByArea: ['planting_task', 'plantingTask'],
  queryReproductivePeriodByDate: ['reproductive_period', 'growthStage'],
  getMaturityStageByDate: ['maturation_prediction', 'maturity'],
  queryBestHarvestTime: ['maturation_prediction', 'maturity'],
  queryMaturityStageByYear: ['maturation_prediction', 'maturity'],
  queryDisasterStatistics: ['meteorological_warning', 'weatherDisaster'],
  queryWeather: ['meteorological_warning', 'weatherDisaster'],
  queryPestWarningByDate: ['pest_warning', 'weatherDisaster']
})

const REPORT_TYPE_CONTEXT = Object.freeze({
  1: ['farmland_monitoring', 'cultivatedLand'],
  2: ['crop_yield', 'yieldEstimate'],
  3: ['crop_distribution', 'cropDistribution'],
  4: ['seedling_condition', 'seedling'],
  5: ['pest_warning', 'weatherDisaster']
})

function inferContext(endpointKey, params) {
  const fallback = endpointKey === 'queryReportList'
    ? (REPORT_TYPE_CONTEXT[Number(params.reportType)] || [])
    : (ENDPOINT_DEFAULT_CONTEXT[endpointKey] || [])
  const moduleKey = params.columnKey || params.moduleKey || fallback[0] || null
  const rawYear = params.year || params.yearDay || params.yearMonth || null
  const year = rawYear == null ? null : String(rawYear).slice(0, 4)
  const numericCrop = Number(params.cropType)
  const crop = params.typeName || params.crop || (numericCrop === 0 ? '小麦' : numericCrop === 1 ? '玉米' : null)
  return {
    endpointKey,
    moduleKey,
    subId: params.subId || MODULE_TO_SUB_ID[moduleKey] || fallback[1] || null,
    year,
    halfYear: params.halfYear ?? params.lastYear ?? null,
    crop,
    observationDate: params.yearDay || params.observationDate || null,
    districtCode: params.districtCode || null
  }
}

function emptyEnvelope(kind) {
  if (kind === 'report') return { code: 200, msg: '操作成功', total: 0, rows: [] }
  if (kind === 'map') return { code: 200, msg: '', extent: null }
  if (kind === 'detail') return { code: 200, msg: '操作成功', data: { imageList: [] } }
  if (kind === 'reproductiveTimeline') {
    return { code: 200, msg: '操作成功', data: { reproductiveTimeList: [], allMonth: [], allYear: [] } }
  }
  return { code: 200, msg: '操作成功', data: kind === 'array' || kind === 'timeline' ? [] : {} }
}

function successEnvelope(kind, value) {
  if (value == null) return emptyEnvelope(kind)
  if (typeof value === 'object' && !Array.isArray(value) && typeof value.code === 'number' && typeof value.msg === 'string') {
    return value
  }
  if (kind === 'report') {
    return { code: 200, msg: '操作成功', total: Number(value.total || 0), rows: Array.isArray(value.rows) ? value.rows : [] }
  }
  if (kind === 'map') return { code: 200, msg: value.msg || '', extent: value.extent ?? null }
  return { code: 200, msg: '操作成功', data: value }
}

function withTimeout(operation, timeoutMs) {
  let timer
  return Promise.race([
    Promise.resolve(operation),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new RequestTimeoutError(timeoutMs)), timeoutMs)
    })
  ]).finally(() => clearTimeout(timer))
}

/**
 * 端点分发器只协调单次仓储调用和超时，不共享请求状态，确保失败不会串扰其他请求。
 */
function createDashboardService({ repository, timeoutMs = 5_000 }) {
  if (!repository) throw new Error('repository is required')
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) throw new Error('timeoutMs must be a positive integer')

  return {
    async execute(endpointKey, params = {}) {
      const endpoint = DASHBOARD_ENDPOINT_BY_KEY.get(endpointKey)
      if (!endpoint) throw new Error(`未知大屏端点: ${endpointKey}`)
      const context = inferContext(endpointKey, params)
      let operation
      if (endpoint.emptyKind === 'timeline' || endpoint.emptyKind === 'reproductiveTimeline') {
        operation = repository.findTimeline(context)
      } else if (endpoint.emptyKind === 'map') {
        operation = repository.findMapService({ ...context, category: params.category, stage: params.stage, server: params.server })
      } else {
        operation = repository.findDashboardPayload(context)
      }
      const value = await withTimeout(operation, timeoutMs)
      return successEnvelope(endpoint.emptyKind, value)
    }
  }
}

module.exports = { RequestTimeoutError, createDashboardService, inferContext }
