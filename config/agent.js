const path = require('path')

const dataDir = process.env.AGENT_DATA_DIR
  ? path.resolve(process.env.AGENT_DATA_DIR)
  : path.join(__dirname, '..', 'data', 'agent')

module.exports = {
  PORT: process.env.PORT || '3000',
  PROVIDER: process.env.AGENT_PROVIDER || 'ollama',
  BASE_URL: process.env.AGENT_BASE_URL || 'http://127.0.0.1:11434',
  OPENAI_BASE_URL: process.env.AGENT_OPENAI_BASE_URL || 'http://127.0.0.1:11434/v1',
  API_KEY: process.env.AGENT_API_KEY || '',
  MODEL: process.env.AGENT_MODEL || 'qwen2.5-coder:7b',
  TIMEOUT: Number(process.env.AGENT_TIMEOUT || 120000),
  TEMPERATURE: Number(process.env.AGENT_TEMPERATURE || 0.2),
  SYSTEM_PROMPT: process.env.AGENT_SYSTEM_PROMPT || '你是运行在用户电脑上的本地智能体，回答要简洁、准确，并优先使用中文。',
  DATA_DIR: dataDir,
  SESSION_DIR: path.join(dataDir, 'sessions'),
  EXPORT_DIR: path.join(dataDir, 'exports'),
  TRAINING_FILE: path.join(dataDir, 'training.jsonl'),
  FEEDBACK_FILE: path.join(dataDir, 'feedback.jsonl')
}
