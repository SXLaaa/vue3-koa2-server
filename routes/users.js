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
    /**
     * 返回数据库指定字段，三种方式
     * 1.‘xx xx xx xx’
     * 2.{userName:1, userId:1} // 1代表返回 0不返回
     * 3.select('userName')
    */
    const res = await User.findOne({
      userName,
      userPwd
    }, 'userId userName userEmail state role deptId roleList') // 逗号后面可以指定返回哪些字段，多个字段用空格
    const data = res._doc;
    const token = jwt.sign({
      data:data,
    },'imooc',{expiresIn: '1h'}) // imooc 密钥， expiresIn 时间30秒，‘1h’ 代表1小时
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