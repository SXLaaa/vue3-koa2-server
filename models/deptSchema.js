/*
 * @Description:
 * @Version: 2.0
 * @Autor: shiXl
 * @Date: 2021-11-07 16:20:29
 * @LastEditors: shiXl
 * @LastEditTime: 2021-11-07 16:34:23
 */
const mongoose = require("mongoose");
const deptSchema = mongoose.Schema({
  deptName: String,
  userId: String,
  userName: String,
  userEmail: String,
  parentId: [mongoose.Types.ObjectId],
  updateTime: {
    type: Date,
    default: Date.now(),
  },
  createTime: {
    type: Date,
    default: Date.now(),
  },
});

module.exports = mongoose.model("depts", deptSchema, "depts");
