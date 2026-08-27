const { AuthenticationError } = require('../services/authService')
const { RequestTimeoutError } = require('../services/dashboardService')

/**
 * 将单个请求的异常收敛为稳定 JSON envelope，避免异常越过请求边界影响同进程其他调用。
 */
function createAgroErrorBoundary() {
  return async function agroErrorBoundary(ctx, next) {
    try {
      await next()
    } catch (error) {
      if (error instanceof AuthenticationError) {
        ctx.status = 401
        ctx.body = { code: 401, msg: '未登录或会话已过期', data: null }
        return
      }
      if (error instanceof RequestTimeoutError) {
        ctx.status = 504
        ctx.body = { code: 504, msg: '请求处理超时', data: null }
        return
      }
      if (error && error.status === 400) {
        ctx.status = 400
        ctx.body = { code: 400, msg: error.message, data: null }
        return
      }
      ctx.app.emit('error', error, ctx)
      ctx.status = 503
      ctx.body = { code: 503, msg: '服务暂时不可用', data: null }
    }
  }
}

module.exports = { createAgroErrorBoundary }
