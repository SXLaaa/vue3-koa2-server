const crypto = require('crypto')

class AuthenticationError extends Error {
  constructor(message, code = 'AUTHENTICATION_FAILED') {
    super(message)
    this.name = 'AuthenticationError'
    this.code = code
  }
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const digest = crypto.scryptSync(String(password), salt, 64).toString('hex')
  return `scrypt$${salt}$${digest}`
}

function verifyPassword(password, encodedHash) {
  const [algorithm, salt, expectedHex] = String(encodedHash || '').split('$')
  if (algorithm !== 'scrypt' || !salt || !/^[a-f0-9]{128}$/i.test(expectedHex || '')) return false
  const actual = crypto.scryptSync(String(password), salt, 64)
  const expected = Buffer.from(expectedHex, 'hex')
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function sign(encodedPayload, secret) {
  return crypto.createHmac('sha256', secret).update(encodedPayload).digest('base64url')
}

/**
 * 认证服务集中处理验证码、口令和可撤销会话，不在日志或返回体中暴露口令散列。
 */
function createAuthService({
  userRepository,
  captchaStore,
  sessionSecret,
  sessionTtlSeconds = 8 * 60 * 60,
  now = () => Date.now()
}) {
  if (!userRepository || typeof userRepository.findUserByUsername !== 'function') {
    throw new Error('userRepository.findUserByUsername is required')
  }
  if (!captchaStore || typeof captchaStore.consume !== 'function') {
    throw new Error('captchaStore.consume is required')
  }
  if (typeof sessionSecret !== 'string' || sessionSecret.length < 32) {
    throw new Error('AUTH_SESSION_SECRET must contain at least 32 characters')
  }
  if (!Number.isInteger(sessionTtlSeconds) || sessionTtlSeconds <= 0) {
    throw new Error('sessionTtlSeconds must be a positive integer')
  }
  const revokedSessions = new Map()

  function purgeRevoked() {
    const currentSeconds = Math.floor(now() / 1000)
    for (const [sessionId, expiresAt] of revokedSessions) {
      if (expiresAt <= currentSeconds) revokedSessions.delete(sessionId)
    }
  }

  function issueSession(user) {
    const issuedAt = Math.floor(now() / 1000)
    const payload = {
      sub: String(user.id),
      username: user.username,
      displayName: user.displayName || user.username,
      sid: crypto.randomUUID(),
      iat: issuedAt,
      exp: issuedAt + sessionTtlSeconds
    }
    const encodedPayload = encode(payload)
    return `${encodedPayload}.${sign(encodedPayload, sessionSecret)}`
  }

  function verifySession(token) {
    purgeRevoked()
    const [encodedPayload, signature, extra] = String(token || '').split('.')
    if (!encodedPayload || !signature || extra) throw new AuthenticationError('无效会话', 'INVALID_SESSION')
    const expectedSignature = sign(encodedPayload, sessionSecret)
    const actual = Buffer.from(signature)
    const expected = Buffer.from(expectedSignature)
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
      throw new AuthenticationError('无效会话', 'INVALID_SESSION')
    }
    let payload
    try {
      payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'))
    } catch {
      throw new AuthenticationError('无效会话', 'INVALID_SESSION')
    }
    const currentSeconds = Math.floor(now() / 1000)
    if (!payload.sid || !payload.exp || payload.exp <= currentSeconds) {
      throw new AuthenticationError('会话已过期', 'SESSION_EXPIRED')
    }
    if (revokedSessions.has(payload.sid)) {
      throw new AuthenticationError('会话已失效', 'SESSION_REVOKED')
    }
    return payload
  }

  return {
    async login({ username, password, code, uuid } = {}) {
      if (![username, password, code, uuid].every((value) => typeof value === 'string' && value.trim())) {
        throw new AuthenticationError('用户名、密码和验证码不能为空', 'INVALID_LOGIN_REQUEST')
      }
      if (!captchaStore.consume(uuid, code)) {
        throw new AuthenticationError('验证码错误或已过期', 'INVALID_CAPTCHA')
      }
      const user = await userRepository.findUserByUsername(username.trim())
      if (!user || user.status === 0 || !verifyPassword(password, user.passwordHash)) {
        throw new AuthenticationError('用户名或密码错误', 'INVALID_CREDENTIALS')
      }
      return { token: issueSession(user) }
    },

    verifySession,

    logout(token) {
      const payload = verifySession(token)
      revokedSessions.set(payload.sid, payload.exp)
      return true
    }
  }
}

module.exports = { AuthenticationError, createAuthService, hashPassword, verifyPassword }
