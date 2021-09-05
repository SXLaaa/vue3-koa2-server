/*
 * @Description:
 * @Version: 2.0
 * @Autor: shiXl
 * @Date: 2021-09-05 20:57:50
 * @LastEditors: shiXl
 * @LastEditTime: 2021-09-05 21:03:40
 */
const mongoose = require("mongoose");
const userSchema = mongoose.Schema({
  roleName: String, // 角色名
  remark: String, // 备注
  permissionList: {
    // 树图选中的id
    checkedKeys: [],
    halfCheckedKeys: [],
  },
  updateTime: {
    type: Date,
    default: Date.now(),
  },
  createTime: {
    type: Date,
    default: Date.now(),
  },
});

module.exports = mongoose.model("roles", userSchema, "roles");
