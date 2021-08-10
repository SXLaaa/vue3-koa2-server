// config 数据库配置
// models 数据库模型层
// routes 定义路由及接口

app.use(async (ctx, next) => {await next()}) // ctx是koa2的上下文对
# 先执行app.use中间件，再执行接口