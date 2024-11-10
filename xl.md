<!--
 * @Description:
 * @Version: 2.0
 * @Autor: shiXl
 * @Date: 2021-08-08 23:35:46
 * @LastEditors: shixl shixl@dist.com.cn
 * @LastEditTime: 2024-04-17 23:19:38
-->

// config 数据库配置
// models 数据库模型层
// routes 定义路由及接口
app.use(async (ctx, next) => {await next()}) // ctx 是 koa2 的上下文对

# 默认密码 123456

# 启动数据库 mac

mongod -f /Users/luzheng/mongoDB/mongo/etc/mongo.conf

# 启动数据库 windows

# 启动 安装依赖（MAC、Windows 切换需删除 yarn.lock）

yarn / yarn start

# Docker 部署

##

docker pull nginx:1.17.0
docker pull mongo:latest

##

sudo docker-compose --project-name my_project up -d
