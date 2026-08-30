BEGIN;

-- 仅用于 main_grain_local 本地联调库。账号和数据均为虚构，不对应客户生产账号。
DELETE FROM auth_user WHERE lower(username) = 'local-acceptance';
INSERT INTO auth_user (username, password_hash, display_name, roles, status)
VALUES (
  'local-acceptance',
  'scrypt$main-grain-local-acceptance$4e2a147e25c311f0e38d787189241707e1425da1897e3e227d721baf73c0411cdefd5408c0a2e7a476dd731f2e4229c017dc45fce15935ce65960ffdc6e1278f',
  '本地联调账号',
  '["dashboard"]'::jsonb,
  1
);

DELETE FROM dashboard_payload
WHERE payload::text LIKE '%本地最小种子%'
   OR payload::text LIKE '%local-realistic-seed%'
   OR payload -> 'data' ->> 'seed' = 'true';

INSERT INTO dashboard_payload (
  module_key, sub_id, endpoint_key, year, half_year, crop, observation_date,
  district_code, request_context, payload
)
VALUES
  ('farmland', 'cultivatedLand', 'queryQingDaoTotalArea', 2025, 2, NULL, NULL, NULL, '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"areaTotal":646.74,"partition":20.07}}$json$),
  ('farmland', 'cultivatedLand', 'queryQingDaoGroupByArea', 2025, 2, NULL, NULL, NULL, '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"qingDaoGroupByAreaList":[{"landRegion":"平度市","totalArea":257.36},{"landRegion":"莱西市","totalArea":119.79},{"landRegion":"即墨区","totalArea":113.27},{"landRegion":"黄岛区","totalArea":79.13},{"landRegion":"胶州市","totalArea":71.17},{"landRegion":"城阳区","totalArea":4.93},{"landRegion":"崂山区","totalArea":1.03}]}}$json$),
  ('farmland', 'cultivatedLand', 'queryQingDaoGroupByYear', NULL, NULL, NULL, NULL, NULL, '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"qingDaoGroupByYearList":[{"timeYear":2023,"totalArea":632.18},{"timeYear":2024,"totalArea":639.42},{"timeYear":2025,"totalArea":646.74}]}}$json$),
  ('farmland', 'cultivatedLand', 'queryReportList', 2025, 2, NULL, NULL, NULL, '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","total":2,"rows":[{"reportTitle":"2025年青岛市耕地分布情况年度报告","reportDate":"2025-08-13","reportTime":"09:00"},{"reportTitle":"2025年青岛市耕地变化监测报告","reportDate":"2025-06-30","reportTime":"15:30"}]}$json$),

  ('farmland', 'highStandard', 'queryQingDaoTotalArea', 2025, 2, NULL, NULL, NULL, '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"areaTotal":428.56,"partition":13.31}}$json$),
  ('farmland', 'highStandard', 'queryQingDaoGroupByArea', 2025, 2, NULL, NULL, NULL, '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"qingDaoGroupByAreaList":[{"landRegion":"平度市","totalArea":136.4},{"landRegion":"莱西市","totalArea":88.7},{"landRegion":"即墨区","totalArea":74.5},{"landRegion":"胶州市","totalArea":56.3},{"landRegion":"黄岛区","totalArea":49.2},{"landRegion":"城阳区","totalArea":15.1},{"landRegion":"崂山区","totalArea":8.36}]}}$json$),

  ('farmland', 'basicProtection', 'queryProtectionMonitoringTotal', 2026, 2, NULL, NULL, NULL, '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"areaTotal":37011.17,"growthRate":53,"growthData":12847}}$json$),
  ('farmland', 'basicProtection', 'queryProtectionMonitoringByArea', 2026, 2, NULL, NULL, NULL, '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"dataGroupByAreaList":[{"landRegion":"平度市","totalArea":11518.44,"qingDaoGroupByRelatedList":[{"changeRelated":"林地","totalArea":3800,"totalCount":420},{"changeRelated":"建筑","totalArea":7000,"totalCount":680},{"changeRelated":"水体","totalArea":318.44,"totalCount":45},{"changeRelated":"道路","totalArea":400,"totalCount":72}]},{"landRegion":"黄岛区","totalArea":8024.31},{"landRegion":"即墨区","totalArea":6412.28},{"landRegion":"胶州市","totalArea":6035.17},{"landRegion":"莱西市","totalArea":5521.42},{"landRegion":"城阳区","totalArea":312.8},{"landRegion":"崂山区","totalArea":29.4}]}}$json$),

  ('farmland', 'greenGrain', 'queryGreenGrainIncreaseStatistics', NULL, NULL, NULL, NULL, NULL, '{"subjectTypeList":[1,2,3]}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":[{"subjectType":1,"subjectArea":14.26,"subjectCount":10},{"subjectType":2,"subjectArea":16.3,"subjectCount":141},{"subjectType":3,"subjectArea":23.74,"subjectCount":1007}]}$json$),
  ('farmland', 'greenGrain', 'queryGreenGrainIncreaseList', NULL, NULL, NULL, NULL, NULL, '{"subjectTypeList":[1,2,3]}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":[{"subjectName":"青岛华强农机专业合作社","subjectAreaW":2.0,"landRegion":"平度市"},{"subjectName":"中即瑞丰农业有限公司","subjectAreaW":1.8,"landRegion":"即墨区"},{"subjectName":"青岛丰诺农化有限公司","subjectAreaW":1.6,"landRegion":"莱西市"}]}$json$),
  ('farmland', 'greenGrain', 'queryGreenGrainIncreaseStatisticsByArea', NULL, NULL, NULL, NULL, NULL, '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":[{"landRegion":"平度市","subjectCount":42},{"landRegion":"莱西市","subjectCount":28},{"landRegion":"即墨区","subjectCount":31},{"landRegion":"胶州市","subjectCount":22},{"landRegion":"黄岛区","subjectCount":18}]}$json$),

  ('security', 'plantingTask', 'queryPlantingTaskStatistics', 2025, NULL, NULL, NULL, NULL, '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"finishRate":98,"plan":720.5,"realList":[{"cropType":"秋粮","landArea":363.33},{"cropType":"夏粮","landArea":343.42}]}}$json$),
  ('security', 'plantingTask', 'queryPlantingTaskByArea', 2025, NULL, NULL, NULL, NULL, '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":[{"landRegion":"平度市","planLandArea":303.1,"realLandArea":303.41,"areaRate":100},{"landRegion":"莱西市","planLandArea":131.7,"realLandArea":130.64,"areaRate":99},{"landRegion":"即墨区","planLandArea":117.7,"realLandArea":114.23,"areaRate":97},{"landRegion":"胶州市","planLandArea":94.0,"realLandArea":92.11,"areaRate":98},{"landRegion":"黄岛区","planLandArea":72.56,"realLandArea":65.15,"areaRate":90},{"landRegion":"城阳区","planLandArea":1.36,"realLandArea":1.21,"areaRate":89}]}$json$),
  ('security', 'plantingTask', 'statisticsPlantingTaskByArea', 2025, NULL, NULL, NULL, NULL, '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"excessCount":1,"averageRate":98,"maxRate":100,"finishRate":100}}$json$),

  ('security', 'cropDistribution', 'queryProtectionMonitoringTotal', 2026, 2, '小麦', NULL, NULL, '{"cropType":0,"unit":2}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"areaTotal":214.83}}$json$),
  ('security', 'cropDistribution', 'queryProtectionMonitoringByArea', 2026, NULL, '小麦', NULL, NULL, '{"cropType":0,"unit":2}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"dataGroupByAreaList":[{"landRegion":"平度市","totalArea":82.4},{"landRegion":"莱西市","totalArea":46.8},{"landRegion":"即墨区","totalArea":39.6},{"landRegion":"胶州市","totalArea":28.7},{"landRegion":"黄岛区","totalArea":17.33}]}}$json$),
  ('security', 'cropDistribution', 'queryProtectionMonitoringByYear', NULL, NULL, '小麦', NULL, NULL, '{"cropType":0,"unit":2}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"dataGroupByAreaList":[{"timeYear":2024,"totalArea":205.31},{"timeYear":2025,"totalArea":210.72},{"timeYear":2026,"totalArea":214.83}]}}$json$),

  ('security', 'yieldEstimate', 'statisticsYield', 2026, 2, '小麦', NULL, NULL, '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"maxYieldTotalArea":"平度市","maxYieldTotal":48.62,"maxYieldPerArea":"莱西市","maxYieldPer":512.4,"yieldTotal":118.36,"yieldPer":486.7}}$json$),
  ('security', 'yieldEstimate', 'queryYieldTotalByArea', 2026, NULL, '小麦', NULL, NULL, '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":[{"landRegion":"平度市","yieldTotal":48.62},{"landRegion":"莱西市","yieldTotal":25.14},{"landRegion":"即墨区","yieldTotal":19.83},{"landRegion":"胶州市","yieldTotal":15.27},{"landRegion":"黄岛区","yieldTotal":9.5}]}$json$),
  ('security', 'yieldEstimate', 'queryYieldTotalByYear', NULL, NULL, '小麦', NULL, NULL, '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":[{"timeYear":2024,"yieldTotal":110.21},{"timeYear":2025,"yieldTotal":114.78},{"timeYear":2026,"yieldTotal":118.36}]}$json$),

  ('warning', 'growthStage', 'queryCropType', NULL, NULL, NULL, NULL, NULL, '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":[{"cropType":"小麦","select":true},{"cropType":"玉米","select":false}]}$json$),
  ('warning', 'growthStage', 'queryReproductiveAnalysis', 2026, NULL, '小麦', DATE '2026-05-25', NULL, '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"periodType":"灌浆期","phaseOneName":"返青较早","phaseOneTime":"较早","phaseOneRate":18,"phaseTwoName":"返青集中期","phaseTwoTime":"集中","phaseTwoRate":67,"phaseThreeName":"返青较晚","phaseThreeTime":"较晚","phaseThreeRate":15,"measures":"加强后期水肥管理，重点关注倒伏、干热风及病虫害风险。"}}$json$),

  ('warning', 'seedling', 'queryCropType', NULL, NULL, NULL, NULL, NULL, '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":[{"cropType":"小麦","select":true},{"cropType":"玉米","select":false}]}$json$),
  ('warning', 'growthStage', 'queryReproductivePeriodByDate', 2026, NULL, '小麦', DATE '2026-05-15', NULL, '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"cropType":"小麦","periodType":"灌浆期","durationDays":24,"remainingDays":9}}$json$),
  ('warning', 'seedling', 'querySeedlingConditionAnalysis', 2026, NULL, '小麦', DATE '2026-05-15', NULL, '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":[{"typeName":"一类苗","typeRate":52},{"typeName":"二类苗","typeRate":34},{"typeName":"三类苗","typeRate":11},{"typeName":"弱苗","typeRate":3}]}$json$),

  ('warning', 'growth', 'queryCropType', NULL, NULL, NULL, NULL, NULL, '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":[{"cropType":"小麦","select":true},{"cropType":"玉米","select":false}]}$json$),
  ('warning', 'growth', 'queryGrowthBarChart', 2026, NULL, '小麦', DATE '2026-05-15', NULL, '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"veryGoodRate":8,"goodRate":22,"normalRate":55,"badRate":12,"veryDadRate":3}}$json$),
  ('warning', 'growth', 'queryGrowthAnalysisByYear', 2026, NULL, '小麦', NULL, NULL, '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"year":2026,"averagedList":[{"growthDate":"03-20","mean":0.42},{"growthDate":"04-10","mean":0.58},{"growthDate":"05-15","mean":0.73}],"yearData":[{"mean":0.46},{"mean":0.63},{"mean":0.78}]}}$json$),

  ('warning', 'maturity', 'queryCropType', NULL, NULL, NULL, NULL, NULL, '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":[{"cropType":"小麦","select":true},{"cropType":"玉米","select":false}]}$json$),
  ('warning', 'maturity', 'getMaturityStageByDate', 2026, NULL, '小麦', DATE '2026-06-05', NULL, '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"maturityRatio":88,"maturityRatioName":"接近成熟"}}$json$),
  ('warning', 'maturity', 'queryBestHarvestTime', 2026, NULL, '小麦', NULL, NULL, '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"startMonthDate":"06-12","endMonthDate":"06-18"}}$json$),
  ('warning', 'maturity', 'queryMaturityStageByYear', 2026, NULL, '小麦', NULL, NULL, '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":[{"maturityDate":"05-25","maturityRatio":55},{"maturityDate":"06-01","maturityRatio":72},{"maturityDate":"06-05","maturityRatio":88}]}$json$),

  ('warning', 'weatherDisaster', 'queryCropType', NULL, NULL, NULL, NULL, NULL, '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":[{"cropType":"高温","select":true},{"cropType":"低温","select":false},{"cropType":"干旱","select":false},{"cropType":"洪涝","select":false},{"cropType":"病虫害","select":false}]}$json$),
  ('warning', 'weatherDisaster', 'queryWeather', NULL, NULL, NULL, NULL, NULL, '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"condition":{"temp":27,"realFeel":29,"humidity":68,"windSpeed":3.2,"windDir":"东南风","windLevel":"2级","precipitation":0.8},"forecast":[{"predictDate":"08-27","tempDay":29,"tempNight":22},{"predictDate":"08-28","tempDay":30,"tempNight":23},{"predictDate":"08-29","tempDay":28,"tempNight":21}]}}$json$),
  ('warning', 'weatherDisaster', 'queryDisasterStatistics', 2026, NULL, '高温', DATE '2026-08-27', NULL, '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"totalValue":18,"disasterStatisticsList":[{"name":"高温","color":"#ff6b42","value":7},{"name":"干旱","color":"#f4ca4d","value":5},{"name":"大风","color":"#35d6ff","value":4},{"name":"暴雨","color":"#8d72f7","value":2}]}}$json$);

-- 将已有绿色增粮基线记录升级为规范化变体；同一路由不同参数从此可独立寻址。
UPDATE dashboard_payload
SET request_variant = CASE endpoint_key
  WHEN 'queryGreenGrainIncreaseStatistics' THEN 'subject-types:1,2,3'
  WHEN 'queryGreenGrainIncreaseList' THEN 'subject-types:1,2,3|subject-name:*'
  WHEN 'queryGreenGrainIncreaseStatisticsByArea' THEN 'subject-type:2'
  ELSE request_variant
END
WHERE module_key = 'farmland'
  AND sub_id = 'greenGrain'
  AND payload ->> 'source' = 'local-realistic-seed';

INSERT INTO dashboard_payload (
  module_key, sub_id, endpoint_key, year, half_year, crop, observation_date,
  district_code, request_variant, request_context, payload
)
VALUES
  ('farmland', 'cultivatedLand', 'queryQingDaoTotalArea', 2023, 2, NULL, NULL, NULL, 'default', '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"areaTotal":632.18,"partition":19.62}}$json$),
  ('farmland', 'cultivatedLand', 'queryQingDaoGroupByArea', 2023, 2, NULL, NULL, NULL, 'default', '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"qingDaoGroupByAreaList":[{"landRegion":"平度市","totalArea":251.2},{"landRegion":"莱西市","totalArea":116.4},{"landRegion":"即墨区","totalArea":109.8}]}}$json$),
  ('farmland', 'cultivatedLand', 'queryReportList', 2023, 2, NULL, NULL, NULL, 'default', '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","total":1,"rows":[{"reportTitle":"2023年青岛市耕地监测报告","reportDate":"2023-12-20","reportTime":"10:00"}]}$json$),
  ('farmland', 'basicProtection', 'queryProtectionMonitoringTotal', 2025, 2, NULL, NULL, NULL, 'default', '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"areaTotal":35420.8,"growthRate":49,"growthData":11620}}$json$),
  ('farmland', 'basicProtection', 'queryProtectionMonitoringByArea', 2025, 2, NULL, NULL, NULL, 'default', '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"dataGroupByAreaList":[{"landRegion":"平度市","totalArea":10840.2},{"landRegion":"莱西市","totalArea":5280.6},{"landRegion":"即墨区","totalArea":6120.4}]}}$json$),

  ('farmland', 'greenGrain', 'queryGreenGrainIncreaseList', NULL, NULL, NULL, NULL, NULL, 'subject-type:1|subject-name:*', '{"subjectType":1}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":[{"subjectId":1001,"subjectType":1,"subjectName":"青岛华强农机专业合作社","subjectAreaW":2.0,"landRegion":"平度市"}]}$json$),
  ('farmland', 'greenGrain', 'queryGreenGrainIncreaseStatisticsByArea', NULL, NULL, NULL, NULL, NULL, 'subject-type:3', '{"subjectType":3}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":[{"landRegion":"平度市","subjectCount":320},{"landRegion":"莱西市","subjectCount":211},{"landRegion":"即墨区","subjectCount":198}]}$json$),
  ('farmland', 'greenGrain', 'queryByKeyword', NULL, NULL, NULL, NULL, NULL, 'subject-types:1,2,3|keyword:*', '{"subjectTypeList":[1,2,3],"keyWord":""}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":[{"subjectId":1001,"subjectType":1,"subjectName":"青岛华强农机专业合作社","landRegion":"平度市"}]}$json$),
  ('farmland', 'greenGrain', 'queryDemonstrationSubjectDetail', NULL, NULL, NULL, NULL, NULL, 'subject-id:1001', '{"subjectId":1001}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"subjectId":1001,"subjectName":"青岛华强农机专业合作社","subjectType":1,"subjectAreaW":2.0,"landRegion":"平度市","imageList":[]}}$json$),

  ('security', 'cropDistribution', 'queryProtectionMonitoringTotal', 2023, 2, '玉米', NULL, NULL, 'default', '{"cropType":1,"unit":2}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"areaTotal":286.2}}$json$),
  ('security', 'cropDistribution', 'queryProtectionMonitoringByArea', 2023, NULL, '玉米', NULL, NULL, 'default', '{"cropType":1,"unit":2}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"dataGroupByAreaList":[{"landRegion":"平度市","totalArea":112.1},{"landRegion":"莱西市","totalArea":63.8},{"landRegion":"即墨区","totalArea":51.7}]}}$json$),
  ('security', 'cropDistribution', 'queryReportList', 2023, 2, '玉米', NULL, NULL, 'default', '{"reportType":3}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","total":1,"rows":[{"reportTitle":"2023年青岛市玉米分布报告","reportDate":"2023-10-20"}]}$json$),
  ('security', 'cropDistribution', 'queryProtectionMonitoringTotal', 2024, 2, '玉米', NULL, NULL, 'default', '{"cropType":1,"unit":2}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"areaTotal":291.6}}$json$),
  ('security', 'cropDistribution', 'queryProtectionMonitoringByArea', 2024, NULL, '玉米', NULL, NULL, 'default', '{"cropType":1,"unit":2}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"dataGroupByAreaList":[{"landRegion":"平度市","totalArea":115.3},{"landRegion":"莱西市","totalArea":65.2},{"landRegion":"即墨区","totalArea":52.4}]}}$json$),
  ('security', 'cropDistribution', 'queryReportList', 2024, 2, '玉米', NULL, NULL, 'default', '{"reportType":3}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","total":1,"rows":[{"reportTitle":"2024年青岛市玉米分布报告","reportDate":"2024-10-18"}]}$json$),
  ('security', 'cropDistribution', 'queryProtectionMonitoringTotal', 2025, 2, '玉米', NULL, NULL, 'default', '{"cropType":1,"unit":2}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"areaTotal":297.4}}$json$),
  ('security', 'cropDistribution', 'queryProtectionMonitoringByArea', 2025, NULL, '玉米', NULL, NULL, 'default', '{"cropType":1,"unit":2}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"dataGroupByAreaList":[{"landRegion":"平度市","totalArea":118.6},{"landRegion":"莱西市","totalArea":66.7},{"landRegion":"即墨区","totalArea":53.8}]}}$json$),
  ('security', 'cropDistribution', 'queryReportList', 2025, 2, '玉米', NULL, NULL, 'default', '{"reportType":3}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","total":1,"rows":[{"reportTitle":"2025年青岛市玉米分布报告","reportDate":"2025-10-16"}]}$json$),
  ('security', 'cropDistribution', 'queryProtectionMonitoringByYear', NULL, NULL, '玉米', NULL, NULL, 'default', '{"cropType":1,"unit":2}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"dataGroupByAreaList":[{"timeYear":2023,"totalArea":286.2},{"timeYear":2024,"totalArea":291.6},{"timeYear":2025,"totalArea":297.4}]}}$json$),
  ('security', 'cropDistribution', 'queryReportList', 2026, 2, '小麦', NULL, NULL, 'default', '{"reportType":3}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","total":1,"rows":[{"reportTitle":"2026年青岛市小麦分布报告","reportDate":"2026-06-20"}]}$json$),

  ('security', 'yieldEstimate', 'statisticsYield', 2025, 2, '小麦', NULL, NULL, 'default', '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"maxYieldTotalArea":"平度市","maxYieldTotal":46.2,"maxYieldPerArea":"莱西市","maxYieldPer":506.2,"yieldTotal":114.78,"yieldPer":479.5}}$json$),
  ('security', 'yieldEstimate', 'queryYieldTotalByArea', 2025, NULL, '小麦', NULL, NULL, 'default', '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":[{"landRegion":"平度市","yieldTotal":46.2},{"landRegion":"莱西市","yieldTotal":24.3},{"landRegion":"即墨区","yieldTotal":19.1}]}$json$),
  ('security', 'yieldEstimate', 'queryReportList', 2025, 2, '小麦', NULL, NULL, 'default', '{"reportType":2}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","total":1,"rows":[{"reportTitle":"2025年青岛市小麦产量预估报告","reportDate":"2025-06-22"}]}$json$),
  ('security', 'yieldEstimate', 'statisticsYield', 2025, 2, '玉米', NULL, NULL, 'default', '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"maxYieldTotalArea":"平度市","maxYieldTotal":62.8,"maxYieldPerArea":"莱西市","maxYieldPer":625.4,"yieldTotal":156.3,"yieldPer":602.1}}$json$),
  ('security', 'yieldEstimate', 'queryYieldTotalByArea', 2025, NULL, '玉米', NULL, NULL, 'default', '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":[{"landRegion":"平度市","yieldTotal":62.8},{"landRegion":"莱西市","yieldTotal":34.6},{"landRegion":"即墨区","yieldTotal":27.4}]}$json$),
  ('security', 'yieldEstimate', 'queryYieldTotalByYear', NULL, NULL, '玉米', NULL, NULL, 'default', '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":[{"timeYear":2023,"yieldTotal":147.1},{"timeYear":2024,"yieldTotal":151.8},{"timeYear":2025,"yieldTotal":156.3}]}$json$),
  ('security', 'yieldEstimate', 'queryReportList', 2025, 2, '玉米', NULL, NULL, 'default', '{"reportType":2}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","total":1,"rows":[{"reportTitle":"2025年青岛市玉米产量预估报告","reportDate":"2025-10-22"}]}$json$),
  ('security', 'yieldEstimate', 'queryReportList', 2026, 2, '小麦', NULL, NULL, 'default', '{"reportType":2}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","total":1,"rows":[{"reportTitle":"2026年青岛市小麦产量预估报告","reportDate":"2026-06-21"}]}$json$),

  ('warning', 'growthStage', 'queryReproductiveAnalysis', 2026, NULL, '小麦', DATE '2025-11-20', NULL, 'default', '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"periodType":"越冬期","phaseOneName":"苗情较好","phaseOneTime":"适期","phaseOneRate":62,"phaseTwoName":"苗情一般","phaseTwoTime":"偏晚","phaseTwoRate":30,"phaseThreeName":"弱苗","phaseThreeTime":"晚播","phaseThreeRate":8,"measures":"做好冬前镇压与保墒。"}}$json$),
  ('warning', 'growthStage', 'queryReproductiveAnalysis', 2026, NULL, '小麦', DATE '2026-03-10', NULL, 'default', '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"periodType":"返青-起身期","phaseOneName":"返青较早","phaseOneTime":"较早","phaseOneRate":20,"phaseTwoName":"返青集中","phaseTwoTime":"适期","phaseTwoRate":68,"phaseThreeName":"返青较晚","phaseThreeTime":"较晚","phaseThreeRate":12,"measures":"分类开展返青肥水管理。"}}$json$),
  ('warning', 'growthStage', 'queryReproductiveAnalysis', 2026, NULL, '小麦', DATE '2026-05-02', NULL, 'default', '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"periodType":"抽穗-开花期","phaseOneName":"抽穗较早","phaseOneTime":"较早","phaseOneRate":16,"phaseTwoName":"抽穗集中","phaseTwoTime":"适期","phaseTwoRate":72,"phaseThreeName":"抽穗较晚","phaseThreeTime":"较晚","phaseThreeRate":12,"measures":"关注赤霉病与干热风风险。"}}$json$),
  ('warning', 'growthStage', 'queryReproductiveAnalysis', 2025, NULL, '玉米', DATE '2025-08-20', NULL, 'default', '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"periodType":"乳熟期","phaseOneName":"发育较早","phaseOneTime":"较早","phaseOneRate":18,"phaseTwoName":"发育集中","phaseTwoTime":"适期","phaseTwoRate":70,"phaseThreeName":"发育较晚","phaseThreeTime":"较晚","phaseThreeRate":12,"measures":"关注高温与倒伏风险。"}}$json$),
  ('warning', 'growthStage', 'queryReproductivePeriodByDate', 2025, NULL, '玉米', DATE '2025-08-15', NULL, 'default', '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"cropType":"玉米","periodType":"乳熟期","durationDays":20,"remainingDays":7}}$json$),
  ('warning', 'growthStage', 'queryReproductivePeriodByDate', 2025, NULL, '玉米', DATE '2025-08-20', NULL, 'default', '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"cropType":"玉米","periodType":"乳熟期","durationDays":20,"remainingDays":2}}$json$),
  ('warning', 'seedling', 'querySeedlingConditionAnalysis', 2025, NULL, '玉米', DATE '2025-08-15', NULL, 'default', '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":[{"typeName":"一类苗","typeRate":48},{"typeName":"二类苗","typeRate":37},{"typeName":"三类苗","typeRate":12},{"typeName":"弱苗","typeRate":3}]}$json$),
  ('warning', 'seedling', 'queryReportList', 2026, 2, '小麦', NULL, NULL, 'default', '{"reportType":4}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","total":1,"rows":[{"reportTitle":"2026年小麦苗情监测报告","reportDate":"2026-05-18"}]}$json$),
  ('warning', 'seedling', 'queryReportList', 2025, 2, '玉米', NULL, NULL, 'default', '{"reportType":4}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","total":1,"rows":[{"reportTitle":"2025年玉米苗情监测报告","reportDate":"2025-08-18"}]}$json$),
  ('warning', 'growth', 'queryGrowthBarChart', 2025, NULL, '玉米', DATE '2025-08-20', NULL, 'default', '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"veryGoodRate":11,"goodRate":28,"normalRate":49,"badRate":10,"veryDadRate":2}}$json$),
  ('warning', 'growth', 'queryGrowthAnalysisByYear', 2025, NULL, '玉米', NULL, NULL, 'default', '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"year":2025,"averagedList":[{"growthDate":"06-20","mean":0.38},{"growthDate":"07-15","mean":0.61},{"growthDate":"08-20","mean":0.76}],"yearData":[{"mean":0.42},{"mean":0.65},{"mean":0.79}]}}$json$),
  ('warning', 'maturity', 'getMaturityStageByDate', 2025, NULL, '玉米', DATE '2025-09-15', NULL, 'default', '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"maturityRatio":82,"maturityRatioName":"进入成熟"}}$json$),
  ('warning', 'maturity', 'queryBestHarvestTime', 2025, NULL, '玉米', NULL, NULL, 'default', '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"startMonthDate":"09-25","endMonthDate":"10-05"}}$json$),
  ('warning', 'maturity', 'queryMaturityStageByYear', 2025, NULL, '玉米', NULL, NULL, 'default', '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":[{"maturityDate":"09-01","maturityRatio":46},{"maturityDate":"09-10","maturityRatio":68},{"maturityDate":"09-15","maturityRatio":82}]}$json$),
  ('warning', 'weatherDisaster', 'queryDisasterStatistics', 2026, NULL, '低温', DATE '2026-01-15', NULL, 'default', '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"totalValue":9,"disasterStatisticsList":[{"name":"低温","color":"#30c1ff","value":9}]}}$json$),
  ('warning', 'weatherDisaster', 'queryDisasterStatistics', 2026, NULL, '干旱', DATE '2026-06-20', NULL, 'default', '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"totalValue":12,"disasterStatisticsList":[{"name":"干旱","color":"#f4ca4d","value":12}]}}$json$),
  ('warning', 'weatherDisaster', 'queryDisasterStatistics', 2026, NULL, '洪涝', DATE '2026-07-18', NULL, 'default', '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"totalValue":6,"disasterStatisticsList":[{"name":"洪涝","color":"#8d72f7","value":6}]}}$json$),
  ('warning', 'weatherDisaster', 'queryPestWarningByDate', 2026, NULL, '病虫害', DATE '2026-04-20', NULL, 'default', '{}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","data":{"warningCount":3,"warningArea":12.6,"warningLevel":"中风险"}}$json$),
  ('warning', 'weatherDisaster', 'queryReportList', 2026, 2, '病虫害', NULL, NULL, 'default', '{"reportType":5}',
    $json${"code":200,"msg":"本地真实联调数据","source":"local-realistic-seed","total":1,"rows":[{"reportTitle":"2026年小麦病虫害预警报告","reportDate":"2026-04-21"}]}$json$)
ON CONFLICT DO NOTHING;

DELETE FROM screen_timeline
WHERE year BETWEEN 2023 AND 2026
  AND (module_key, sub_id) IN (
    ('farmland', 'cultivatedLand'), ('farmland', 'highStandard'),
    ('farmland', 'basicProtection'), ('farmland', 'greenGrain'),
    ('security', 'plantingTask'), ('security', 'cropDistribution'),
    ('security', 'yieldEstimate'), ('warning', 'growthStage'),
    ('warning', 'seedling'), ('warning', 'growth'),
    ('warning', 'maturity'), ('warning', 'weatherDisaster')
  );

INSERT INTO screen_timeline (
  module_key, sub_id, timeline_type, year, half_year, crop, observation_date,
  stage, label, sort_order, active
)
VALUES
  ('farmland', 'cultivatedLand', 'business', 2023, 2, NULL, NULL, NULL, '2023', 10, FALSE),
  ('farmland', 'cultivatedLand', 'business', 2025, 2, NULL, NULL, NULL, '2025', 20, TRUE),
  ('farmland', 'highStandard', 'business', 2025, 2, NULL, NULL, NULL, '2025', 10, TRUE),
  ('farmland', 'basicProtection', 'business', 2025, 2, NULL, NULL, NULL, '2025 下半年', 10, FALSE),
  ('farmland', 'basicProtection', 'business', 2026, 2, NULL, NULL, NULL, '2026 下半年', 20, TRUE),
  ('farmland', 'greenGrain', 'business', 2026, 2, NULL, NULL, NULL, '2026', 10, TRUE),
  ('security', 'plantingTask', 'business', 2025, 2, NULL, NULL, NULL, '2025', 10, TRUE),
  ('security', 'cropDistribution', 'business', 2023, 2, '玉米', NULL, NULL, '2023 玉米', 10, FALSE),
  ('security', 'cropDistribution', 'business', 2024, 2, '玉米', NULL, NULL, '2024 玉米', 20, FALSE),
  ('security', 'cropDistribution', 'business', 2025, 2, '玉米', NULL, NULL, '2025 玉米', 30, TRUE),
  ('security', 'cropDistribution', 'business', 2026, 2, '小麦', NULL, NULL, '2026 小麦', 40, TRUE),
  ('security', 'yieldEstimate', 'business', 2025, 2, '小麦', NULL, NULL, '2025 小麦', 10, FALSE),
  ('security', 'yieldEstimate', 'business', 2026, 2, '小麦', NULL, NULL, '2026 小麦', 20, TRUE),
  ('security', 'yieldEstimate', 'business', 2025, 2, '玉米', NULL, NULL, '2025 玉米', 30, TRUE),
  -- year 表示收获生产季；冬小麦观测日期可落在上一自然年。
  ('warning', 'growthStage', 'reproductive', 2026, NULL, '小麦', DATE '2025-11-20', '越冬期', '越冬期', 5, FALSE),
  ('warning', 'growthStage', 'reproductive', 2026, NULL, '小麦', DATE '2026-03-10', '返青-起身期', '返青-起身期', 10, FALSE),
  ('warning', 'growthStage', 'reproductive', 2026, NULL, '小麦', DATE '2026-05-02', '抽穗-开花期', '抽穗-开花期', 20, FALSE),
  ('warning', 'growthStage', 'reproductive', 2026, NULL, '小麦', DATE '2026-05-25', '灌浆期', '灌浆期', 30, TRUE),
  ('warning', 'growthStage', 'reproductive', 2025, NULL, '玉米', DATE '2025-08-20', '乳熟期', '乳熟期', 10, TRUE),
  ('warning', 'seedling', 'reproductive', 2026, NULL, '小麦', DATE '2026-05-15', '灌浆期', '灌浆期', 10, TRUE),
  ('warning', 'seedling', 'reproductive', 2025, NULL, '玉米', DATE '2025-08-15', '乳熟期', '乳熟期', 10, TRUE),
  ('warning', 'growth', 'reproductive', 2026, NULL, '小麦', DATE '2026-05-15', '灌浆期', '灌浆期', 10, TRUE),
  ('warning', 'growth', 'reproductive', 2025, NULL, '玉米', DATE '2025-08-20', '乳熟期', '乳熟期', 10, TRUE),
  ('warning', 'maturity', 'reproductive', 2026, NULL, '小麦', DATE '2026-06-05', '成熟期', '成熟期', 10, TRUE),
  ('warning', 'maturity', 'reproductive', 2025, NULL, '玉米', DATE '2025-09-15', '成熟期', '成熟期', 10, TRUE),
  ('warning', 'weatherDisaster', 'reproductive', 2026, NULL, '低温', DATE '2026-01-15', '低温预警', '低温预警', 10, TRUE),
  ('warning', 'weatherDisaster', 'reproductive', 2026, NULL, '干旱', DATE '2026-06-20', '干旱预警', '干旱预警', 10, TRUE),
  ('warning', 'weatherDisaster', 'reproductive', 2026, NULL, '洪涝', DATE '2026-07-18', '洪涝预警', '洪涝预警', 10, TRUE),
  ('warning', 'weatherDisaster', 'reproductive', 2026, NULL, '高温', DATE '2026-08-27', '实时气象', '实时气象', 10, TRUE),
  ('warning', 'weatherDisaster', 'reproductive', 2026, NULL, '病虫害', DATE '2026-04-20', '病虫害预警', '病虫害预警', 20, TRUE);

DELETE FROM map_service
WHERE metadata @> '{"seed":true}'::jsonb
   OR metadata ->> 'source' = 'local-realistic-seed';

INSERT INTO map_service (
  module_key, sub_id, category, year, half_year, crop, stage, observation_date,
  server, service_type, service_url, layer_name, fallback_srs, metadata
)
VALUES
  ('farmland', 'cultivatedLand', 'farmland_monitoring', 2023, 2, NULL, NULL, NULL, 'historical', 'wms', 'http://27.223.102.27:8081/geoserver/qingdao-agro/wms', 'qingdao-agro:farmland_monitoring_2023_956417', 'EPSG:4326', '{"source":"local-realistic-seed"}'),
  ('farmland', 'cultivatedLand', 'farmland_monitoring', 2025, 2, NULL, NULL, NULL, 'historical', 'wms', 'http://27.223.102.27:8081/geoserver/qingdao-agro/wms', 'qingdao-agro:farmland_monitoring_2025_209664', 'EPSG:4326', '{"source":"local-realistic-seed"}'),
  ('farmland', 'highStandard', 'high_standard_farmland', 2025, 2, NULL, NULL, NULL, 'historical', 'wms', 'http://27.223.102.27:8081/geoserver/qingdao-agro/wms', 'qingdao-agro:high_standard_farmland_2025_311269', 'EPSG:4326', '{"source":"local-realistic-seed"}'),
  ('farmland', 'basicProtection', 'protection_monitoring', 2025, 2, NULL, NULL, NULL, 'historical', 'wms', 'http://27.223.102.27:8081/geoserver/qingdao-agro/wms', 'qingdao-agro:protection_monitoring_2025_r_902236', 'EPSG:4326', '{"source":"local-realistic-seed"}'),
  ('farmland', 'basicProtection', 'protection_monitoring', 2026, 2, NULL, NULL, NULL, 'new', 'wms', 'http://home.aceimage.cn:8081/geoserver/qingdao-agro/wms', 'qingdao-agro:protection_monitoring_2026_l_188863', 'EPSG:4326', '{"source":"local-realistic-seed"}'),
  ('security', 'cropDistribution', 'crop_distribution', 2023, 2, '玉米', NULL, NULL, 'historical', 'wms', 'http://27.223.102.27:8081/geoserver/qingdao-agro/wms', 'qingdao-agro:crop_distribution_2023_ym_419434', 'EPSG:4326', '{"source":"local-realistic-seed"}'),
  ('security', 'cropDistribution', 'crop_distribution', 2024, 2, '玉米', NULL, NULL, 'historical', 'wms', 'http://27.223.102.27:8081/geoserver/qingdao-agro/wms', 'qingdao-agro:crop_distribution_2024_ym_765456', 'EPSG:4326', '{"source":"local-realistic-seed"}'),
  ('security', 'cropDistribution', 'crop_distribution', 2025, 2, '玉米', NULL, NULL, 'historical', 'wms', 'http://27.223.102.27:8081/geoserver/qingdao-agro/wms', 'qingdao-agro:crop_distribution_2025_268271', 'EPSG:4326', '{"source":"local-realistic-seed"}'),
  ('security', 'cropDistribution', 'crop_distribution', 2026, 2, '小麦', NULL, NULL, 'new', 'wms', 'http://home.aceimage.cn:8081/geoserver/qingdao-agro/wms', 'qingdao-agro:crop_distribution_2026_xm_954713', 'EPSG:4326', '{"source":"local-realistic-seed"}'),
  ('security', 'yieldEstimate', 'crop_yield', 2025, 2, '玉米', NULL, NULL, 'historical', 'wms', 'http://27.223.102.27:8081/geoserver/qingdao-agro/wms', 'qingdao-agro:crop_yield_2025_318587', 'EPSG:4326', '{"source":"local-realistic-seed"}'),
  ('security', 'yieldEstimate', 'crop_yield', 2025, 2, '小麦', NULL, NULL, 'historical', 'wms', 'http://27.223.102.27:8081/geoserver/qingdao-agro/wms', 'qingdao-agro:crop_yield_2025_xm_945836', 'EPSG:4326', '{"source":"local-realistic-seed"}'),
  ('security', 'yieldEstimate', 'crop_yield', 2026, 2, '小麦', NULL, NULL, 'new', 'wms', 'http://home.aceimage.cn:8081/geoserver/qingdao-agro/wms', 'qingdao-agro:crop_yield_2026_xm_348459', 'EPSG:4326', '{"source":"local-realistic-seed"}'),
  ('warning', 'growthStage', 'reproductive_period', 2026, NULL, '小麦', '返青-起身期', DATE '2026-03-10', 'new', 'wms', 'http://home.aceimage.cn:8081/geoserver/qingdao-agro/wms', 'qingdao-agro:reproductive_period_20260310_xm_999535', 'EPSG:4326', '{"source":"local-realistic-seed"}'),
  ('warning', 'growthStage', 'reproductive_period', 2026, NULL, '小麦', '抽穗-开花期', DATE '2026-05-02', 'new', 'wms', 'http://home.aceimage.cn:8081/geoserver/qingdao-agro/wms', 'qingdao-agro:reproductive_period_20260502_xm_366576', 'EPSG:4326', '{"source":"local-realistic-seed"}'),
  ('warning', 'growthStage', 'reproductive_period', 2026, NULL, '小麦', '灌浆期', DATE '2026-05-25', 'new', 'wms', 'http://home.aceimage.cn:8081/geoserver/qingdao-agro/wms', 'qingdao-agro:reproductive_period_20260525_xm_608968', 'EPSG:4326', '{"source":"local-realistic-seed"}'),
  ('warning', 'seedling', 'seedling_condition', 2026, NULL, '小麦', '灌浆期', DATE '2026-05-15', 'new', 'wms', 'http://home.aceimage.cn:8081/geoserver/qingdao-agro/wms', 'qingdao-agro:seedling_condition_20260515_xm_244391', 'EPSG:4326', '{"source":"local-realistic-seed"}')
ON CONFLICT DO NOTHING;

COMMIT;
