const { DASHBOARD_ENDPOINT_BY_KEY } = require('../contracts/dashboardEndpoints')

class RequestTimeoutError extends Error {
  constructor(timeoutMs) {
    super(`请求超过 ${timeoutMs}ms 未完成`)
    this.name = 'RequestTimeoutError'
    this.status = 504
  }
}

const COLUMN_CONTEXT = Object.freeze({
  farmland_monitoring: ['farmland', 'cultivatedLand'],
  high_standard_farmland: ['farmland', 'highStandard'],
  protection_monitoring: ['farmland', 'basicProtection'],
  green_grain: ['farmland', 'greenGrain'],
  planting_task: ['security', 'plantingTask'],
  crop_distribution: ['security', 'cropDistribution'],
  crop_yield: ['security', 'yieldEstimate'],
  reproductive_period: ['warning', 'growthStage'],
  seedling_condition: ['warning', 'seedling'],
  growth_analysis: ['warning', 'growth'],
  maturation_prediction: ['warning', 'maturity'],
  meteorological_warning: ['warning', 'weatherDisaster'],
  pest_warning: ['warning', 'weatherDisaster']
})

const ENDPOINT_DEFAULT_CONTEXT = Object.freeze({
  queryDemonstrationSubjectDetail: ['farmland', 'greenGrain', 'green_grain'],
  queryGreenGrainIncreaseStatistics: ['farmland', 'greenGrain', 'green_grain'],
  queryGreenGrainIncreaseList: ['farmland', 'greenGrain', 'green_grain'],
  queryGreenGrainIncreaseStatisticsByArea: ['farmland', 'greenGrain', 'green_grain'],
  queryByKeyword: ['farmland', 'greenGrain', 'green_grain'],
  queryPlantingTaskStatistics: ['security', 'plantingTask', 'planting_task'],
  queryPlantingTaskByArea: ['security', 'plantingTask', 'planting_task'],
  statisticsPlantingTaskByArea: ['security', 'plantingTask', 'planting_task'],
  queryReproductivePeriodByDate: ['warning', 'growthStage', 'reproductive_period'],
  getMaturityStageByDate: ['warning', 'maturity', 'maturation_prediction'],
  queryBestHarvestTime: ['warning', 'maturity', 'maturation_prediction'],
  queryMaturityStageByYear: ['warning', 'maturity', 'maturation_prediction'],
  queryDisasterStatistics: ['warning', 'weatherDisaster', 'meteorological_warning'],
  queryWeather: ['warning', 'weatherDisaster', 'meteorological_warning'],
  queryPestWarningByDate: ['warning', 'weatherDisaster', 'pest_warning']
})

const REPORT_TYPE_CONTEXT = Object.freeze({
  1: ['farmland', 'cultivatedLand', 'farmland_monitoring'],
  2: ['security', 'yieldEstimate', 'crop_yield'],
  3: ['security', 'cropDistribution', 'crop_distribution'],
  4: ['warning', 'seedling', 'seedling_condition'],
  5: ['warning', 'weatherDisaster', 'pest_warning']
})

const DATABASE_MODULES = new Set(['farmland', 'security', 'warning'])

const GREEN_GRAIN_ENDPOINTS = new Set([
  'queryDemonstrationSubjectDetail',
  'queryGreenGrainIncreaseStatistics',
  'queryGreenGrainIncreaseList',
  'queryGreenGrainIncreaseStatisticsByArea',
  'queryByKeyword'
])

function normalizeSubjectTypes(value, fallback = [1, 2, 3]) {
  const values = Array.isArray(value) ? value : fallback
  const normalized = [...new Set(values.map(Number).filter((item) => [1, 2, 3].includes(item)))]
  return (normalized.length ? normalized : fallback).sort((left, right) => left - right)
}

function normalizeVariantText(value) {
  const text = String(value ?? '').trim().replace(/\s+/gu, ' ')
  return text || '*'
}

/**
 * 绿色增粮同一路由存在多组参数语义，统一变体键后才可由仓储精确命中对应载荷。
 */
function normalizeRequestVariant(endpointKey, params) {
  if (!GREEN_GRAIN_ENDPOINTS.has(endpointKey)) return null
  if (endpointKey === 'queryDemonstrationSubjectDetail') {
    return `subject-id:${normalizeVariantText(params.subjectId)}`
  }
  if (endpointKey === 'queryGreenGrainIncreaseStatistics') return 'subject-types:1,2,3'
  if (endpointKey === 'queryGreenGrainIncreaseStatisticsByArea') {
    return `subject-type:${Number(params.subjectType)}`
  }
  if (endpointKey === 'queryGreenGrainIncreaseList' && params.subjectType !== undefined) {
    return `subject-type:${Number(params.subjectType)}|subject-name:${normalizeVariantText(params.subjectName)}`
  }

  const subjectTypes = normalizeSubjectTypes(params.subjectTypeList).join(',')
  if (endpointKey === 'queryByKeyword') {
    return `subject-types:${subjectTypes}|keyword:${normalizeVariantText(params.keyWord)}`
  }
  return `subject-types:${subjectTypes}|subject-name:${normalizeVariantText(params.subjectName)}`
}

function normalizeYear(value) {
  const match = String(value ?? '').trim().match(/^(\d{4})/u)
  if (!match) return null
  const year = Number(match[1])
  return year >= 1900 && year <= 2200 ? year : null
}

function normalizeHalfYear(value) {
  const halfYear = Number(value)
  return halfYear === 1 || halfYear === 2 ? halfYear : null
}

function normalizeObservationDate(value) {
  const text = String(value ?? '').trim()
  let match = text.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/u)
  if (!match) match = text.match(/^(\d{4})(\d{2})(\d{2})$/u)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const candidate = new Date(Date.UTC(year, month - 1, day))
  if (
    year < 1900 || year > 2200 ||
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) return null
  return `${match[1]}-${match[2]}-${match[3]}`
}

function inferContext(endpointKey, params) {
  const fallback = endpointKey === 'queryReportList'
    ? (REPORT_TYPE_CONTEXT[Number(params.reportType)] || [])
    : (ENDPOINT_DEFAULT_CONTEXT[endpointKey] || [])
  const requestedColumnKey = params.columnKey || (COLUMN_CONTEXT[params.moduleKey] ? params.moduleKey : null)
  const columnKey = requestedColumnKey || fallback[2] || null
  const mappedContext = COLUMN_CONTEXT[columnKey] || fallback
  const moduleKey = DATABASE_MODULES.has(params.moduleKey) ? params.moduleKey : (mappedContext[0] || null)
  const rawYear = params.year || params.yearDay || params.yearMonth || null
  const numericCrop = Number(params.cropType)
  const crop = params.typeName || params.crop || (numericCrop === 0 ? '小麦' : numericCrop === 1 ? '玉米' : null)
  const requestVariant = normalizeRequestVariant(endpointKey, params)
  return {
    endpointKey,
    moduleKey,
    subId: params.subId || mappedContext[1] || null,
    columnKey,
    year: normalizeYear(rawYear),
    halfYear: normalizeHalfYear(params.halfYear ?? params.lastYear),
    crop,
    observationDate: normalizeObservationDate(params.observationDate || params.yearDay || params.yearMonth),
    districtCode: params.districtCode || null,
    ...(requestVariant ? { requestVariant } : {})
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
        operation = repository.findMapService({
          ...context,
          category: params.category || context.columnKey,
          stage: params.stage || null,
          server: params.server || undefined
        })
      } else {
        operation = repository.findDashboardPayload(context)
      }
      const value = await withTimeout(operation, timeoutMs)
      return successEnvelope(endpoint.emptyKind, value)
    }
  }
}

module.exports = {
  RequestTimeoutError,
  createDashboardService,
  inferContext,
  normalizeRequestVariant,
  normalizeObservationDate,
  normalizeYear
}
