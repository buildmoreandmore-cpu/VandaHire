// Admin API helper — uses PORTER_ADMIN_TOKEN stored in localStorage

const TOKEN_KEY = 'porter_admin_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

async function adminFetch(path, options = {}) {
  const token = getToken()
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  })

  if (res.status === 401) {
    clearToken()
    throw new Error('Unauthorized')
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed (${res.status})`)
  }

  return res.json()
}

// Stats
export const fetchStats = () => adminFetch('/api/admin/stats')

// Applicants
export const fetchApplicants = (status) =>
  adminFetch(`/api/admin/applicants${status ? `?status=${status}` : ''}`)

export const updateApplicant = (id, status) =>
  adminFetch('/api/admin/applicants', {
    method: 'PATCH',
    body: JSON.stringify({ id, status }),
  })

// Events
export const fetchEvents = (status) =>
  adminFetch(`/api/admin/events${status ? `?status=${status}` : ''}`)

export const updateEvent = (id, status) =>
  adminFetch('/api/admin/events', {
    method: 'PATCH',
    body: JSON.stringify({ id, status }),
  })

// Assignments
export const fetchAssignments = (params = {}) => {
  const qs = new URLSearchParams(params).toString()
  return adminFetch(`/api/admin/assignments${qs ? `?${qs}` : ''}`)
}

export const createAssignments = (event_id, worker_ids) =>
  adminFetch('/api/admin/assignments', {
    method: 'POST',
    body: JSON.stringify({ event_id, worker_ids }),
  })

export const updateAssignment = (id, status) =>
  adminFetch('/api/admin/assignments', {
    method: 'PATCH',
    body: JSON.stringify({ id, status }),
  })

export const deleteAssignment = (id) =>
  adminFetch('/api/admin/assignments', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  })
