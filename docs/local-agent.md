# 本地智能体启停与迁移

智能体已经合并到本仓库，通过业务后端的 `/api/agent/*` 接口提供服务；不再需要 `vue3-koa2-agent` 仓库。前端 `/agent` 路由已在白名单中，地址为 `http://127.0.0.1:8080/#/agent`。

## 日常启动

首次安装依赖：

```powershell
cd D:\国测海遥\vue3-koa2-server
npm install
```

启动 Ollama 和后端（端口 `3000`）：

```powershell
cd D:\国测海遥\vue3-koa2-server
npm run local
```

另开一个 PowerShell 窗口启动前端：

```powershell
cd D:\国测海遥\vue3-koa2-web
npm run dev
```

健康检查：

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/agent/health
```

## 日常关闭

前端运行窗口按 `Ctrl+C`。关闭业务后端、Agent 和 Ollama：

```powershell
cd D:\国测海遥\vue3-koa2-server
npm run local:stop
```

`local:stop` 会停止 `3000` 端口，因此同端口上的业务后端也会一同停止；不会删除模型、会话或训练数据。

本仓库的旧用户管理功能仍会尝试连接 MongoDB。MongoDB 未启动时，智能体接口仍可使用，但用户登录等数据库功能不可用，并会在控制台记录连接失败日志。

## 模型与学习数据位置

| 内容 | 默认位置 | 是否进入 Git |
| --- | --- | --- |
| Agent 代码 | `D:\国测海遥\vue3-koa2-server` | 是 |
| 学习数据 | `D:\国测海遥\vue3-koa2-server\data\agent` | 否 |
| Ollama 模型 | `C:\Users\79191\.ollama\models` | 否 |

`data\agent\training.jsonl` 保存“教学”，`feedback.jsonl` 保存“纠正”，`sessions` 保存会话，`exports` 保存 SFT 导出集。它们会被本地知识检索使用，但不会在聊天时直接修改基础模型权重。

## 换机备份

关闭服务后，至少备份学习数据：

```powershell
$backupRoot = 'E:\LocalAgentBackup'
robocopy `
  'D:\国测海遥\vue3-koa2-server\data\agent' `
  (Join-Path $backupRoot 'agent-data') `
  /E /Z /R:2 /W:2

if ($LASTEXITCODE -ge 8) {
  throw "Agent 数据备份失败，robocopy 退出码：$LASTEXITCODE"
}
```

需要离线迁移模型时，复制整个 `C:\Users\79191\.ollama\models` 目录，不能只复制单个 `blobs` 文件。新电脑恢复数据时，把备份目录复制回 `D:\国测海遥\vue3-koa2-server\data\agent`。

## 环境变量

默认模型为 `qwen2.5-coder:7b`。可按需设置系统环境变量 `AGENT_MODEL`、`AGENT_PROVIDER`、`AGENT_BASE_URL`、`AGENT_DATA_DIR`、`AGENT_TIMEOUT` 和 `AGENT_CORS_ORIGIN`。使用云端兼容接口时，密钥只能放在系统环境变量，不能提交到 Git。
