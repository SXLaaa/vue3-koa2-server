const fs = require('fs/promises')
const path = require('path')
const config = require('../config/agent')
const memoryStore = require('./memoryStore')

function requiredText(value, fieldName) {
  const text = String(value || '').trim()
  if (!text) {
    throw new Error(`${fieldName}不能为空`)
  }
  return text
}

function normalizeTags(tags) {
  return Array.isArray(tags) ? tags.map(String).filter(Boolean) : []
}

function tokenize(value) {
  const parts = String(value || '').toLowerCase().match(/[a-z0-9_+-]+|[\u4e00-\u9fff]+/g) || []
  const tokens = []

  for (const part of parts) {
    if (!/^[\u4e00-\u9fff]+$/.test(part) || part.length === 1) {
      tokens.push(part)
      continue
    }
    for (let index = 0; index < part.length - 1; index += 1) {
      tokens.push(part.slice(index, index + 2))
    }
  }
  return new Set(tokens)
}

function relevanceScore(queryTokens, sample) {
  const searchable = [sample.instruction, sample.input, sample.message, ...(sample.tags || [])].join(' ')
  const sampleTokens = tokenize(searchable)
  let matched = 0
  for (const token of queryTokens) {
    if (sampleTokens.has(token)) {
      matched += token.length > 1 ? 2 : 1
    }
  }
  return matched
}

async function addTrainingSample(body) {
  const item = {
    instruction: requiredText(body.instruction, 'instruction'),
    input: String(body.input || ''),
    output: requiredText(body.output, 'output'),
    tags: normalizeTags(body.tags),
    source: body.source || 'manual',
    sessionId: body.sessionId || '',
    createdAt: new Date().toISOString()
  }
  await memoryStore.appendJsonLine(config.TRAINING_FILE, item)
  return item
}

async function addFeedback(body) {
  const item = {
    sessionId: body.sessionId || '',
    message: requiredText(body.message, 'message'),
    answer: String(body.answer || ''),
    score: Number(body.score || 0),
    correction: String(body.correction || ''),
    tags: normalizeTags(body.tags),
    createdAt: new Date().toISOString()
  }
  await memoryStore.appendJsonLine(config.FEEDBACK_FILE, item)
  return item
}

async function findRelevantSamples(query, limit = 3) {
  const queryTokens = tokenize(query)
  if (!queryTokens.size) {
    return []
  }
  const [samples, feedback] = await Promise.all([
    memoryStore.readJsonLines(config.TRAINING_FILE),
    memoryStore.readJsonLines(config.FEEDBACK_FILE)
  ])
  const corrected = feedback.filter((item) => item.correction).map((item) => ({
    instruction: item.message,
    input: item.answer ? `模型原回答：${item.answer}` : '',
    output: item.correction,
    tags: item.tags || [],
    source: 'feedback'
  }))
  return [...samples, ...corrected]
    .map((item) => ({ ...item, score: relevanceScore(queryTokens, item) }))
    .filter((item) => item.score > 0 && item.output)
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(Number(limit) || 1, 1))
    .map(({ score, ...item }) => item)
}

async function getStats() {
  const [samples, feedback, sessions] = await Promise.all([
    memoryStore.readJsonLines(config.TRAINING_FILE),
    memoryStore.readJsonLines(config.FEEDBACK_FILE),
    memoryStore.listSessions(Number.MAX_SAFE_INTEGER)
  ])
  return {
    trainingSamples: samples.length,
    feedback: feedback.length,
    correctedFeedback: feedback.filter((item) => item.correction).length,
    sessions: sessions.length
  }
}

async function exportSftDataset() {
  await memoryStore.ensureDir(config.EXPORT_DIR)
  const [samples, feedback] = await Promise.all([
    memoryStore.readJsonLines(config.TRAINING_FILE),
    memoryStore.readJsonLines(config.FEEDBACK_FILE)
  ])
  const corrected = feedback.filter((item) => item.correction).map((item) => ({
    instruction: item.message,
    input: item.answer ? `模型原回答：${item.answer}` : '',
    output: item.correction
  }))
  const rows = [...samples, ...corrected]
    .map((item) => ({
      instruction: item.instruction || item.message || '',
      input: item.input || '',
      output: item.output || item.correction || ''
    }))
    .filter((item) => item.instruction && item.output)
  const name = `sft-${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}.jsonl`
  const file = path.join(config.EXPORT_DIR, name)
  await fs.writeFile(file, rows.map((item) => JSON.stringify(item)).join('\n') + (rows.length ? '\n' : ''), 'utf8')
  return { file, count: rows.length }
}

module.exports = {
  addTrainingSample,
  addFeedback,
  exportSftDataset,
  findRelevantSamples,
  getStats,
  tokenize,
  relevanceScore
}
