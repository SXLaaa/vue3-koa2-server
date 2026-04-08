<!--
 * @Description: 
 * @Version: 2.0
 * @Autor: shiXl
 * @Date: 2021-08-08 23:35:46
 * @LastEditors: shixiaolei
 * @LastEditTime: 2026-04-08 15:52:50
-->
// config 数据库配置
// models 数据库模型层
// routes 定义路由及接口

app.use(async (ctx, next) => {await next()}) // ctx是koa2的上下文对
# 先执行app.use中间件，再执行接口
# 默认密码 123456
# 启动数据库 mac
mongod -f /Users/luzheng/mongoDB/mongo/etc/mongo.conf
# 启动数据库 windows
# 启动
yarn start

// 测试gitee与github更新

# docker打包
MAC ---------------------- docker compose 
Windows ------------------ docker-compose

// 打包运行 // docker-compose是一个非常有用的工具，它主要用于定义和运行多容器的Docker应用程序
sudo docker compose --project-name my_project up -d // 指定名
docker-compose --project-name my_project up -d --build

// 如果只想更改某一个容器
docker compose build web
docker compose stop web  // 停止
docker compose up -d web // 重新启动 

// 代码更新
docker-compose pull   # 拉取最新镜像