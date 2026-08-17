const config = require('../config/agent')

function withTimeout(ms) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return { signal: controller.signal, done: () => clearTimeout(timer) }
}

async function requestJson(url, options) {
  const timeout = withTimeout(config.TIMEOUT)
  try {
    const response = await fetch(url, { ...options, signal: timeout.signal })
    if (!response.ok) {
      const detail = await response.text()
      throw new Error(`HTTP ${response.status} ${response.statusText}${detail ? `: ${detail}` : ''}`)
    }
    return await response.json()
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`模型请求超时：${config.TIMEOUT}ms`)
    }
    throw new Error(`无法连接模型服务：${url}；${error.message}`)
  } finally {
    timeout.done()
  }
}

async function chatWithOllama({ messages, model, temperature }) {
  const data = await requestJson(`${config.BASE_URL.replace(/\/$/, '')}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model || config.MODEL,
      messages,
      stream: false,
      options: { temperature: Number.isFinite(Number(temperature)) ? Number(temperature) : config.TEMPERATURE }
    })
  })
  if (!data.message || typeof data.message.content !== 'string') {
    throw new Error(`模型响应格式异常：${JSON.stringify(data).slice(0, 500)}`)
  }
  return data.message.content
}

async function chatWithOpenAICompatible({ messages, model, temperature }) {
  const data = await requestJson(`${config.OPENAI_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.API_KEY || 'ollama'}` },
    body: JSON.stringify({
      model: model || config.MODEL,
      messages,
      temperature: Number.isFinite(Number(temperature)) ? Number(temperature) : config.TEMPERATURE,
      stream: false
    })
  })
  const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
  if (typeof content !== 'string') {
    throw new Error(`模型响应格式异常：${JSON.stringify(data).slice(0, 500)}`)
  }
  return content
}

async function chat(params) {
  return config.PROVIDER === 'openai-compatible' ? chatWithOpenAICompatible(params) : chatWithOllama(params)
}

async function listModels() {
  if (config.PROVIDER === 'openai-compatible') {
    const data = await requestJson(`${config.OPENAI_BASE_URL.replace(/\/$/, '')}/models`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${config.API_KEY || 'ollama'}` }
    })
    return { provider: 'openai-compatible', models: data.data || [] }
  }

  const data = await requestJson(`${config.BASE_URL.replace(/\/$/, '')}/api/tags`, { method: 'GET' })
  return {
    provider: 'ollama',
    models: (data.models || []).map((item) => ({ name: item.name, size: item.size, modifiedAt: item.modified_at }))
  }
}

module.exports = { chat, listModels }
