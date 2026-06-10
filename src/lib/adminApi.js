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

// Notifications
export const fetchNotifications = () => adminFetch('/api/admin/notifications')

// Applicants
export const fetchApplicants = (status) =>
  adminFetch(`/api/admin/applicants${status ? `?status=${status}` : ''}`)

export const updateApplicant = (id, status, video_verified) =>
  adminFetch('/api/admin/applicants', {
    method: 'PATCH',
    body: JSON.stringify({ id, status, ...(video_verified !== undefined && { video_verified }) }),
  })

export const editApplicant = (id, fields) =>
  adminFetch('/api/admin/applicants', {
    method: 'PATCH',
    body: JSON.stringify({ id, ...fields }),
  })

export const deleteApplicant = (id) =>
  adminFetch('/api/admin/applicants', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  })

// Events
export const fetchEvents = (status) =>
  adminFetch(`/api/admin/events${status ? `?status=${status}` : ''}`)

export const updateEvent = (id, fields) =>
  adminFetch('/api/admin/events', {
    method: 'PATCH',
    body: JSON.stringify({ id, ...fields }),
  })

export const deleteEvent = (id) =>
  adminFetch('/api/admin/events', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
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
export const fetchEventReviews = (eventId) => adminFetch(`/api/admin/surveys?event_id=${eventId}`)

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

// Bulk status change (Feature 2)
export const bulkUpdateStatus = (worker_ids, status) =>
  adminFetch('/api/admin/bulk-status', {
    method: 'POST',
    body: JSON.stringify({ worker_ids, status }),
  })

// Batch send shift details (Feature 3)
export const batchSendShifts = (event_id) =>
  adminFetch('/api/admin/batch-shift', {
    method: 'POST',
    body: JSON.stringify({ event_id }),
  })

// Event cloning (Feature 4)
export const cloneEvent = (event_id) =>
  adminFetch('/api/admin/clone-event', {
    method: 'POST',
    body: JSON.stringify({ event_id }),
  })

// Batch send surveys (Feature 8)
export const batchSendSurveys = (event_id) =>
  adminFetch('/api/admin/batch-survey', {
    method: 'POST',
    body: JSON.stringify({ event_id }),
  })

// Send message from admin (Feature 10)
export const sendAdminMessage = (worker_id, message, channel = 'both') =>
  adminFetch('/api/admin/send-message', {
    method: 'POST',
    body: JSON.stringify({ worker_id, message, channel }),
  })

// Event templates (Feature 11)
export const fetchTemplates = () => adminFetch('/api/admin/templates')

export const createTemplate = (data) =>
  adminFetch('/api/admin/templates', {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const deleteTemplate = (id) =>
  adminFetch('/api/admin/templates', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  })

// Create event from template (Feature 11)
export const createEvent = (data) =>
  adminFetch('/api/admin/events', {
    method: 'POST',
    body: JSON.stringify(data),
  })

// Incidents (Feature 12)
export const fetchIncidents = (event_id) =>
  adminFetch(`/api/admin/incidents${event_id ? `?event_id=${event_id}` : ''}`)

export const updateIncident = (id, resolved) =>
  adminFetch('/api/admin/incidents', {
    method: 'PATCH',
    body: JSON.stringify({ id, resolved }),
  })

// Worker PIN reset (Feature 13)
export const resetWorkerPin = (worker_id) =>
  adminFetch('/api/admin/reset-pin', {
    method: 'POST',
    body: JSON.stringify({ worker_id }),
  })

// Worker Groups
export const fetchGroups = (type) =>
  adminFetch(`/api/admin/groups${type ? `?type=${type}` : ''}`)

export const createGroup = (data) =>
  adminFetch('/api/admin/groups', {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const updateGroup = (id, fields) =>
  adminFetch('/api/admin/groups', {
    method: 'PATCH',
    body: JSON.stringify({ id, ...fields }),
  })

export const deleteGroup = (id) =>
  adminFetch('/api/admin/groups', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  })

export const fetchGroupMembers = (group_id) =>
  adminFetch(`/api/admin/group-members?group_id=${group_id}`)

export const updateGroupMembers = (group_id, worker_ids, action) =>
  adminFetch('/api/admin/group-members', {
    method: 'POST',
    body: JSON.stringify({ group_id, worker_ids, action }),
  })

// Manually activate/deactivate geofence for an event (emails workers on activate)
export const toggleGeofence = (event_id, active) =>
  adminFetch('/api/admin/geofence-toggle', { method: 'POST', body: JSON.stringify({ event_id, active }) })

// Live geofence status for an event (who is inside / outside)
export const fetchGeofenceStatus = (event_id) =>
  adminFetch(`/api/admin/geofence-status?event_id=${encodeURIComponent(event_id)}`)

// Run automations now (admin-triggered cron batch)
export const runCron = (job = 'all') =>
  adminFetch('/api/admin/run-cron', { method: 'POST', body: JSON.stringify({ job }) })

// Scheduled messages
export const fetchScheduledMessages = () => adminFetch('/api/admin/scheduled-messages')
export const createScheduledMessage = (worker_ids, message, channel, subject, send_at) =>
  adminFetch('/api/admin/scheduled-messages', { method: 'POST', body: JSON.stringify({ worker_ids, message, channel, subject, send_at }) })
export const cancelScheduledMessage = (id) =>
  adminFetch('/api/admin/scheduled-messages', { method: 'DELETE', body: JSON.stringify({ id }) })

// Email campaigns + resend to non-openers
export const fetchCampaigns = () => adminFetch('/api/admin/campaigns')
export const resendUnopened = (campaign_id) =>
  adminFetch('/api/admin/resend-unopened', { method: 'POST', body: JSON.stringify({ campaign_id }) })

// Saved segments (worker filter presets)
export const fetchSegments = () => adminFetch('/api/admin/segments')
export const createSegment = (name, filters) =>
  adminFetch('/api/admin/segments', { method: 'POST', body: JSON.stringify({ name, filters }) })
export const deleteSegment = (id) =>
  adminFetch('/api/admin/segments', { method: 'DELETE', body: JSON.stringify({ id }) })

// Message templates (reusable snippets)
export const fetchMessageTemplates = () => adminFetch('/api/admin/message-templates')
export const createMessageTemplate = (data) =>
  adminFetch('/api/admin/message-templates', { method: 'POST', body: JSON.stringify(data) })
export const deleteMessageTemplate = (id) =>
  adminFetch('/api/admin/message-templates', { method: 'DELETE', body: JSON.stringify({ id }) })

// Bulk message to many selected workers
export const bulkMessage = (worker_ids, message, channel = 'both', subject) =>
  adminFetch('/api/admin/bulk-message', {
    method: 'POST',
    body: JSON.stringify({ worker_ids, message, channel, subject }),
  })

// Applicant notes (contact log)
export const fetchApplicantNotes = (applicant_id) =>
  adminFetch(`/api/admin/applicant-notes?applicant_id=${encodeURIComponent(applicant_id)}`)

export const createApplicantNote = (applicant_id, author, note) =>
  adminFetch('/api/admin/applicant-notes', {
    method: 'POST',
    body: JSON.stringify({ applicant_id, author, note }),
  })

export const deleteApplicantNote = (id) =>
  adminFetch('/api/admin/applicant-notes', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  })

// Coordinator-side ID upload (when a worker can't upload themselves)
export const adminUploadId = (worker_id, photo_base64) =>
  adminFetch('/api/admin/upload-id', {
    method: 'POST',
    body: JSON.stringify({ worker_id, photo_base64 }),
  })

// W-9 viewer / export
export const fetchW9s = (signedOnly = false) =>
  adminFetch(`/api/admin/w9s${signedOnly ? '?signed_only=1' : ''}`)

async function downloadCsv(path, fallbackName) {
  const token = getToken()
  const res = await fetch(path, { headers: { 'Authorization': `Bearer ${token}` } })
  if (!res.ok) throw new Error(`Export failed (${res.status})`)
  const blob = await res.blob()
  const cd = res.headers.get('content-disposition') || ''
  const m = cd.match(/filename="([^"]+)"/)
  const filename = m ? m[1] : fallbackName
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function downloadW9Csv() {
  return downloadCsv('/api/admin/w9s?export=csv', `w9-export-${new Date().toISOString().slice(0, 10)}.csv`)
}

export function downloadWorkersCsv(status) {
  const qs = status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : ''
  return downloadCsv(`/api/admin/workers-export${qs}`, `workers-export-${new Date().toISOString().slice(0, 10)}.csv`)
}
