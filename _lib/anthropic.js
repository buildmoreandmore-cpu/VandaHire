// Claude Vision — transcribe a handwritten V&A timesheet photo into structured JSON.

const MODEL = 'claude-sonnet-5'

// Call the Anthropic API with one automatic retry on transient failures
// (429/500/502/503/529 or network error) so a hiccup never forces a restart.
async function anthropicCall(body) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY not configured')
  let lastErr
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) return res.json()
      const status = res.status
      const text = (await res.text().catch(() => '')).slice(0, 300)
      // Retry only transient statuses; fail fast on 4xx like bad key / bad image.
      if (attempt === 0 && [429, 500, 502, 503, 529].includes(status)) { lastErr = new Error(`Claude API ${status}: ${text}`); await new Promise(r => setTimeout(r, 1200)); continue }
      throw new Error(`Claude API ${status}: ${text}`)
    } catch (e) {
      lastErr = e
      if (attempt === 0) { await new Promise(r => setTimeout(r, 1200)); continue }
      throw e
    }
  }
  throw lastErr
}

const SYSTEM = `You transcribe handwritten event-staffing timesheets into structured data.
The sheet has a header (Company, Event, Date) and a table with columns:
#, Name, Start Time, End Time, Total Hours. There may be a company/associate signature
and a grand total at the bottom. Transcribe EXACTLY what is written — do not invent rows,
do not guess names you cannot read (use your best reading and set "unclear": true on that row).
Times should be normalized to "H:MM AM/PM". If Total Hours is blank but start/end are present,
compute it. Return ONLY the tool call.`

const TOOL = {
  name: 'record_timesheet',
  description: 'Record the transcribed timesheet.',
  input_schema: {
    type: 'object',
    properties: {
      company: { type: 'string', description: 'Company/client name from header (e.g. "Venue Smart")' },
      event: { type: 'string', description: 'Event name from header' },
      date: { type: 'string', description: 'Event date as written (e.g. "July 24, 2026")' },
      rows: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            start_time: { type: 'string' },
            end_time: { type: 'string' },
            total_hours: { type: 'number' },
            unclear: { type: 'boolean', description: 'true if any field was hard to read' },
          },
          required: ['name'],
        },
      },
      grand_total_hours: { type: 'number', description: 'The written grand total if present' },
      associate_signature: { type: 'string', description: 'V&A/associate signature name if present' },
    },
    required: ['rows'],
  },
}

export async function parseTimesheetImage(base64, mediaType = 'image/jpeg') {
  const key = process.env.ANTHROPIC_API_KEY
  const data = base64.replace(/^data:image\/\w+;base64,/, '')
  const mt = /^data:(image\/\w+);/.exec(base64)?.[1] || mediaType

  const json = await anthropicCall({
    model: MODEL,
    max_tokens: 2000,
    system: SYSTEM,
    tools: [TOOL],
    tool_choice: { type: 'tool', name: 'record_timesheet' },
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mt, data } },
        { type: 'text', text: 'Transcribe this timesheet.' },
      ],
    }],
  })
  const toolUse = (json.content || []).find(c => c.type === 'tool_use')
  if (!toolUse) throw new Error('No structured output from Claude')
  const out = toolUse.input || {}
  // Normalize rows + compute hours where missing.
  out.rows = (out.rows || []).map(r => {
    let hrs = typeof r.total_hours === 'number' ? r.total_hours : computeHours(r.start_time, r.end_time)
    return { name: r.name || '', start_time: r.start_time || '', end_time: r.end_time || '', total_hours: hrs ?? '', unclear: !!r.unclear }
  }).filter(r => r.name)
  return out
}

// Transcribe a handwritten V&A job application photo into structured fields.
const APP_SYSTEM = `You transcribe handwritten event-staffing job applications into structured data.
Read exactly what is written. Map roles/availability/experience to the closest allowed values.
Roles: janitorial, cleanup, setup_breakdown, brand_activation, general_labor.
Availability: weekdays, weekends, on_call.
Experience: event_staffing, warehouse, food_service, retail, cleaning, moving, security, none.
Windows: morning, afternoon, evening, overnight, flexible.
Leave a field blank/empty array if not present or unreadable. Return ONLY the tool call.`

const APP_TOOL = {
  name: 'record_application',
  description: 'Record the transcribed job application.',
  input_schema: {
    type: 'object',
    properties: {
      first_name: { type: 'string' },
      last_name: { type: 'string' },
      phone: { type: 'string' },
      email: { type: 'string' },
      city: { type: 'string' },
      zip: { type: 'string' },
      roles: { type: 'array', items: { type: 'string' } },
      availability: { type: 'array', items: { type: 'string' } },
      experience_types: { type: 'array', items: { type: 'string' } },
      availability_windows: { type: 'array', items: { type: 'string' } },
      has_transportation: { type: 'string', description: 'yes/no/blank' },
      short_notice: { type: 'string', description: 'yes/sometimes/no/blank' },
      notes: { type: 'string' },
    },
    required: ['first_name'],
  },
}

export async function parseApplicationImage(base64, mediaType = 'image/jpeg') {
  const data = base64.replace(/^data:image\/\w+;base64,/, '')
  const mt = /^data:(image\/\w+);/.exec(base64)?.[1] || mediaType
  const json = await anthropicCall({
    model: MODEL, max_tokens: 1500, system: APP_SYSTEM,
    tools: [APP_TOOL], tool_choice: { type: 'tool', name: 'record_application' },
    messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: mt, data } },
      { type: 'text', text: 'Transcribe this job application.' },
    ] }],
  })
  const toolUse = (json.content || []).find(c => c.type === 'tool_use')
  if (!toolUse) throw new Error('No structured output from Claude')
  return toolUse.input || {}
}

function computeHours(start, end) {
  const p = (t) => {
    const m = /(\d{1,2}):?(\d{2})?\s*([ap]\.?m\.?)?/i.exec(String(t || ''))
    if (!m) return null
    let h = parseInt(m[1], 10); const min = m[2] ? parseInt(m[2], 10) : 0
    const ap = (m[3] || '').toLowerCase()
    if (ap.startsWith('p') && h < 12) h += 12
    if (ap.startsWith('a') && h === 12) h = 0
    return h + min / 60
  }
  const s = p(start), e = p(end)
  if (s == null || e == null) return null
  let d = e - s; if (d < 0) d += 24
  return Math.round(d * 10) / 10
}
