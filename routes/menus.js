/*
 * @Description:
 * @Version: 2.0
 * @Autor: shiXl
 * @Date: 2021-08-21 23:13:44
 * @LastEditors: shiXl
 * @LastEditTime: 2021-09-08 10:15:18
 */
const router = require("koa-router")();
const util = require("../utils/utils");
const Menu = require("../models/menuSchema");

router.prefix("/menu");
// 菜单列表查询
router.get("/list", async (ctx) => {
  const { menuName, menuState } = ctx.request.query;
  const params = {};
  if (menuName) params.menuName = menuName;
  if (menuState) params.menuState = menuState;
  let rootList = (await Menu.find(params)) || [];
  // rootList就是数据库中的menus表
  const permissionList = getTreeMenu(rootList, null, []);

  ctx.body = util.success(permissionList);
});
// 递归拼接树形列表
function getTreeMenu(rootList, id, list) {
  for (let i = 0; i < rootList.length; i++) {
    let item = rootList[i];
    if (String(item.parentId.slice().pop()) == String(id)) {
      // slice 不会改变原数组； pop尾部删除，会改变原数组
      // 判断数组第一个值是null，就说明是父级菜单
      list.push(item._doc); // _doc 指的是文档，当前这条数据; moongos语法，取子文档
    }
  }
  list.map((item) => {
    item.children = [];
    getTreeMenu(rootList, item._id, item.children);
    if (item.children.length == 0) {
      delete item.children;
    } else if (item.children.length > 0 && item.children[0].menuType == 2) {
      //menuType == 2 按钮类型
      item.action = item.children;
    }
  });
  return list;
}
//菜单编辑、新增、删除
router.post("/operate", async (ctx) => {
  const { _id, action, ...params } = ctx.request.body;
  let res, info;
  try {
    if (action == "add") {
      res = await Menu.create(params);
      info = "创建成功";
    } else if (action == "edit") {
      params.updateTime = new Date();
      res = await Menu.findByIdAndUpdate(_id, params); // 根据_id进行更新
      info = "编辑成功";
    } else {
      res = await Menu.findByIdAndRemove(_id);
      await Menu.deleteMany({ parentId: { $all: [_id] } }); // 删除子数据
      info = "删除成功";
    }
    ctx.body = util.success("", info);
  } catch (error) {
    ctx.body = util.fail(error.stack, "用户创建失败");
  }
});
module.exports = router;
