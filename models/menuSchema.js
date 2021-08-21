const mongoose = require("mongoose");
const userSchema = mongoose.Schema({
  menuType: Number, // 菜单类型
  menuName: String, // 菜单名称
  menuCode: String, // 权限标志
  path: String, // 路由地址
  icon: String, // 图标
  componet: String, // 组件地址
  menuState: Number, // 菜单状态
  parentId: [mongoose.Types.ObjectId],
  createTime: {
    // 创建时间
    type: Date,
    default: Date.now(),
  },
  updateTime: {
    // 更新时间
    type: Date,
    default: Date.now(),
  },
});
module.exports = mongoose.model("menu", userSchema, "menus"); // Schema约束对象和连接数据库
