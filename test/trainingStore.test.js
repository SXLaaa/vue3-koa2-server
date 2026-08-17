const test = require('node:test')
const assert = require('node:assert/strict')
const trainingStore = require('../services/trainingStore')

test('tokenize supports Chinese bigrams and English words', () => {
  const tokens = trainingStore.tokenize('前端 Vue 启动 Agent_API')
  assert.equal(tokens.has('前端'), true)
  assert.equal(tokens.has('启动'), true)
  assert.equal(tokens.has('vue'), true)
  assert.equal(tokens.has('agent_api'), true)
  assert.equal(tokens.has('端启'), false)
})

test('relevanceScore prefers samples matching the question', () => {
  const query = trainingStore.tokenize('前端项目怎么启动')
  const matched = trainingStore.relevanceScore(query, {
    instruction: '如何启动前端项目',
    output: 'npm run dev'
  })
  const unrelated = trainingStore.relevanceScore(query, {
    instruction: '如何导出训练集',
    output: '调用 export 接口'
  })
  assert.ok(matched > unrelated)
  assert.ok(matched > 0)
})
