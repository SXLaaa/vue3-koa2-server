# 主粮作物 PostgreSQL/PostGIS 数据库产物

## 产物

- `migrations/001_postgis_dashboard.up.sql`：启用 PostGIS，创建 6 张冻结表、唯一/查询/GiST 索引及空间归一化与计算函数。
- `migrations/001_postgis_dashboard.down.sql`：按依赖逆序回滚本迁移对象；不删除可能被其他业务共享的 PostGIS 扩展。
- `seeds/001_minimal_dashboard.sql`：覆盖 12 页面、33 接口、12 条时间轴、10 个地图服务查找及青岛代表性面数据；`security/plantingTask` 不创建假图层。
- `verification/spatial-fixture.sql`：验证 `ST_Intersects`、`ST_Within`、`ST_Intersection` 与 `ST_Area(geom::geography)`。
- `verification/live-verify.sql`：在迁移和种子已应用的本地库中核对表、几何列、索引和覆盖数量。
- `verify.mjs`：无数据库时执行确定性验证；仅在显式 `--live` 且 URL 指向本机时调用 `psql`。

`psql` 按以下顺序解析：显式环境变量 `MAIN_GRAIN_PSQL`、当前 `PATH`、Windows 标准安装目录 `C:\Program Files\PostgreSQL\<版本>\bin\psql.exe`（选择最高版本）。该变量只保存可执行文件路径，不得写入数据库密码或连接串。

## 无数据库验证

```powershell
node database/verify.mjs
node --test database/tests/fork03-artifacts.test.mjs
```

预期结果为结构/种子/dry-run 检查通过，并明确显示 `MANUAL_REQUIRED`。这不等同于迁移已经在 PostgreSQL 中执行。

## 本地 PostGIS 人工验证

1. 新建专用的空白本地数据库并安装可用的 PostGIS 扩展包。
2. 只在当前终端会话或组织的密钥管理工具中设置 `DATABASE_URL`，不要把密码写进命令脚本、配置、日志或 Git。
3. 确认主机名是 `localhost`、`127.0.0.1` 或 `::1`，然后执行：

```powershell
node database/verify.mjs --live
```

该命令按迁移、最小种子、在线结构/空间夹具的顺序执行。它面向新建的本地验证库，不应指向客户库或生产库。

## 回滚

仅在已确认目标是本地验证库且需要撤销本迁移时，由数据库管理员执行：

```powershell
psql -X -v ON_ERROR_STOP=1 -f database/migrations/001_postgis_dashboard.down.sql
```

该命令依赖当前会话中由组织安全方式提供的 libpq 环境变量/连接服务，不把连接串放到命令参数中。

回滚会删除 6 张业务表及其数据，属于破坏性操作；客户环境必须先备份并走变更审批。

## 关键约定

- `administrative_region.geom`、`agricultural_feature.geom` 固定为 `geometry(MultiPolygon, 4326)`。
- 面积统一调用 `main_grain_area_hectares` 或 `ST_Area(geom::geography)`，单位换算为公顷。
- 客户源数据通过 `main_grain_normalize_geometry` 修复、升维并转换为 4326。
- `dashboard_payload` 查找维度保留页面、接口、年、半年、作物、观测日期和行政区编码。
- `map_service` 的 URL、图层名和 server 都是数据，不应重新硬编码到前端。
- 栅格/TIF 继续由 GeoServer coverage store 管理，不写入本 PostGIS 矢量表。
