const test = require('node:test')
const assert = require('node:assert/strict')

const TEST_SECRET = 'unit-test-secret-with-at-least-32-bytes'

test('验证码一次性校验后登录创建会话，退出后会话立即失效', async () => {
  const { createCaptchaStore } = require('../services/captchaStore')
  const { createAuthService, hashPassword } = require('../services/authService')
  const captchaStore = createCaptchaStore({ codeGenerator: () => '2468' })
  const passwordHash = await hashPassword('safe-local-password', 'fixed-test-salt')
  const auth = createAuthService({
    userRepository: {
      findUserByUsername: async (username) => username === 'local-user'
        ? { id: 7, username, passwordHash, displayName: '本地用户', status: 1 }
        : null
    },
    captchaStore,
    sessionSecret: TEST_SECRET,
    sessionTtlSeconds: 60
  })
  const captcha = captchaStore.issue()

  const login = await auth.login({
    username: 'local-user',
    password: 'safe-local-password',
    code: '2468',
    uuid: captcha.uuid
  })

  assert.equal(typeof login.token, 'string')
  assert.equal(auth.verifySession(login.token).username, 'local-user')
  assert.equal(auth.logout(login.token), true)
  assert.throws(() => auth.verifySession(login.token), /会话已失效/)
})

test('错误验证码和错误口令均拒绝登录且不泄露账号是否存在', async () => {
  const { createCaptchaStore } = require('../services/captchaStore')
  const { createAuthService, hashPassword } = require('../services/authService')
  const captchaStore = createCaptchaStore({ codeGenerator: () => '1357' })
  const passwordHash = await hashPassword('correct-password', 'fixed-test-salt')
  const auth = createAuthService({
    userRepository: {
      findUserByUsername: async () => ({
        id: 1,
        username: 'local-user',
        passwordHash,
        displayName: '本地用户',
        status: 1
      })
    },
    captchaStore,
    sessionSecret: TEST_SECRET
  })

  const badCaptcha = captchaStore.issue()
  await assert.rejects(
    auth.login({ username: 'local-user', password: 'correct-password', code: '0000', uuid: badCaptcha.uuid }),
    /验证码错误或已过期/
  )

  const badPassword = captchaStore.issue()
  await assert.rejects(
    auth.login({ username: 'local-user', password: 'wrong-password', code: '1357', uuid: badPassword.uuid }),
    /用户名或密码错误/
  )
})

test('验证码过期后不能用于登录', () => {
  const { createCaptchaStore } = require('../services/captchaStore')
  let now = 1_000
  const store = createCaptchaStore({
    codeGenerator: () => '9999',
    ttlMs: 100,
    now: () => now
  })
  const captcha = store.issue()
  now = 1_101

  assert.equal(store.consume(captcha.uuid, '9999'), false)
})
