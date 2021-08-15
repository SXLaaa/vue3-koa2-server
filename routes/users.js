/**
 * 用户管理模块
 */
const router = require("koa-router")();
const util = require("../utils/utils");
const User = require("../models/userSchema");
const jwt = require("jsonwebtoken"); // 生成token

router.prefix("/users"); // 定义二级路由

/*定义post接口*/
router.post("/login", async (ctx) => {
  // callBack回掉函数中，ctx可以拿到请求的参数
  try {
    const { userName, userPwd } = ctx.request.body; // get：query，post：body
    /**
     * 返回数据库指定字段，三种方式
     * 1.‘xx xx xx xx’
     * 2.{userName:1, userId:1} // 1代表返回 0不返回
     * 3.select('userName')
     */
    const res = await User.findOne(
      {
        userName,
        userPwd,
      },
      "userId userName userEmail state role deptId roleList"
    ); // 逗号后面可以指定返回哪些字段，多个字段用空格
    const data = res._doc;
    const token = jwt.sign(
      {
        data: data,
      },
      "imooc",
      { expiresIn: "1h" }
    ); // imooc 密钥， expiresIn 时间30秒，‘1h’ 代表1小时
    if (res) {
      // 判断res是true，输出
      data.token = token;
      ctx.body = util.success(data);
    } else {
      ctx.body = util.fail("帐号或密码不正确");
    }
  } catch (error) {
    ctx.body = util.fail(error.msg);
  }
});
/*用户列表接口*/
router.get("/list", async (ctx) => {
  const { userId, userName, state } = ctx.request.query;
  const { page, skipIndex } = util.pager(ctx.request.query);
  let params = {};
  if (userId) params.userId = userId;
  if (userName) params.userName = userName;
  if (state && state != "0") params.state = state;
  try {
    // 根据条件查询所有的用户列表
    const query = User.find(params, { _id: 0, userPwd: 0 });
    const list = await query.skip(skipIndex).limit(page.pageSize); // query.skip(skipIndex) 表示从第几条数据开始查
    const total = await User.countDocuments(params);
    ctx.body = util.success({
      page: {
        ...page,
        total,
      },
      list,
    });
  } catch (error) {
    ctx.body = util.fail(`查询异常:${error.stack}`);
  }
});
/*用户删除/批量删除*/
router.post("/delete", async (ctx) => {
  const { userIds } = ctx.request.body;
  const res = await User.updateMany({ userId: { $in: userIds } }, { state: 2 });
  if (res.nModified) {
    ctx.body = util.success(res, `共删除成功${res.nModified}条`);
    return;
  }
  ctx.body = util.fail("删除失败");
});
/*用户新增、编辑*/
router.post("/operate", async (ctx) => {
  const {
    userId,
    userName,
    userEmail,
    mobile,
    job,
    state,
    roleList,
    deptId,
    action,
  } = ctx.request.body;
  if (action == "add") {
    if (!userName || !userEmail || !deptId) {
      // 判断必填为空
      ctx.body = util.fail("参数错误", util.CODE.PARAM_ERROR);
      return;
    }
  } else {
    if (!deptId) {
      // 判断部门为空
      ctx.body = util.fail("部门不能为空", util.CODE.PARAM_ERROR);
      return;
    }
    try {
      const res = await User.findOneAndUpdate(
        { userId },
        { mobile, job, state, roleList, deptId }
      );
      ctx.body = util.success({}, "更新成功");
    } catch (error) {
      ctx.body = util.fail(error.stack, "更新失败");
    }
  }
});
module.exports = router;
