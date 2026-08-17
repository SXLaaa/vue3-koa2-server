const fs = require('fs/promises')
const path = require('path')
const crypto = require('crypto')
const config = require('../config/agent')

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true })
}

function createId() {
  return crypto.randomBytes(6).toString('hex')
}

function createSessionId() {
  const now = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  return `${now}-${createId()}`
}

function sessionFile(sessionId) {
  const safeName = String(sessionId || '').replace(/[^\w.-]/g, '_')
  if (!safeName) {
    throw new Error('sessionId不能为空')
  }
  return path.join(config.SESSION_DIR, `${safeName}.jsonl`)
}

async function appendJsonLine(file, data) {
  await ensureDir(path.dirname(file))
  await fs.appendFile(file, `${JSON.stringify(data)}\n`, 'utf8')
}

async function readJsonLines(file) {
  try {
    const raw = await fs.readFile(file, 'utf8')
    return raw.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line))
  } catch (error) {
    if (error.code === 'ENOENT') {
      return []
    }
    throw error
  }
}

async function appendMessage(sessionId, message) {
  const item = {
    id: createId(),
    sessionId,
    role: message.role,
    content: message.content,
    model: message.model || config.MODEL,
    createdAt: new Date().toISOString()
  }
  await appendJsonLine(sessionFile(sessionId), item)
  return item
}

async function readSession(sessionId, limit) {
  const messages = await readJsonLines(sessionFile(sessionId))
  return {
    sessionId,
    messages: limit ? messages.slice(-Math.max(Number(limit), 1)) : messages,
    total: messages.length
  }
}

async function listSessions(limit = 30) {
  await ensureDir(config.SESSION_DIR)
  const files = await fs.readdir(config.SESSION_DIR)
  const rows = []

  for (const file of files.filter((name) => name.endsWith('.jsonl'))) {
    const fullPath = path.join(config.SESSION_DIR, file)
    const stat = await fs.stat(fullPath)
    const messages = await readJsonLines(fullPath)
    const firstUserMessage = messages.find((item) => item.role === 'user')
    rows.push({
      sessionId: path.basename(file, '.jsonl'),
      updatedAt: stat.mtime.toISOString(),
      size: stat.size,
      title: firstUserMessage ? firstUserMessage.content.slice(0, 40) : '新会话',
      messageCount: messages.length
    })
  }

  rows.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  return rows.slice(0, Math.max(Number(limit), 1))
}

async function deleteSession(sessionId) {
  const file = sessionFile(sessionId)
  try {
    await fs.unlink(file)
    return { sessionId, deleted: true }
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { sessionId, deleted: false }
    }
    throw error
  }
}

module.exports = {
  createSessionId,
  appendMessage,
  readSession,
  listSessions,
  readJsonLines,
  appendJsonLine,
  ensureDir,
  deleteSession
}
