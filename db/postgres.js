const { Pool } = require('pg')

/**
 * 创建受连接与语句超时保护的 PostgreSQL 连接池；连接只在首次查询时建立。
 */
function createPostgresPool({ databaseUrl, connectionTimeoutMs, queryTimeoutMs }) {
  return new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: connectionTimeoutMs,
    query_timeout: queryTimeoutMs,
    statement_timeout: queryTimeoutMs,
    max: 10,
    idleTimeoutMillis: 10_000,
    allowExitOnIdle: true
  })
}

module.exports = { createPostgresPool }
