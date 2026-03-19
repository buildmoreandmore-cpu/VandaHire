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
