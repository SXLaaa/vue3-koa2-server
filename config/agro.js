const crypto = require('crypto')

function positiveInteger(value, fallback) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

/**
 * 本地后端只从环境变量读取数据库与会话配置；缺少会话密钥时使用进程级随机值，不提交固定密钥。
 */
function readAgroConfig(env = process.env) {
  return {
    databaseUrl: env.DATABASE_URL || 'postgresql://127.0.0.1:5432/main_grain',
    databaseConnectionTimeoutMs: positiveInteger(env.DB_CONNECTION_TIMEOUT_MS, 2_000),
    databaseQueryTimeoutMs: positiveInteger(env.DB_QUERY_TIMEOUT_MS, 5_000),
    dashboardTimeoutMs: positiveInteger(env.DASHBOARD_REQUEST_TIMEOUT_MS, 5_000),
    sessionSecret: env.AUTH_SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    sessionTtlSeconds: positiveInteger(env.AUTH_SESSION_TTL_SECONDS, 8 * 60 * 60),
    captchaTtlMs: positiveInteger(env.AUTH_CAPTCHA_TTL_MS, 2 * 60 * 1000)
  }
}

module.exports = { readAgroConfig }
