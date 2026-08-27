const path = require('path')
const Koa = require('koa')
const Router = require('koa-router')
const bodyparser = require('koa-bodyparser')
const json = require('koa-json')
const logger = require('koa-logger')
const serve = require('koa-static')
const views = require('koa-views')
const log4js = require('./utils/log4j')
const agent = require('./routes/agent')
const { readAgroConfig } = require('./config/agro')
const { createPostgresPool } = require('./db/postgres')
const { createPostgresRepository } = require('./repositories/postgresRepository')
const { createSpatialRepository } = require('./repositories/spatialRepository')
const { createCaptchaStore } = require('./services/captchaStore')
const { createAuthService } = require('./services/authService')
const { createDashboardService } = require('./services/dashboardService')
const { createAgroErrorBoundary } = require('./middleware/agroErrorBoundary')
const { createAgroAdminRouter } = require('./routes/agroAdmin')

/**
 * 应用工厂允许测试注入本地仓储；生产启动则创建受超时保护的 pg 连接池。
 */
function createApp(options = {}) {
  const config = readAgroConfig()
  const pool = options.pool || (options.repository ? null : createPostgresPool({
    databaseUrl: config.databaseUrl,
    connectionTimeoutMs: config.databaseConnectionTimeoutMs,
    queryTimeoutMs: config.databaseQueryTimeoutMs
  }))
  const repository = options.repository || createPostgresRepository(pool)
  const spatialRepository = options.spatialRepository || createSpatialRepository(pool)
  const captchaStore = options.captchaStore || createCaptchaStore({ ttlMs: config.captchaTtlMs })
  const sessionTtlSeconds = options.sessionTtlSeconds || config.sessionTtlSeconds
  const authService = options.authService || createAuthService({
    userRepository: repository,
    captchaStore,
    sessionSecret: options.sessionSecret || config.sessionSecret,
    sessionTtlSeconds
  })
  const dashboardService = options.dashboardService || createDashboardService({
    repository,
    timeoutMs: options.dashboardTimeoutMs || config.dashboardTimeoutMs
  })
  const agroRouter = createAgroAdminRouter({
    authService,
    captchaStore,
    dashboardService,
    spatialRepository,
    sessionTtlSeconds
  })
  const apiRouter = new Router({ prefix: '/api' })
  apiRouter.use(agent.routes(), agent.allowedMethods())

  const app = new Koa()
  app.use(createAgroErrorBoundary())
  app.use(bodyparser({ enableTypes: ['json', 'form', 'text'], jsonLimit: '1mb' }))
  app.use(json())
  if (options.enableRequestLogger !== false) app.use(logger())
  app.use(serve(path.join(__dirname, 'public')))
  app.use(views(path.join(__dirname, 'views'), { extension: 'pug' }))
  app.use(agroRouter.routes()).use(agroRouter.allowedMethods())
  app.use(apiRouter.routes()).use(apiRouter.allowedMethods())
  app.on('error', (error) => log4js.error(error.stack || error.message))
  app.context.postgresPool = pool
  return app
}

const app = createApp()
app.createApp = createApp

module.exports = app
