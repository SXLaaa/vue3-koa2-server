import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'

export const PSQL_ENVIRONMENT_VARIABLE = 'MAIN_GRAIN_PSQL'

function pathEntries(env, platform) {
  const value = env.PATH ?? env.Path ?? env.path ?? ''
  return value.split(platform === 'win32' ? ';' : ':').map((entry) => entry.trim()).filter(Boolean)
}

function windowsInstallRoots(env) {
  return [...new Set([
    env.ProgramFiles,
    env['ProgramFiles(x86)'],
    'C:\\Program Files',
    'C:\\Program Files (x86)',
  ].filter(Boolean))]
}

function versionDirectories(postgresqlRoot) {
  try {
    return readdirSync(postgresqlRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }))
  } catch {
    return []
  }
}

// 统一 psql 解析顺序，避免 Windows 已安装 PostgreSQL 但 PATH 未配置时误报缺失。
export function resolvePsqlExecutable({ env = process.env, platform = process.platform } = {}) {
  const explicit = env[PSQL_ENVIRONMENT_VARIABLE]?.trim()
  if (explicit) return { executable: path.resolve(explicit), source: 'environment' }

  const executableName = platform === 'win32' ? 'psql.exe' : 'psql'
  for (const directory of pathEntries(env, platform)) {
    const candidate = path.join(directory, executableName)
    if (existsSync(candidate)) return { executable: candidate, source: 'path' }
  }

  if (platform === 'win32') {
    for (const programFiles of windowsInstallRoots(env)) {
      const postgresqlRoot = path.join(programFiles, 'PostgreSQL')
      for (const version of versionDirectories(postgresqlRoot)) {
        const candidate = path.join(postgresqlRoot, version, 'bin', 'psql.exe')
        if (existsSync(candidate)) return { executable: candidate, source: 'windows-standard' }
      }
    }
  }

  return { executable: null, source: 'not-found' }
}

export function requirePsqlExecutable(options) {
  const resolution = resolvePsqlExecutable(options)
  if (!resolution.executable) {
    throw new Error(`找不到 psql；请设置 ${PSQL_ENVIRONMENT_VARIABLE}，或将 PostgreSQL bin 目录加入 PATH`)
  }
  return resolution
}
