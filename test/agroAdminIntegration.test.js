const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')

const { DASHBOARD_ENDPOINTS } = require('../contracts/dashboardEndpoints')
const { createCaptchaStore } = require('../services/captchaStore')
const { hashPassword } = require('../services/authService')

async function startTestServer(overrides = {}) {
  const { createApp } = require('../app')
  const passwordHash = hashPassword('local-test-password', 'integration-test-salt')
  const repository = overrides.repository || {
    findUserByUsername: async (username) => ({
      id: 10,
      username,
      passwordHash,
      displayName: '本地测试用户',
      status: 1
    }),
    findDashboardPayload: async () => null,
    findTimeline: async () => [],
    findMapService: async () => null
  }
  const spatialRepository = overrides.spatialRepository || {
    findIntersections: async () => [],
    isFeatureWithinRegion: async () => false,
    calculateIntersectionArea: async () => ({ featureCount: 0, areaSquareMeters: 0 })
  }
  const app = createApp({
    repository,
    spatialRepository,
    captchaStore: createCaptchaStore({ codeGenerator: () => '2468' }),
    sessionSecret: 'integration-test-secret-with-32-bytes',
    dashboardTimeoutMs: overrides.dashboardTimeoutMs || 50,
    enableRequestLogger: false
  })
  const server = http.createServer(app.callback())
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const baseUrl = `http://127.0.0.1:${server.address().port}`
  return {
    baseUrl,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
}

async function login(baseUrl) {
  const captchaResponse = await fetch(`${baseUrl}/agro-admin/captchaImage`)
  const captcha = await captchaResponse.json()
  const response = await fetch(`${baseUrl}/agro-admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'local-user',
      password: 'local-test-password',
      code: '2468',
      uuid: captcha.uuid
    })
  })
  return { response, body: await response.json() }
}

test('验证码、登录、会话查询和退出形成完整本地认证闭环', async (t) => {
  const server = await startTestServer()
  t.after(server.close)

  const { response, body } = await login(server.baseUrl)
  assert.equal(response.status, 200)
  assert.equal(body.code, 200)
  assert.equal(typeof body.token, 'string')
  assert.match(response.headers.get('set-cookie'), /^agro_session=/)

  const sessionResponse = await fetch(`${server.baseUrl}/agro-admin/session`, {
    headers: { Authorization: `Bearer ${body.token}` }
  })
  assert.equal(sessionResponse.status, 200)
  assert.equal((await sessionResponse.json()).data.username, 'local-user')

  const logoutResponse = await fetch(`${server.baseUrl}/agro-admin/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${body.token}` }
  })
  assert.equal((await logoutResponse.json()).code, 200)

  const revokedResponse = await fetch(`${server.baseUrl}/agro-admin/session`, {
    headers: { Authorization: `Bearer ${body.token}` }
  })
  assert.equal(revokedResponse.status, 401)
})

test('无会话访问大屏接口得到授权失败而不是空数据', async (t) => {
  const server = await startTestServer()
  t.after(server.close)

  const response = await fetch(`${server.baseUrl}/agro-admin/screen/queryWeather`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  })

  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), { code: 401, msg: '未登录或会话已过期', data: null })
})

test('冻结清单中的 33 条 Koa 路由均以正确方法注册并可返回合法空载荷', async (t) => {
  const server = await startTestServer()
  t.after(server.close)
  const { body: loginBody } = await login(server.baseUrl)

  for (const endpoint of DASHBOARD_ENDPOINTS) {
    const url = `${server.baseUrl}/agro-admin${endpoint.path}`
    const init = {
      method: endpoint.method,
      headers: { Authorization: `Bearer ${loginBody.token}` }
    }
    if (endpoint.method === 'POST') {
      init.headers['Content-Type'] = 'application/json'
      init.body = '{}'
    }
    const response = await fetch(url, init)
    assert.equal(response.status, 200, `${endpoint.method} ${endpoint.path}`)
    assert.equal((await response.json()).code, 200, endpoint.key)
  }
})

test('超时请求与无关请求并发时，无关请求仍先成功返回', async (t) => {
  const never = new Promise(() => {})
  const passwordHash = hashPassword('local-test-password', 'integration-test-salt')
  const server = await startTestServer({
    dashboardTimeoutMs: 25,
    repository: {
      findUserByUsername: async (username) => ({ id: 1, username, passwordHash, displayName: username, status: 1 }),
      findDashboardPayload: async ({ endpointKey }) => endpointKey === 'queryWeather' ? never : { finishRate: 88 },
      findTimeline: async () => [],
      findMapService: async () => null
    }
  })
  t.after(server.close)
  const { body: loginBody } = await login(server.baseUrl)
  const headers = { Authorization: `Bearer ${loginBody.token}`, 'Content-Type': 'application/json' }

  const slow = fetch(`${server.baseUrl}/agro-admin/screen/queryWeather`, { method: 'POST', headers, body: '{}' })
  const fast = fetch(`${server.baseUrl}/agro-admin/screen/queryPlantingTaskStatistics`, { method: 'POST', headers, body: '{}' })
  const fastResponse = await fast
  const slowResponse = await slow

  assert.equal(fastResponse.status, 200)
  assert.equal((await fastResponse.json()).data.finishRate, 88)
  assert.equal(slowResponse.status, 504)
  assert.equal((await slowResponse.json()).code, 504)
})

test('三个空间计算接口在会话保护下调用对应仓储能力', async (t) => {
  const calls = []
  const server = await startTestServer({
    spatialRepository: {
      findIntersections: async (params) => { calls.push(['intersections', params]); return [{ feature_id: 1 }] },
      isFeatureWithinRegion: async (params) => { calls.push(['within', params]); return true },
      calculateIntersectionArea: async (params) => { calls.push(['area', params]); return { featureCount: 1, areaSquareMeters: 12.5 } }
    }
  })
  t.after(server.close)
  const { body: loginBody } = await login(server.baseUrl)
  const headers = { Authorization: `Bearer ${loginBody.token}`, 'Content-Type': 'application/json' }
  const cases = [
    ['/agro-admin/spatial/intersections', { regionCode: '370200', featureType: 'wheat' }],
    ['/agro-admin/spatial/containment', { regionCode: '370200', featureId: 1 }],
    ['/agro-admin/spatial/area-statistics', { regionCode: '370200', featureType: 'wheat' }]
  ]

  for (const [path, body] of cases) {
    const response = await fetch(`${server.baseUrl}${path}`, { method: 'POST', headers, body: JSON.stringify(body) })
    assert.equal(response.status, 200, path)
    assert.equal((await response.json()).code, 200, path)
  }
  assert.deepEqual(calls.map(([name]) => name), ['intersections', 'within', 'area'])
})
