/*
 * @Description:
 * @Version: 2.0
 * @Autor: shiXl
 * @Date: 2021-09-05 21:05:41
 * @LastEditors: shiXl
 * @LastEditTime: 2021-09-05 23:02:20
 */
/**
 * 用户管理模块
 */
const router = require("koa-router")();
const Role = require("../models/roleSchema");
const util = require("../utils/utils");
const jwt = require("jsonwebtoken");
const md5 = require("md5");
const { info } = require("../utils/log4j");
router.prefix("/roles");

// 查询所有角色
router.get("/allList", async (ctx) => {
  try {
    const list = await Role.find({}, "_id roleName");
    ctx.body = util.success(list);
  } catch (error) {
    ctx.body = util.fail(`查询失败:${error.stack}`);
  }
});

// 按页获取角色列表
router.get("/list", async (ctx) => {
  const { roleName } = ctx.request.query;
  const { page, skipIndex } = util.pager(ctx.request.query);
  try {
    let params = {};
    if (roleName) params.roleName = roleName;
    const query = Role.find(params);
    const list = await query.skip(skipIndex).limit(page.pageSize);
    const total = await Role.countDocuments(params);
    ctx.body = util.success({
      list,
      page: {
        ...page,
        total,
      },
    });
  } catch (error) {
    ctx.body = util.fail(`查询失败：${error.stack}`);
  }
});

// 角色操作：创建、编辑、删除
router.post("/operate", async (ctx) => {
  const { _id, roleName, remark, action } = ctx.request.body;
  let res, info;
  try {
    if (action == "create") {
      res = await Role.create({ roleName, remark });
      info = "创建成功";
    } else if (action == "edit") {
      if (_id) {
        let params = { roleName, remark };
        params.update = new Date();
        res = await Role.findByIdAndUpdate(_id, params);
        info = "编辑成功";
      } else {
        ctx.body = util.fail("缺少参数params: _id");
        return;
      }
    } else {
      if (_id) {
        res = await Role.findByIdAndRemove(_id);
        info = "删除成功";
      } else {
        ctx.body = util.fail("缺少参数params: _id");
        return;
      }
    }
    ctx.body = util.success(res, info);
  } catch (error) {
    ctx.body = util.fail(error.stack);
  }
});

module.exports = router;
