const fs = require('fs')
const path = require('path')
const { DASHBOARD_ENDPOINTS } = require('../contracts/dashboardEndpoints')

const root = path.join(__dirname, '..')
const scanRoots = [
  'app.js', 'config/agro.js', 'contracts', 'db', 'middleware',
  'repositories', 'routes/agroAdmin.js', 'services/authService.js',
  'services/captchaStore.js', 'services/dashboardService.js'
]
const forbiddenHosts = [
  ['27', '223', '102', '27'].join('.'),
  ['192', '168', '71', '209'].join('.'),
  ['home', 'aceimage', 'cn'].join('.'),
  ['tian', 'di', 'tu'].join('')
]
const secretPatterns = [
  /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]/i,
  /(?:token|secret|api[_-]?key)\s*[:=]\s*['"][A-Za-z0-9_\-]{20,}['"]/i
]

function listFiles(target) {
  const absolute = path.join(root, target)
  if (!fs.existsSync(absolute)) return []
  if (fs.statSync(absolute).isFile()) return [absolute]
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) =>
    listFiles(path.join(target, entry.name))
  )
}

const failures = []
const endpoints = new Set()
for (const endpoint of DASHBOARD_ENDPOINTS) {
  const identity = `${endpoint.method} ${endpoint.path}`
  if (endpoints.has(identity)) failures.push(`重复端点: ${identity}`)
  endpoints.add(identity)
}
if (DASHBOARD_ENDPOINTS.length !== 33) failures.push(`端点数量错误: ${DASHBOARD_ENDPOINTS.length}`)
if (DASHBOARD_ENDPOINTS.filter(({ method }) => method === 'GET').length !== 1) failures.push('GET 端点数量错误')
if (DASHBOARD_ENDPOINTS.filter(({ method }) => method === 'POST').length !== 32) failures.push('POST 端点数量错误')

for (const file of scanRoots.flatMap(listFiles)) {
  const source = fs.readFileSync(file, 'utf8')
  for (const host of forbiddenHosts) {
    if (source.toLowerCase().includes(host)) failures.push(`禁止主机: ${path.relative(root, file)}`)
  }
  for (const pattern of secretPatterns) {
    if (pattern.test(source)) failures.push(`疑似固定秘密: ${path.relative(root, file)}`)
  }
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('AGRO_ADMIN_VERIFY=PASS endpoints=33 post=32 get=1 forbiddenHosts=0 committedSecrets=0')
