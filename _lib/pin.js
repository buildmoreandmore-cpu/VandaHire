import crypto from 'crypto'

const SALT = 'vandahire-pin-v1'
const MAX_ATTEMPTS = 5
const LOCKOUT_MINUTES = 15
const SESSION_EXPIRY_DAYS = 7

export function hashPin(pin) {
  return crypto.createHash('sha256').update(SALT + pin).digest('hex')
}

export function verifyPin(pin, hash) {
  return hashPin(pin) === hash
}

// Check if account is locked from too many attempts
export function isLocked(worker) {
  if (worker.pin_attempts < MAX_ATTEMPTS) return false
  if (!worker.pin_locked_until) return false
  return new Date(worker.pin_locked_until) > new Date()
}

// Generate a session token: base64(workerId:expiry:hmac)
export function createSession(workerId) {
  const secret = SALT + (process.env.SUPABASE_SERVICE_ROLE_KEY || '').slice(-16)
  const expiry = Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  const payload = `${workerId}:${expiry}`
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex').slice(0, 16)
  return Buffer.from(`${payload}:${hmac}`).toString('base64')
}

// Verify a session token, returns workerId or null
export function verifySession(token) {
  try {
    const decoded = Buffer.from(token, 'base64').toString()
    const [workerId, expiry, hmac] = decoded.split(':')
    if (Date.now() > parseInt(expiry)) return null
    const secret = SALT + (process.env.SUPABASE_SERVICE_ROLE_KEY || '').slice(-16)
    const expected = crypto.createHmac('sha256', secret).update(`${workerId}:${expiry}`).digest('hex').slice(0, 16)
    if (hmac !== expected) return null
    return workerId
  } catch {
    return null
  }
}

export { MAX_ATTEMPTS, LOCKOUT_MINUTES }
