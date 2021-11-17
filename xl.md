<!--
 * @Description: 
 * @Version: 2.0
 * @Autor: shiXl
 * @Date: 2021-08-08 23:35:46
 * @LastEditors: shiXl
 * @LastEditTime: 2021-11-17 22:51:20
-->
// config 数据库配置
// models 数据库模型层
// routes 定义路由及接口

app.use(async (ctx, next) => {await next()}) // ctx是koa2的上下文对
# 先执行app.use中间件，再执行接口
# 默认密码 123456
# 启动数据库
mongod -f /Users/luzheng/mongoDB/mongo/etc/mongo.conf
# 启动
yarn start