/*
 * @Description:验证码
 * @Version: 2.0
 * @Autor: shiXl
 * @Date: 2021-08-21 23:13:44
 * @LastEditors: shiXl
 * @LastEditTime: 2021-11-21 11:23:54
 */
const mongoose = require("mongoose");
const captchaSchema = mongoose.Schema({
  captchaText: String, // 验证码文本
  expiresAt: Date, // 生成日期
});
module.exports = mongoose.model("captcha", captchaSchema, "captcha"); // Schema约束对象和连接数据库
