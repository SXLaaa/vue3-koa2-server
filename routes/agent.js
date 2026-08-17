const router = require('koa-router')()
const util = require('../utils/utils')
const config = require('../config/agent')
const agentService = require('../services/agentService')
const modelClient = require('../services/modelClient')
const memoryStore = require('../services/memoryStore')
const trainingStore = require('../services/trainingStore')

router.prefix('/agent')

router.get('/health', async (ctx) => {
  ctx.body = util.success({
    status: 'ok',
    provider: config.PROVIDER,
    model: config.MODEL,
    port: config.PORT,
    dataDir: config.DATA_DIR
  })
})

router.get('/models', async (ctx) => {
  try {
    ctx.body = util.success(await modelClient.listModels())
  } catch (error) {
    ctx.body = util.fail(error.message)
  }
})

router.get('/stats', async (ctx) => {
  try {
    ctx.body = util.success(await trainingStore.getStats())
  } catch (error) {
    ctx.body = util.fail(error.message)
  }
})

router.get('/sessions', async (ctx) => {
  try {
    ctx.body = util.success(await memoryStore.listSessions(Number(ctx.request.query.limit || 30)))
  } catch (error) {
    ctx.body = util.fail(error.message)
  }
})

router.get('/sessions/:sessionId', async (ctx) => {
  try {
    ctx.body = util.success(await memoryStore.readSession(ctx.params.sessionId))
  } catch (error) {
    ctx.body = util.fail(error.message)
  }
})

router.delete('/sessions/:sessionId', async (ctx) => {
  try {
    ctx.body = util.success(await memoryStore.deleteSession(ctx.params.sessionId))
  } catch (error) {
    ctx.body = util.fail(error.message)
  }
})

router.post('/chat', async (ctx) => {
  try {
    ctx.body = util.success(await agentService.chat(ctx.request.body || {}))
  } catch (error) {
    ctx.body = util.fail(error.message)
  }
})

router.post('/teach', async (ctx) => {
  try {
    ctx.body = util.success(await trainingStore.addTrainingSample(ctx.request.body || {}))
  } catch (error) {
    ctx.body = util.fail(error.message)
  }
})

router.post('/feedback', async (ctx) => {
  try {
    ctx.body = util.success(await trainingStore.addFeedback(ctx.request.body || {}))
  } catch (error) {
    ctx.body = util.fail(error.message)
  }
})

router.post('/export', async (ctx) => {
  try {
    ctx.body = util.success(await trainingStore.exportSftDataset())
  } catch (error) {
    ctx.body = util.fail(error.message)
  }
})

module.exports = router
