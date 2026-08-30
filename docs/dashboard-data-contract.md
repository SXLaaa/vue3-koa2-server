# 大屏模块—页面—接口—物理表说明

## 使用边界

本说明描述本地 Koa 大屏的确定性查询合同。它不证明客户数据库、线上 API、GeoServer 或地图服务当前可用。新建本地联调库时，数据库应用顺序为 `001_postgis_dashboard.up.sql`、`002_dashboard_contract_views.up.sql`、`002_local_dashboard.sql`；已有 001 结构的联调库只需继续执行 002 迁移和 002 种子。

`year` 在 `screen_timeline` 和生产预警载荷中表示作物生产季（收获年度），`observation_date` 表示自然日。冬小麦可以使用 `year=2026`、`observation_date=2025-11-20`，前端切换日期时仍应保持生产季 2026。

## 物理表和查询键

| 物理表 | 作用 | 运行时查询键 |
|---|---|---|
| `dashboard_payload` | 30 个普通数据端点 | `module_key + sub_id + endpoint_key + request_variant`，以及可选的 `year + half_year + crop + observation_date + district_code` |
| `screen_timeline` | `getTimeLine`、`getReproductiveTimeLine` | `module_key + sub_id + crop`；生育期时间轴额外按生产季 `year` 精确过滤 |
| `map_service` | `getVectorTableWms` | `module_key + sub_id + category + year + half_year + crop + stage + observation_date + server` |
| `auth_user` | 本地登录用户 | `username` |
| `administrative_region` | 行政区边界 | `region_code`，几何为 `MultiPolygon/EPSG:4326` |
| `agricultural_feature` | 农业专题几何 | `module_key + sub_id + category + year + half_year + crop + stage + observation_date + district_code` |

002 迁移提供两个只读视图：

- `dashboard_module_endpoint_v`：逐行列出模块、页面、接口、物理表和完整查询键。
- `dashboard_module_read_v`：按模块/页面聚合 `endpoint_bindings`，用于只读巡检和验收。

## 模块—页面—接口映射

下表中的 `P/T/M` 分别表示 `dashboard_payload`、`screen_timeline`、`map_service`。

| 模块 | 页面 | 接口 → 物理表 | 页面关键查询维度 |
|---|---|---|---|
| 农田监测 | 耕地监测 `cultivatedLand` | T `getTimeLine`；P `queryQingDaoTotalArea`、`queryQingDaoGroupByArea`、`queryQingDaoGroupByYear`、`queryReportList`；M `getVectorTableWms` | 年、半年；报告返回 `reportTitle/reportDate/reportTime` |
| 农田监测 | 高标准农田 `highStandard` | T `getTimeLine`；P `queryQingDaoTotalArea`、`queryQingDaoGroupByArea`；M `getVectorTableWms` | 年、半年 |
| 农田监测 | 基本农田保护 `basicProtection` | T `getTimeLine`；P `queryProtectionMonitoringTotal`、`queryProtectionMonitoringByArea`；M `getVectorTableWms` | 年、半年 |
| 农田监测 | 绿色增粮 `greenGrain` | P `queryGreenGrainIncreaseStatistics`、`queryGreenGrainIncreaseList`、`queryGreenGrainIncreaseStatisticsByArea`、`queryByKeyword`、`queryDemonstrationSubjectDetail` | `request_variant`，见下节 |
| 粮食安全 | 种植任务 `plantingTask` | T `getTimeLine`；P `queryPlantingTaskStatistics`、`queryPlantingTaskByArea`、`statisticsPlantingTaskByArea`；M `getVectorTableWms` 预期为空 | 年；地图由前端区县统计着色，禁止补占位服务 |
| 粮食安全 | 作物分布 `cropDistribution` | T `getTimeLine`；P `queryProtectionMonitoringTotal`、`queryProtectionMonitoringByArea`、`queryProtectionMonitoringByYear`、`queryReportList`；M `getVectorTableWms` | 年、半年、作物；报告必须带 `typeName` |
| 粮食安全 | 产量预估 `yieldEstimate` | T `getTimeLine`；P `statisticsYield`、`queryYieldTotalByArea`、`queryYieldTotalByYear`、`queryReportList`；M `getVectorTableWms` | 年、半年、作物；报告必须带 `typeName` |
| 生产预警 | 生育期 `growthStage` | P `queryCropType`、`queryReproductiveAnalysis`；T `getReproductiveTimeLine`；M `getVectorTableWms` | 生产季、作物、观测日 |
| 生产预警 | 苗情 `seedling` | P `queryCropType`、`queryReproductivePeriodByDate`、`querySeedlingConditionAnalysis`、`queryReportList`；T `getReproductiveTimeLine`；M `getVectorTableWms` | 生产季、作物、观测日；报告必须带 `typeName` |
| 生产预警 | 长势 `growth` | P `queryCropType`、`queryReproductivePeriodByDate`、`queryGrowthBarChart`、`queryGrowthAnalysisByYear`；T `getReproductiveTimeLine`；M `getVectorTableWms` | 生产季、作物、观测日；年度趋势必须带 `year` |
| 生产预警 | 成熟期 `maturity` | P `queryCropType`、`getMaturityStageByDate`、`queryBestHarvestTime`、`queryMaturityStageByYear`；T `getReproductiveTimeLine`；M `getVectorTableWms` | 生产季、作物、观测日 |
| 生产预警 | 气象灾害 `weatherDisaster` | P `queryWeather`、`queryCropType`、`queryDisasterStatistics`；病虫害增加 `queryPestWarningByDate`、`queryReportList`；T `getReproductiveTimeLine`；M `getVectorTableWms` | 灾害类型共用前端 `crop` 状态，查询按生产季、类型、观测日隔离 |

## 绿色增粮规范化变体

| 请求语义 | `request_variant` 示例 |
|---|---|
| 全部主体统计 | `subject-types:1,2,3` |
| 全类型主体名单 | `subject-types:1,2,3\|subject-name:*` |
| 千亩示范方名单 | `subject-type:1\|subject-name:*` |
| 百亩/十亩区市统计 | `subject-type:2`、`subject-type:3` |
| 关键字检索 | `subject-types:1,2,3\|keyword:*`；实际关键词会先去除首尾和重复空白 |
| 主体详情 | `subject-id:1001` |

数组型主体类别先转数字、去重、升序，只接受 1/2/3；检索文本去除首尾空白并折叠连续空白。仓储用 `request_variant` 精确过滤，避免同一路由不同参数返回同一载荷。

## 离线覆盖检查

在 `server` 目录执行：

```powershell
node scripts/verify-dashboard-data-coverage.js
```

检查按页面、端点、年份、半年、作物、观测日和绿色增粮变体逐项核对本地种子，并确认种植任务地图仍为空。`routes=33` 只是附带计数；验收结果必须同时满足 `requiredCombinations` 无缺口。
