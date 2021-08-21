const router = require("koa-router")();
const util = require("../utils/utils");
const Menu = require("../models/menuSchema");

router.prefix("/menu");
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
