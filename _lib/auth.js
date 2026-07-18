// Shared admin auth check for all admin API routes
// Supports multiple comma-separated tokens in VANDA_ADMIN_TOKEN
export function checkAdmin(req) {
  const raw = process.env.VANDA_ADMIN_TOKEN
  if (!raw) {
    return { ok: false, status: 500, error: 'Admin not configured' }
  }
  const tokens = raw.split(',').map(t => t.trim())
  const auth = req.headers.authorization
  if (!auth || !tokens.some(t => auth === `Bearer ${t}`)) {
    return { ok: false, status: 401, error: 'Unauthorized' }
  }
  return { ok: true }
}

// Supervisor auth. SUPERVISOR_LOGINS is a JSON array of
// { passcode, name, number } — each supervisor is scoped to their send-from line.
// Returns { ok, supervisor: { name, number } } or a 401.
export function getSupervisors() {
  try { return JSON.parse(process.env.SUPERVISOR_LOGINS || '[]') } catch { return [] }
}

export function checkSupervisor(req) {
  const auth = req.headers.authorization || ''
  const passcode = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!passcode) return { ok: false, status: 401, error: 'Unauthorized' }
  const sup = getSupervisors().find(s => s.passcode && s.passcode === passcode)
  if (!sup) return { ok: false, status: 401, error: 'Unauthorized' }
  return { ok: true, supervisor: { name: sup.name, number: sup.number } }
}
