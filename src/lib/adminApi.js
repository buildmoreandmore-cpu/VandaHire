// Admin API helper — uses VANDA_ADMIN_TOKEN stored in localStorage

const TOKEN_KEY = 'vanda_admin_token'

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

export const updateApplicant = (id, status, video_verified) =>
  adminFetch('/api/admin/applicants', {
    method: 'PATCH',
    body: JSON.stringify({ id, status, ...(video_verified !== undefined && { video_verified }) }),
  })

// Events
export const fetchEvents = (status) =>
  adminFetch(`/api/admin/events${status ? `?status=${status}` : ''}`)

export const updateEvent = (id, fields) =>
  adminFetch('/api/admin/events', {
    method: 'PATCH',
    body: JSON.stringify({ id, ...fields }),
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

export const updateAssignment = (id, fields) =>
  adminFetch('/api/admin/assignments', {
    method: 'PATCH',
    body: JSON.stringify({ id, ...(typeof fields === 'string' ? { status: fields } : fields) }),
  })

export const deleteAssignment = (id) =>
  adminFetch('/api/admin/assignments', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  })

// Stripe — create checkout session for Vandahire service fee
export const createCheckoutSession = (event_id) =>
  adminFetch('/api/stripe/create-checkout', {
    method: 'POST',
    body: JSON.stringify({ event_id }),
  })

// Dispatch actions
export const sendShiftDetails = (assignmentId) =>
  adminFetch('/api/admin/send-shift', {
    method: 'POST',
    body: JSON.stringify({ assignment_id: assignmentId }),
  })

export const sendSurvey = (assignmentId) =>
  adminFetch('/api/admin/send-survey', {
    method: 'POST',
    body: JSON.stringify({ assignment_id: assignmentId }),
  })

export const fetchSurveys = () => adminFetch('/api/admin/surveys')

export const notifyWorkers = (eventId) =>
  adminFetch('/api/admin/notify-workers', {
    method: 'POST',
    body: JSON.stringify({ event_id: eventId }),
  })

export const fetchSuggestedWorkers = (eventId) =>
  adminFetch(`/api/admin/suggest-workers?event_id=${eventId}`)

// Bench pool
export const fetchBenchPool = (eventId) =>
  adminFetch(`/api/admin/bench?event_id=${eventId}`)

export const addToBench = (event_id, worker_ids, tier = 1, standby_fee = 25) =>
  adminFetch('/api/admin/bench', {
    method: 'POST',
    body: JSON.stringify({ event_id, worker_ids, tier, standby_fee }),
  })

export const updateBenchAssignment = (id, fields) =>
  adminFetch('/api/admin/bench', {
    method: 'PATCH',
    body: JSON.stringify({ id, ...fields }),
  })

export const removeBenchAssignment = (id) =>
  adminFetch('/api/admin/bench', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  })

export const triggerBenchDispatch = (event_id, tier) =>
  adminFetch('/api/admin/bench-dispatch', {
    method: 'POST',
    body: JSON.stringify({ event_id, tier }),
  })

// Quotes
export const fetchQuote = (eventId) =>
  adminFetch(`/api/admin/quotes?event_id=${eventId}`)

export const createQuote = (data) =>
  adminFetch('/api/admin/quotes', {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const updateQuote = (id, fields) =>
  adminFetch('/api/admin/quotes', {
    method: 'PATCH',
    body: JSON.stringify({ id, ...fields }),
  })

// Payments
export const fetchPayments = (eventId) =>
  adminFetch(`/api/admin/payments?event_id=${eventId}`)

export const createDepositLink = (eventId) =>
  adminFetch('/api/stripe/deposit', {
    method: 'POST',
    body: JSON.stringify({ event_id: eventId }),
  })

export const createBalanceLink = (eventId) =>
  adminFetch('/api/stripe/balance', {
    method: 'POST',
    body: JSON.stringify({ event_id: eventId }),
  })

// Exit records
export const fetchExitRecords = (params) =>
  adminFetch(`/api/admin/exit-records?${new URLSearchParams(params)}`)

export const updateExitRecord = (id, fields) =>
  adminFetch('/api/admin/exit-records', {
    method: 'PATCH',
    body: JSON.stringify({ id, ...fields }),
  })

// Cancellation
export const cancelEvent = (eventId, reason) =>
  adminFetch('/api/admin/cancellation', {
    method: 'POST',
    body: JSON.stringify({ event_id: eventId, reason }),
  })

// Payouts (Stripe Connect)
export const fetchPayouts = (eventId) =>
  adminFetch(`/api/admin/payouts?event_id=${eventId}`)

export const processPayouts = (eventId) =>
  adminFetch('/api/admin/payouts', {
    method: 'POST',
    body: JSON.stringify({ event_id: eventId }),
  })
