/*
 * @Description: 
 * @Version: 2.0
 * @Autor: shiXl
 * @Date: 2021-09-05 20:57:50
 * @LastEditors: shiXl
 * @LastEditTime: 2022-04-10 10:12:18
 */
const mongoose = require('mongoose')
const userSchema = mongoose.Schema({
    roleName: String,
    remark: String,
    permissionList: {
        checkedKeys: [],
        halfCheckedKeys: []
    },
    updateTime: {
        type: Date,
        default: Date.now()
    },
    createTime: {
        type: Date,
        default: Date.now()
    }
})

module.exports = mongoose.model("roles", userSchema, "roles")