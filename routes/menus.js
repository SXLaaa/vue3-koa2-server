/*
 * @Description:
 * @Version: 2.0
 * @Autor: shiXl
 * @Date: 2021-08-21 23:13:44
 * @LastEditors: shiXl
 * @LastEditTime: 2021-11-17 22:22:58
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
  const permissionList = util.getTreeMenu(rootList, null, []);

  ctx.body = util.success(permissionList);
});
//菜单编辑、新增、删除
router.post("/operate", async (ctx) => {
  const { _id, action, ...params } = ctx.request.body;
  let res, info;
  try {
    if (action == "add") {
      res = await Menu.create(params);
      info = "创建成功";
    } else if (action == "edit") {
      params.updateTime = new Date();
      res = await Menu.findByIdAndUpdate(_id, params); // 根据_id进行更新
      info = "编辑成功";
    } else {
      res = await Menu.findByIdAndRemove(_id);
      await Menu.deleteMany({ parentId: { $all: [_id] } }); // 删除子数据
      info = "删除成功";
    }
    ctx.body = util.success("", info);
  } catch (error) {
    ctx.body = util.fail(error.stack, "用户创建失败");
  }
});
module.exports = router;
