/**
 * 用户管理模块
 */
const router = require("koa-router")();
const User = require("../models/userSchema");
const Counter = require("../models/counterSchema");
const Menu = require("../models/menuSchema");
const Role = require("../models/roleSchema");
const util = require("../utils/utils");
const jwt = require("jsonwebtoken");
const md5 = require("md5");
router.prefix("/users");
const log4js = require("../utils/log4j");

// 用户登录
router.post("/login", async (ctx) => {
  try {
    const { userName, userPwd } = ctx.request.body;
    /**
     * 返回数据库指定字段，有三种方式
     * 1. 'userId userName userEmail state role deptId roleList'
     * 2. {userId:1,_id:0}
     * 3. select('userId')
     */
    // 查找用户，同时检查用户状态是否为非离职状态（假设非离职状态用1、3表示）
    const res = await User.findOne({
      userName,
      userPwd: md5(userPwd),
      state: { $ne: 2 }, // $ne表示不等于，这里2表示离职状态
    });
    log4js.info(`User-login.findOne:${res}`);
    if (res) {
      // 更新用户的最后登录时间
      await User.updateOne(
        { _id: res._id },
        { $set: { lastLoginTime: new Date() } }
      );
      const data = res._doc;
      const token = jwt.sign(
        {
          data,
        },
        "imooc",
        { expiresIn: "1h" }
      );
      data.token = token;
      ctx.body = util.success(data);
    } else {
      log4js.info(`get params:${md5(userPwd)}`);
      ctx.body = util.fail("账号或密码不正确，或用户已离职");
    }
  } catch (error) {
    ctx.body = util.fail(error.msg);
  }
});

// 用户列表
router.get("/list", async (ctx) => {
  const { userId, userName, state } = ctx.request.query;
  const { page, skipIndex } = util.pager(ctx.request.query);
  let params = {};
  if (userId) params.userId = userId;
  if (userName) params.userName = userName;
  if (state && state != "0") params.state = state;
  try {
    // 根据条件查询所有用户列表
    const query = User.find(params, { _id: 0, userPwd: 0 });
    const list = await query.skip(skipIndex).limit(page.pageSize);
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

// 获取全量用户列表
router.get("/all/list", async (ctx) => {
  try {
    const list = await User.find({}, "userId userName userEmail");
    ctx.body = util.success(list);
  } catch (error) {
    ctx.body = util.fail(error.stack);
  }
});

// 用户删除/批量删除
router.post("/delete", async (ctx) => {
  // 待删除的用户Id数组
  const { userIds } = ctx.request.body;
  // User.updateMany({ $or: [{ userId: 10001 }, { userId: 10002 }] })
  const res = await User.updateMany({ userId: { $in: userIds } }, { state: 2 });
  if (res.nModified) {
    ctx.body = util.success(res, `共删除成功${res.nModified}条`);
    return;
  }
  ctx.body = util.fail("删除失败");
});
// 用户新增/编辑
router.post("/operate", async (ctx) => {
  const {
    userId,
    userName,
    userPwd,
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
      ctx.body = util.fail("参数错误", util.CODE.PARAM_ERROR);
      return;
    }
    const res = await User.findOne(
      { $or: [{ userName }, { userEmail }] },
      "_id userName userEmail"
    );
    if (res) {
      ctx.body = util.fail(
        `系统监测到有重复的用户，信息如下：${res.userName} - ${res.userEmail}`
      );
    } else {
      const doc = await Counter.findOneAndUpdate(
        { _id: "userId" },
        { $inc: { sequence_value: 1 } },
        { new: true }
      );
      log4js.info(`User.sequence_value:${doc}`);
      log4js.info(`User.userPwd:${userPwd}`);
      try {
        const user = new User({
          userId: doc.sequence_value,
          userName,
          userPwd: md5(userPwd) || md5("123456"),
          userEmail,
          role: 1, //默认普通用户
          roleList,
          job,
          state,
          deptId,
          mobile,
        });
        user.save();
        ctx.body = util.success("", "用户创建成功");
      } catch (error) {
        ctx.body = util.fail(error.stack, "用户创建失败");
      }
    }
  } else {
    if (!deptId) {
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
// 获取用户对应的权限菜单
router.get("/getPermissionList", async (ctx) => {
  let authorization = ctx.request.headers.authorization;
  let { data } = util.decoded(authorization);

  let menuList = await getMenuList(data.role, data.roleList);
  let actionList = getAction(JSON.parse(JSON.stringify(menuList)));
  ctx.body = util.success({ menuList, actionList });
});
// 用户密码修改
router.post("/updatePwd", async (ctx) => {
  const { userName, currentPassword, newPassword } = ctx.request.body;
  if (!userName || !currentPassword || !newPassword) {
    ctx.body = util.fail("缺少必要的参数");
    return;
  }
  // 验证旧密码
  const user = await User.findOne({ userName, userPwd: md5(currentPassword) });
  if (!user) {
    ctx.body = util.fail("原密码不正确");
    return;
  }
  try {
    // 更新新密码
    await User.updateOne({ userName }, { userPwd: md5(newPassword) });
    ctx.body = util.success("密码修改成功");
  } catch (error) {
    ctx.body = util.fail("密码修改失败：" + error.message);
  }
});
async function getMenuList(userRole, roleKeys) {
  let rootList = [];
  if (userRole == 0) {
    rootList = (await Menu.find({})) || [];
  } else {
    // 根据用户拥有的角色，获取权限列表
    // 现查找用户对应的角色有哪些
    let roleList = await Role.find({ _id: { $in: roleKeys } });
    let permissionList = [];
    roleList.map((role) => {
      let { checkedKeys, halfCheckedKeys } = role.permissionList;
      console.log(
        "🚀 ~ file: users.js:217 ~ roleList.map ~ checkedKeys, halfCheckedKeys:",
        checkedKeys,
        halfCheckedKeys
      );
      permissionList = permissionList.concat([
        ...checkedKeys,
        ...halfCheckedKeys,
      ]);
    });
    permissionList = [...new Set(permissionList)];
    rootList = await Menu.find({ _id: { $in: permissionList } });
  }

  // 解包数据
  const unwrappedRootList = rootList.map((item) => item._doc || item);
  return util.getTreeMenu(unwrappedRootList, null, []);
}

function getAction(list) {
  let actionList = [];
  const deep = (arr) => {
    while (arr.length) {
      let item = arr.pop();
      if (item.action) {
        item.action.map((action) => {
          actionList.push(action.menuCode);
        });
      }
      if (item.children && !item.action) {
        deep(item.children);
      }
    }
  };
  deep(list);
  return actionList;
}

module.exports = router;
