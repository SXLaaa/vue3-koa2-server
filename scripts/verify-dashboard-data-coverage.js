const { existsSync, readFileSync } = require('node:fs')
const path = require('node:path')

const serverRoot = path.resolve(__dirname, '..')
const seedPath = path.join(serverRoot, 'database', 'seeds', '002_local_dashboard.sql')
const contractPath = path.join(serverRoot, 'database', 'contracts', 'dashboard-contract.json')
const guidePath = path.join(serverRoot, 'docs', 'dashboard-data-contract.md')

function tokenValue(token) {
  const text = token.trim()
  if (text === 'NULL') return null
  if (/^\d+$/u.test(text)) return Number(text)
  const date = text.match(/^DATE\s+'([^']+)'$/u)
  if (date) return date[1]
  const quoted = text.match(/^'([^']*)'$/u)
  return quoted ? quoted[1] : text
}

function insertBodies(sql, tableName) {
  const pattern = new RegExp(
    `INSERT\\s+INTO\\s+${tableName}\\s*\\([^)]*\\)\\s*VALUES([\\s\\S]*?)(?:ON\\s+CONFLICT\\s+DO\\s+NOTHING;|;(?=\\s*(?:--|DELETE|UPDATE|INSERT|COMMIT)))`,
    'giu'
  )
  return [...sql.matchAll(pattern)].map((match) => match[1])
}

function parseLeadingRows(sql, tableName) {
  const rowPattern = /\(\s*'(farmland|security|warning)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*(NULL|\d+)\s*,\s*(NULL|\d+)\s*,\s*(NULL|'[^']*')\s*,\s*(NULL|DATE\s+'[^']+')/giu
  return insertBodies(sql, tableName).flatMap((body) => [...body.matchAll(rowPattern)].map((match) => ({
    moduleKey: match[1],
    subId: match[2],
    endpointKey: match[3],
    year: tokenValue(match[4]),
    halfYear: tokenValue(match[5]),
    crop: tokenValue(match[6]),
    observationDate: tokenValue(match[7])
  })))
}

function payloadKey(row) {
  return [
    row.moduleKey,
    row.subId,
    row.endpointKey,
    row.year ?? '*',
    row.halfYear ?? '*',
    row.crop ?? '*',
    row.observationDate ?? '*'
  ].join('|')
}

function requiredKey(moduleKey, subId, endpointKey, year = null, halfYear = null, crop = null, observationDate = null) {
  return payloadKey({ moduleKey, subId, endpointKey, year, halfYear, crop, observationDate })
}

function addRequired(required, ...values) {
  required.add(requiredKey(...values))
}

/**
 * 覆盖检查以页面、端点、年份、作物、观测日和查询变体为粒度，不把“路由存在”当成数据可消费证明。
 */
function verifyDashboardDataCoverage() {
  const seed = readFileSync(seedPath, 'utf8')
  const contract = JSON.parse(readFileSync(contractPath, 'utf8'))
  const payloadRows = parseLeadingRows(seed, 'dashboard_payload')
  const timelineRows = parseLeadingRows(seed, 'screen_timeline')
  const mapRows = parseLeadingRows(seed, 'map_service')
  const payloadKeys = new Set(payloadRows.map(payloadKey))
  const required = new Set()
  const missing = []

  for (const year of [2023, 2025]) {
    addRequired(required, 'farmland', 'cultivatedLand', 'queryQingDaoTotalArea', year, 2)
    addRequired(required, 'farmland', 'cultivatedLand', 'queryQingDaoGroupByArea', year, 2)
    addRequired(required, 'farmland', 'cultivatedLand', 'queryReportList', year, 2)
  }
  for (const endpoint of ['queryQingDaoTotalArea', 'queryQingDaoGroupByArea']) {
    addRequired(required, 'farmland', 'highStandard', endpoint, 2025, 2)
  }
  for (const year of [2025, 2026]) {
    for (const endpoint of ['queryProtectionMonitoringTotal', 'queryProtectionMonitoringByArea']) {
      addRequired(required, 'farmland', 'basicProtection', endpoint, year, 2)
    }
  }
  for (const endpoint of ['queryPlantingTaskStatistics', 'queryPlantingTaskByArea', 'statisticsPlantingTaskByArea']) {
    addRequired(required, 'security', 'plantingTask', endpoint, 2025)
  }

  for (const [year, crop] of [[2023, '玉米'], [2024, '玉米'], [2025, '玉米'], [2026, '小麦']]) {
    addRequired(required, 'security', 'cropDistribution', 'queryProtectionMonitoringTotal', year, 2, crop)
    addRequired(required, 'security', 'cropDistribution', 'queryProtectionMonitoringByArea', year, null, crop)
    addRequired(required, 'security', 'cropDistribution', 'queryReportList', year, 2, crop)
  }
  for (const crop of ['小麦', '玉米']) {
    addRequired(required, 'security', 'cropDistribution', 'queryProtectionMonitoringByYear', null, null, crop)
  }

  for (const [year, crop] of [[2025, '小麦'], [2025, '玉米'], [2026, '小麦']]) {
    addRequired(required, 'security', 'yieldEstimate', 'statisticsYield', year, 2, crop)
    addRequired(required, 'security', 'yieldEstimate', 'queryYieldTotalByArea', year, null, crop)
    addRequired(required, 'security', 'yieldEstimate', 'queryReportList', year, 2, crop)
  }
  for (const crop of ['小麦', '玉米']) {
    addRequired(required, 'security', 'yieldEstimate', 'queryYieldTotalByYear', null, null, crop)
  }

  for (const row of timelineRows.filter((item) => item.endpointKey === 'reproductive')) {
    if (row.subId === 'growthStage') {
      addRequired(required, 'warning', 'growthStage', 'queryReproductiveAnalysis', row.year, null, row.crop, row.observationDate)
    } else if (row.subId === 'seedling') {
      addRequired(required, 'warning', 'growthStage', 'queryReproductivePeriodByDate', row.year, null, row.crop, row.observationDate)
      addRequired(required, 'warning', 'seedling', 'querySeedlingConditionAnalysis', row.year, null, row.crop, row.observationDate)
      addRequired(required, 'warning', 'seedling', 'queryReportList', row.year, 2, row.crop)
    } else if (row.subId === 'growth') {
      addRequired(required, 'warning', 'growthStage', 'queryReproductivePeriodByDate', row.year, null, row.crop, row.observationDate)
      addRequired(required, 'warning', 'growth', 'queryGrowthBarChart', row.year, null, row.crop, row.observationDate)
      addRequired(required, 'warning', 'growth', 'queryGrowthAnalysisByYear', row.year, null, row.crop)
    } else if (row.subId === 'maturity') {
      addRequired(required, 'warning', 'maturity', 'getMaturityStageByDate', row.year, null, row.crop, row.observationDate)
      addRequired(required, 'warning', 'maturity', 'queryBestHarvestTime', row.year, null, row.crop)
      addRequired(required, 'warning', 'maturity', 'queryMaturityStageByYear', row.year, null, row.crop)
    } else if (row.subId === 'weatherDisaster') {
      if (row.crop === '病虫害') {
        addRequired(required, 'warning', 'weatherDisaster', 'queryPestWarningByDate', row.year, null, row.crop, row.observationDate)
        addRequired(required, 'warning', 'weatherDisaster', 'queryReportList', row.year, 2, row.crop)
      } else {
        addRequired(required, 'warning', 'weatherDisaster', 'queryDisasterStatistics', row.year, null, row.crop, row.observationDate)
      }
    }
  }

  for (const key of required) {
    if (!payloadKeys.has(key)) missing.push(`缺少 dashboard_payload 组合：${key}`)
  }

  const pagesInSeed = new Set([
    ...payloadRows.map((row) => `${row.moduleKey}/${row.subId}`),
    ...timelineRows.map((row) => `${row.moduleKey}/${row.subId}`)
  ])
  for (const page of contract.pages) {
    const key = `${page.moduleKey}/${page.subId}`
    if (!pagesInSeed.has(key)) missing.push(`种子缺少页面：${key}`)
  }

  for (const variant of [
    'subject-types:1,2,3',
    'subject-types:1,2,3|subject-name:*',
    'subject-type:1|subject-name:*',
    'subject-type:2',
    'subject-type:3',
    'subject-types:1,2,3|keyword:*',
    'subject-id:1001'
  ]) {
    if (!seed.includes(`'${variant}'`)) missing.push(`绿色增粮缺少查询变体：${variant}`)
  }
  if (!/cultivatedLand[\s\S]*queryReportList[\s\S]*reportTitle[\s\S]*reportDate/iu.test(seed)) {
    missing.push('耕地报告缺少 reportTitle/reportDate 可消费字段')
  }
  if (!existsSync(guidePath)) missing.push('缺少模块页面接口物理表文档：server/docs/dashboard-data-contract.md')

  const plantingTaskMapServiceEmpty = !mapRows.some((row) =>
    row.moduleKey === 'security' && row.subId === 'plantingTask'
  )
  if (!plantingTaskMapServiceEmpty) missing.push('种植任务地图服务必须保持为空')

  return {
    routeCount: contract.endpoints.length,
    pageCount: contract.pages.length,
    payloadCombinationCount: payloadRows.length,
    requiredCombinationCount: required.size,
    plantingTaskMapServiceEmpty,
    missing
  }
}

if (require.main === module) {
  const result = verifyDashboardDataCoverage()
  if (result.missing.length) {
    process.stderr.write(`${result.missing.join('\n')}\n`)
    process.exitCode = 1
  } else {
    process.stdout.write(
      `DASHBOARD_DATA_COVERAGE=PASS pages=${result.pageCount} routes=${result.routeCount} ` +
      `payloadCombinations=${result.payloadCombinationCount} requiredCombinations=${result.requiredCombinationCount} ` +
      `plantingTaskMapServiceEmpty=1\n`
    )
  }
}

module.exports = { verifyDashboardDataCoverage }
