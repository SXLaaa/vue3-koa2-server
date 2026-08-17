const config = require('../config/agent')
const modelClient = require('./modelClient')
const memoryStore = require('./memoryStore')
const trainingStore = require('./trainingStore')

function normalizeText(value, fieldName) {
  const text = String(value || '').trim()
  if (!text) {
    throw new Error(`${fieldName}不能为空`)
  }
  return text
}

function buildSystemPrompt(extraPrompt) {
  return [config.SYSTEM_PROMPT, extraPrompt && String(extraPrompt).trim()].filter(Boolean).join('\n\n')
}

async function chat(body) {
  const message = normalizeText(body.message, 'message')
  const sessionId = body.sessionId || memoryStore.createSessionId()
  const model = body.model || config.MODEL
  const historyLimit = Math.min(Math.max(Number(body.historyLimit) || 12, 1), 40)
  const history = await memoryStore.readSession(sessionId, historyLimit)
  const messages = [
    { role: 'system', content: buildSystemPrompt(body.systemPrompt) },
    ...history.messages.map((item) => ({ role: item.role, content: item.content }))
  ]

  if (body.useKnowledge !== false) {
    const knowledgeLimit = Math.min(Math.max(Number(body.knowledgeLimit) || 3, 1), 8)
    const samples = await trainingStore.findRelevantSamples(message, knowledgeLimit)
    if (samples.length) {
      messages.push({
        role: 'system',
        content: `以下是用户人工确认过的本地知识。仅在与当前问题相关时参考，优先遵循其中的正确答案：\n${samples
          .map((item, index) => `${index + 1}. 问题：${item.instruction || item.message}\n答案：${item.output || item.correction}`)
          .join('\n\n')}`
      })
    }
  }

  if (Array.isArray(body.context) && body.context.length) {
    messages.splice(1, 0, { role: 'system', content: `可参考的上下文：\n${body.context.map(String).join('\n\n')}` })
  }

  messages.push({ role: 'user', content: message })
  const reply = await modelClient.chat({ messages, model, temperature: body.temperature })

  await memoryStore.appendMessage(sessionId, { role: 'user', content: message, model })
  const assistantMessage = await memoryStore.appendMessage(sessionId, { role: 'assistant', content: reply, model })

  if (body.saveForTraining) {
    await trainingStore.addTrainingSample({
      instruction: message,
      input: Array.isArray(body.context) ? body.context.join('\n\n') : '',
      output: reply,
      tags: ['chat-auto'],
      source: 'chat',
      sessionId
    })
  }

  return { sessionId, messageId: assistantMessage.id, model, reply }
}

module.exports = { chat }
