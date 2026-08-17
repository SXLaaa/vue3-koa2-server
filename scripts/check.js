const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const root = path.join(__dirname, '..')
const targets = [
  'app.js',
  'bin/www',
  'config/agent.js',
  'routes/agent.js',
  'services/agentService.js',
  'services/memoryStore.js',
  'services/modelClient.js',
  'services/trainingStore.js',
  'scripts/start-local.ps1',
  'scripts/stop-local.ps1',
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
