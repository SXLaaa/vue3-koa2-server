/*
 * @FilePath: /vue3-koa2-server/config/db.js
 * @Author: shixiaolei
 * @Date: 2024-04-17 21:35:44
 * @LastEditTime: 2024-07-16 09:07:49
 * @LastEditors: shixiaolei
 * @Description: 
 */
/**
 * 数据库连接
*/
const mongoose = require('mongoose');
const config = require('./index');
const log4js = require('../utils/log4j');

mongoose.connect(process.env.MONGO_URI ? config.DockerURL : config.URL, { // 连接数据库
  useNewUrlParser: true,
  useUnifiedTopology: true
})

const db = mongoose.connection;

db.on('error', () => {
  log4js.error('**数据库连接失败**')
})
db.on('open', () => {
  log4js.info('**数据库连接成功**')
})