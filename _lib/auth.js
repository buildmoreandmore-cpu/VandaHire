// Shared admin auth check for all admin API routes
export function checkAdmin(req) {
  const adminToken = process.env.VANDA_ADMIN_TOKEN
  if (!adminToken) {
    return { ok: false, status: 500, error: 'Admin not configured' }
  }
  const auth = req.headers.authorization
  if (!auth || auth !== `Bearer ${adminToken}`) {
    return { ok: false, status: 401, error: 'Unauthorized' }
  }
  return { ok: true }
}
