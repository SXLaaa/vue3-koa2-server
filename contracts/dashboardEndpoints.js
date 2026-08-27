const endpointDefinitions = [
  ['queryQingDaoTotalArea', 'POST', '/screen/queryQingDaoTotalArea', 'object'],
  ['queryQingDaoGroupByYear', 'POST', '/screen/queryQingDaoGroupByYear', 'object'],
  ['queryDemonstrationSubjectDetail', 'GET', '/demonstrationSubject/queryDemonstrationSubjectDetail', 'detail'],
  ['queryQingDaoGroupByArea', 'POST', '/screen/queryQingDaoGroupByArea', 'object'],
  ['queryProtectionMonitoringTotal', 'POST', '/screen/queryProtectionMonitoringTotal', 'object'],
  ['queryProtectionMonitoringByArea', 'POST', '/screen/queryProtectionMonitoringByArea', 'object'],
  ['getVectorTableWms', 'POST', '/screen/getVectorTableWms', 'map'],
  ['getTimeLine', 'POST', '/screen/getTimeLine', 'timeline'],
  ['queryGreenGrainIncreaseStatistics', 'POST', '/screen/queryGreenGrainIncreaseStatistics', 'array'],
  ['queryGreenGrainIncreaseList', 'POST', '/screen/queryGreenGrainIncreaseList', 'array'],
  ['queryGreenGrainIncreaseStatisticsByArea', 'POST', '/screen/queryGreenGrainIncreaseStatisticsByArea', 'array'],
  ['queryReportList', 'POST', '/screen/queryReportList', 'report'],
  ['queryPlantingTaskStatistics', 'POST', '/screen/queryPlantingTaskStatistics', 'object'],
  ['queryPlantingTaskByArea', 'POST', '/screen/queryPlantingTaskByArea', 'array'],
  ['statisticsPlantingTaskByArea', 'POST', '/screen/statisticsPlantingTaskByArea', 'object'],
  ['queryProtectionMonitoringByYear', 'POST', '/screen/queryProtectionMonitoringByYear', 'object'],
  ['statisticsYield', 'POST', '/screen/statisticsYield', 'object'],
  ['queryYieldTotalByYear', 'POST', '/screen/queryYieldTotalByYear', 'array'],
  ['queryYieldTotalByArea', 'POST', '/screen/queryYieldTotalByArea', 'array'],
  ['getReproductiveTimeLine', 'POST', '/screen/getReproductiveTimeLine', 'reproductiveTimeline'],
  ['queryReproductiveAnalysis', 'POST', '/screen/queryReproductiveAnalysis', 'object'],
  ['queryGrowthBarChart', 'POST', '/screen/queryGrowthBarChart', 'object'],
  ['queryGrowthAnalysisByYear', 'POST', '/screen/queryGrowthAnalysisByYear', 'object'],
  ['getMaturityStageByDate', 'POST', '/screen/getMaturityStageByDate', 'object'],
  ['queryMaturityStageByYear', 'POST', '/screen/queryMaturityStageByYear', 'array'],
  ['queryReproductivePeriodByDate', 'POST', '/screen/queryReproductivePeriodByDate', 'object'],
  ['queryBestHarvestTime', 'POST', '/screen/queryBestHarvestTime', 'object'],
  ['queryDisasterStatistics', 'POST', '/screen/queryDisasterStatistics', 'object'],
  ['queryCropType', 'POST', '/screen/queryCropType', 'array'],
  ['queryWeather', 'POST', '/screen/queryWeather', 'object'],
  ['querySeedlingConditionAnalysis', 'POST', '/screen/querySeedlingConditionAnalysis', 'array'],
  ['queryByKeyword', 'POST', '/screen/queryByKeyword', 'array'],
  ['queryPestWarningByDate', 'POST', '/screen/queryPestWarningByDate', 'object']
]

const DASHBOARD_ENDPOINTS = Object.freeze(endpointDefinitions.map(([key, method, path, emptyKind]) =>
  Object.freeze({ key, method, path, emptyKind })
))

const DASHBOARD_ENDPOINT_BY_KEY = new Map(DASHBOARD_ENDPOINTS.map((endpoint) => [endpoint.key, endpoint]))

module.exports = { DASHBOARD_ENDPOINTS, DASHBOARD_ENDPOINT_BY_KEY }
