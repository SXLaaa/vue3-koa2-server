const crypto = require('crypto')

function defaultCodeGenerator() {
  return String(crypto.randomInt(0, 10_000)).padStart(4, '0')
}

function renderCaptcha(code) {
  const escaped = code.replace(/[&<>"']/g, (value) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
  })[value])
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><rect width="100%" height="100%" fill="#eef6f7"/><text x="15" y="28" font-size="24" font-family="monospace" fill="#17464b" letter-spacing="8">${escaped}</text></svg>`
  return Buffer.from(svg).toString('base64')
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left).trim().toLowerCase())
  const rightBuffer = Buffer.from(String(right).trim().toLowerCase())
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

/**
 * 创建进程内一次性验证码仓库。验证码只保存到过期或首次校验，避免被重复使用。
 */
function createCaptchaStore({
  codeGenerator = defaultCodeGenerator,
  ttlMs = 2 * 60 * 1000,
  now = Date.now
} = {}) {
  if (!Number.isInteger(ttlMs) || ttlMs <= 0) throw new Error('captcha ttlMs must be a positive integer')
  const entries = new Map()

  function purgeExpired() {
    const current = now()
    for (const [uuid, entry] of entries) {
      if (entry.expiresAt <= current) entries.delete(uuid)
    }
  }

  return {
    issue() {
      purgeExpired()
      const code = String(codeGenerator())
      const uuid = crypto.randomUUID()
      entries.set(uuid, { code, expiresAt: now() + ttlMs })
      return { uuid, img: renderCaptcha(code), captchaEnabled: true }
    },

    consume(uuid, submittedCode) {
      purgeExpired()
      const entry = entries.get(String(uuid || ''))
      if (!entry) return false
      entries.delete(String(uuid))
      return safeEqual(entry.code, submittedCode || '')
    }
  }
}

module.exports = { createCaptchaStore }
