function readSessionToken(ctx) {
  const authorization = ctx.get('authorization')
  if (/^Bearer\s+\S+$/i.test(authorization)) return authorization.replace(/^Bearer\s+/i, '')
  return ctx.cookies.get('agro_session') || ''
}

/**
 * 会话中间件同时接受同源 HttpOnly Cookie 和 Bearer，校验结果只写入当前请求状态。
 */
function createSessionAuth(authService) {
  return async function requireSession(ctx, next) {
    const token = readSessionToken(ctx)
    const session = authService.verifySession(token)
    ctx.state.sessionToken = token
    ctx.state.session = session
    await next()
  }
}

module.exports = { createSessionAuth, readSessionToken }
