const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')

test('活动运行时使用 pg 且不再启动或依赖 Mongoose', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8')
  const localStartSource = fs.readFileSync(path.join(root, 'scripts/start-local.ps1'), 'utf8')

  assert.equal(typeof packageJson.dependencies.pg, 'string')
  assert.equal(Object.hasOwn(packageJson.dependencies, 'mongoose'), false)
  assert.equal(appSource.includes("require('./config/db')"), false)
  assert.equal(appSource.includes("require('./routes/users')"), false)
  assert.equal(localStartSource.includes('MONGO_DISABLED'), false)
})
