/**
 * 用户管理模块
*/
const router = require('koa-router')()
const util = require('../utils/utils')
const User = require('../models/userSchema')
const jwt = require('jsonwebtoken') // 生成token

router.prefix('/users') // 定义二级路由

/*定义post接口*/
router.post('/login',async(ctx)=>{ // callBack回掉函数中，ctx可以拿到请求的参数
  try{
    const { userName, userPwd } = ctx.request.body; // get：query，post：body
    const res = await User.findOne({
      userName,
      userPwd
    })
    const data = res._doc;
    const token = jwt.sign({
      data:data,
    },'imooc',{expiresIn: 30}) // imooc 密钥， expiresIn 时间30秒
    if(res){ // 判断res是true，输出
      data.token = token;
      ctx.body = util.success(data)
    }else{
      ctx.body = util.fail("帐号或密码不正确")
    }
  }catch(error){
    ctx.body = util.fail(error.msg)
  }
  
})
module.exports = router