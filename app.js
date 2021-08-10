const Koa = require('koa')
const app = new Koa()
const views = require('koa-views') // 作用：如果想使用koa2渲染页面
const json = require('koa-json') // 作用：把参数转为json对象
const onerror = require('koa-onerror')
const bodyparser = require('koa-bodyparser')
const logger = require('koa-logger') // 作用：打印后台日志
const log4js = require('./utils/log4j')
const users = require('./routes/users')
const router = require('koa-router')()
const koajwt  = require('koa-jwt')
const utils = require('./utils/utils')

// error handler
onerror(app)
require('./config/db')
// middlewares  
app.use(bodyparser({
  enableTypes:['json', 'form', 'text'] // 接受前端传过来的参数格式
}))
app.use(json())
app.use(logger())
app.use(require('koa-static')(__dirname + '/public'))
app.use(views(__dirname + '/views', {
  extension: 'pug'
}))

// logger
app.use(async (ctx, next) => {
  log4js.info(`get params:${JSON.stringify(ctx.request.query)}`)
  log4js.info(`post params:${JSON.stringify(ctx.request.body)}`)
  await next().catch((err)=>{
    if(err.status == '401'){
      ctx.status = 200;
      ctx.body = utils.fail('Token认证失败',utils.CODE.AUTH_ERROR)
    }else{
      throw err;
    }
  })
})
/**
 * token拦截 中间件，任何接口进来会经过它过滤一下
 * path: [/api/users/login]
 * unless = 除了登陆接口不校验token
*/
app.use(koajwt({secret:'imooc'}).unless({
  path: [/^\/api\/users\/login/]
}))

router.prefix("/api")

router.use(users.routes(), users.allowedMethods()) // use 加载路由，并允许下面的所有方法
app.use(router.routes(),router.allowedMethods())

// error-handling
app.on('error', (err, ctx) => {
  log4js.error(`${err.stack}`) // 打印错误栈信息
});

module.exports = app
