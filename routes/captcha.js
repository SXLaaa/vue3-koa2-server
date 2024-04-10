const router = require("koa-router")();
const util = require("../utils/utils");
const log4js = require("../utils/log4j");
const Captcha = require("../models/captchaSchema");
router.prefix("/captcha");
const svgCaptcha = require("svg-captcha");

// 生成验证码图片并存储到数据库
router.get("/getCaptcha", async (ctx, next) => {
  const captcha = svgCaptcha.create({
    size: 4,
    width: 120,
    height: 40,
    noise: 2,
  });
  // 检查是否已存在相同的验证码
  const existingCaptcha = await Captcha.findOne({ captchaText: captcha.text });
  if (existingCaptcha) {
    // 如果存在，则重新生成验证码
    captcha.text = svgCaptcha.create().text;
  }
  const captchaDocument = new Captcha({
    captchaText: captcha.text,
    expiresAt: new Date(Date.now() + 300000), // 设置5分钟过期
  });
  // 将验证码ID存储到session中
  // ctx.session.captchaId = captchaDocument._id;
  await captchaDocument.save();
  ctx.type = "image/svg+xml";
  ctx.body = util.success(captcha.data);
});

// 验证码校验
router.post("/verifyCaptcha", async (ctx, next) => {
  const { captcha } = ctx.request.body;
  try {
    // 根据captchaId和过期时间查找验证码
    const captchaFromDB = await Captcha.findOneAndDelete({
      // _id: mongoose.Types.ObjectId(captchaId),
      captchaText: captcha,
      expiresAt: { $gte: new Date() },
    });
    log4js.info(`getCaptcha params4:${captchaFromDB}`);
    if (captchaFromDB) {
      // 验证成功，删除这条验证码记录
      // await Captcha.findByIdAndDelete(captchaFromDB._id);
      ctx.body = util.success("验证码验证成功！");
    } else {
      ctx.body = util.fail("验证码错误或已过期！");
    }
  } catch (error) {
    ctx.status = 500;
    ctx.body = util.fail("服务器内部错误！");
  }
});
module.exports = router;
