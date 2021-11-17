/*
 * @Description:
 * @Version: 2.0
 * @Autor: shiXl
 * @Date: 2021-08-08 23:35:46
 * @LastEditors: shiXl
 * @LastEditTime: 2021-11-08 21:24:07
 */
const mongoose = require("mongoose");

/* 一种以文件形式存储的数据库模型骨架，不具备数据库的操作能力*/
const userSchema = mongoose.Schema({
  userId: Number, //用户ID，自增长
  userName: String, //用户名称
  userPwd: String, //用户密码，md5加密
  userEmail: String, //用户邮箱
  mobile: String, //手机号
  sex: Number, //性别 0:男  1：女
  deptId: [], //部门
  job: String, //岗位
  state: {
    type: Number,
    default: 1,
  }, // 1: 在职 2: 离职 3: 试用期
  role: {
    type: Number,
    default: 1,
  }, // 用户角色 0：系统管理员  1： 普通用户
  roleList: [], //系统角色
  createTime: {
    type: Date,
    default: Date.now(),
  }, //创建时间
  lastLoginTime: {
    type: Date,
    default: Date.now(),
  },
  remark: String,
});

/*由Schema发布生成的模型，具有抽象属性和数据库操作能力*/
module.exports = mongoose.model("users", userSchema, "users"); // 第三个参数代表关联到数据库的集合名称
