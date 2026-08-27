# SHP / GeoJSON / CSV 可重复导入

本工具默认只做 deterministic dry-run：读取本地文件、校验字段与几何、统一为 `MultiPolygon`、生成稳定 `feature_key` 和幂等 upsert SQL，不发起网络请求，也不会自动连接数据库。

需要执行 `--apply` 时，`psql` 按 `MAIN_GRAIN_PSQL`、当前 `PATH`、Windows 标准安装目录 `C:\Program Files\PostgreSQL\<版本>\bin\psql.exe` 的顺序解析。`MAIN_GRAIN_PSQL` 只能指向可执行文件，不得包含密码或连接串。

## 输入要求

必填业务字段：

- `source_id`：客户源系统内长期稳定的主键；优先用于 `feature_key`。
- `module_key`：`farmland`、`security` 或 `warning`。
- `sub_id`、`category`：页面和图层类别。
- 可选维度：`year`、`half_year`、`crop`、`stage`、`observation_date`、`district_code`。

GeoJSON 仅接受 `Feature`/`FeatureCollection` 中的 `Polygon` 或 `MultiPolygon`。CSV 模板用 `min_lon/min_lat/max_lon/max_lat` 表示面范围。GeoJSON/CSV 直接 dry-run 时必须已经是 EPSG:4326。

SHP 必须同时提供同名 `.shp`、`.shx`、`.dbf`、`.prj`。工具通过本机 GDAL `ogr2ogr` 转换到 EPSG:4326，并使用内存虚拟输出，不产生临时文件。

## Dry-run 示例

```powershell
node tools/data-import/import.mjs --input tools/data-import/templates/feature-template.geojson --format geojson --source-srid 4326 --dry-run
node tools/data-import/import.mjs --input tools/data-import/templates/feature-template.csv --format csv --source-srid 4326 --dry-run
node tools/data-import/import.mjs --input customer-data.shp --format shp --source-srid 4490 --dry-run --plan-only
```

没有 `DATABASE_URL` 时，成功的 dry-run 仍返回 `MANUAL_REQUIRED`，并报告记录数、稳定键、几何类型和 SQL SHA-256。相同输入重复执行应得到相同的稳定键和摘要。

## 客户字段映射

复制 `templates/field-map.example.json`，把右侧值改为客户数据的实际字段名：

```powershell
node tools/data-import/import.mjs --input customer.geojson --format geojson --source-srid 4326 --mapping customer-field-map.json --dry-run --output reviewed-import.sql
```

映射文件和生成 SQL 如含客户业务信息，应只保存在获批的内网交付目录，不应提交到 Git。

稳定键规则：显式 `feature_key` 优先，其次是 `source:<source_id>`；两者均缺失时使用冻结维度和规范几何的 SHA-256。单次输入内出现重复键会直接拒绝，避免静默覆盖。

## 内网替换步骤

1. 数据管理员在内网复制模板，补齐字段映射，确认原始坐标系 EPSG 代码和 SHP 侧车文件。
2. 先运行 `--dry-run --json`，归档记录数、稳定键和 SQL 摘要；修复所有校验错误。
3. 用 `--output reviewed-import.sql` 生成 SQL，由数据库管理员审阅目标表、记录数和 `ON CONFLICT (feature_key)` 更新范围。
4. 先备份客户库，再按客户变更流程人工执行迁移、种子或审阅后的导入 SQL。工具的 `--apply --allow-local-database` 仅允许本机验证库，不能用于客户远程库。
5. 导入后核对 `agricultural_feature` 总数、按 `module_key/sub_id/category/year/crop` 分组数量、无效几何数量和 `main_grain_spatial_summary` 结果。
6. 将真实 `dashboard_payload`、`screen_timeline`、`map_service` 数据按冻结查找维度 upsert；不要删除未在本次交付范围内的数据。

## GeoServer 人工发布

1. 在客户内网 GeoServer 管理界面创建指向 PostGIS 的数据存储，凭据由客户管理员在界面或密钥系统中配置，不写入本仓库。
2. 从 `agricultural_feature` 发布所需矢量图层或数据库视图；声明坐标系 EPSG:4326，并重新计算原生/经纬度边界。
3. 配置客户确认的样式和访问权限；栅格/TIF 继续用 coverage store 发布。
4. 将发布后的相对服务路径、图层名、类别、年份、半年、作物、阶段、日期和 server 写入 `map_service`。作物分布、产量、生育期必须同作物精确匹配，不得跨作物兜底。
5. 由内网集成人员验证 `getVectorTableWms`、时间轴选择及代表性的 WMS/WFS 请求；自动化脚本不访问客户 GeoServer。

## 本地应用（仅空白验证库）

只有在数据库位于本机且已人工确认时，才可在当前终端会话设置 `DATABASE_URL` 后执行：

```powershell
node tools/data-import/import.mjs --input tools/data-import/templates/feature-template.geojson --format geojson --source-srid 4326 --apply --allow-local-database
```

不要索取、复制或提交真实数据库密码。非本机 URL 会被工具拒绝。
