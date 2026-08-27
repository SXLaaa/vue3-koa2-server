const Router = require('koa-router')
const { DASHBOARD_ENDPOINTS } = require('../contracts/dashboardEndpoints')
const { AuthenticationError } = require('../services/authService')
const { createSessionAuth } = require('../middleware/sessionAuth')

function requireFields(body, fields) {
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      const error = new Error(`缺少参数: ${field}`)
      error.status = 400
      throw error
    }
  }
}

/**
 * 注册 `/agro-admin` 契约。认证、33 个大屏端点和空间服务共享同一会话边界。
 */
function createAgroAdminRouter({ authService, captchaStore, dashboardService, spatialRepository, sessionTtlSeconds }) {
  const router = new Router({ prefix: '/agro-admin' })
  const requireSession = createSessionAuth(authService)

  router.get('/captchaImage', (ctx) => {
    const captcha = captchaStore.issue()
    ctx.body = { code: 200, msg: '操作成功', ...captcha }
  })

  router.post('/login', async (ctx) => {
    try {
      const result = await authService.login(ctx.request.body || {})
      ctx.cookies.set('agro_session', result.token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        overwrite: true,
        maxAge: sessionTtlSeconds * 1000
      })
      ctx.body = { code: 200, msg: '登录成功', token: result.token }
    } catch (error) {
      if (!(error instanceof AuthenticationError)) throw error
      ctx.status = 200
      ctx.body = { code: 500, msg: error.message }
    }
  })

  router.get('/session', requireSession, (ctx) => {
    const { sub, username, displayName, iat, exp } = ctx.state.session
    ctx.body = { code: 200, msg: '操作成功', data: { userId: sub, username, displayName, issuedAt: iat, expiresAt: exp } }
  })

  router.post('/logout', requireSession, (ctx) => {
    authService.logout(ctx.state.sessionToken)
    ctx.cookies.set('agro_session', null, { overwrite: true })
    ctx.body = { code: 200, msg: '退出成功', data: null }
  })

  for (const endpoint of DASHBOARD_ENDPOINTS) {
    const register = endpoint.method === 'GET' ? router.get.bind(router) : router.post.bind(router)
    register(endpoint.path, requireSession, async (ctx) => {
      const params = endpoint.method === 'GET' ? ctx.request.query : (ctx.request.body || {})
      ctx.body = await dashboardService.execute(endpoint.key, params)
    })
  }

  router.post('/spatial/intersections', requireSession, async (ctx) => {
    const body = ctx.request.body || {}
    requireFields(body, ['regionCode', 'category'])
    ctx.body = { code: 200, msg: '操作成功', data: await spatialRepository.findIntersections(body) }
  })

  router.post('/spatial/containment', requireSession, async (ctx) => {
    const body = ctx.request.body || {}
    requireFields(body, ['regionCode', 'featureId'])
    ctx.body = { code: 200, msg: '操作成功', data: { contained: await spatialRepository.isFeatureWithinRegion(body) } }
  })

  router.post('/spatial/area-statistics', requireSession, async (ctx) => {
    const body = ctx.request.body || {}
    requireFields(body, ['regionCode', 'category'])
    ctx.body = { code: 200, msg: '操作成功', data: await spatialRepository.calculateIntersectionArea(body) }
  })

  return router
}

module.exports = { createAgroAdminRouter }
