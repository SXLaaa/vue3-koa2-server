const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const root = path.join(__dirname, '..')
const targets = [
  'app.js',
  'bin/www',
  'config/agro.js',
  'contracts/dashboardEndpoints.js',
  'db/postgres.js',
  'middleware/agroErrorBoundary.js',
  'middleware/sessionAuth.js',
  'config/agent.js',
  'routes/agroAdmin.js',
  'routes/agent.js',
  'repositories/postgresRepository.js',
  'repositories/spatialRepository.js',
  'services/authService.js',
  'services/captchaStore.js',
  'services/dashboardService.js',
  'services/agentService.js',
  'services/memoryStore.js',
  'services/modelClient.js',
  'services/trainingStore.js',
  'scripts/start-local.ps1',
  'scripts/stop-local.ps1',
  'scripts/verify-agro-admin.js',
  'test/trainingStore.test.js'
]

let failed = false
for (const target of targets) {
  const file = path.join(root, target)
  if (!fs.existsSync(file)) {
    console.error(`Missing file: ${target}`)
    failed = true
    continue
  }
  if (path.extname(file) === '.ps1') {
    console.log(`OK ${target}`)
    continue
  }
  const result = spawnSync(process.execPath, ['--check', file], { cwd: root, encoding: 'utf8' })
  if (result.status !== 0) {
    failed = true
    console.error(result.stderr || result.stdout)
  } else {
    console.log(`OK ${target}`)
  }
}

process.exit(failed ? 1 : 0)
