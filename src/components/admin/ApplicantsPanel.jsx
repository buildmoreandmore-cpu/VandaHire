import { useState, useEffect, useMemo } from 'react'
import imageCompression from 'browser-image-compression'
import MessageTemplates from './MessageTemplates.jsx'
import InPersonIntake from './InPersonIntake.jsx'
import { fetchApplicants, updateApplicant, editApplicant, deleteApplicant, fetchEvents, createAssignments, bulkUpdateStatus, sendAdminMessage, resetWorkerPin, downloadW9Csv, downloadWorkersCsv, adminUploadId, fetchApplicantNotes, createApplicantNote, deleteApplicantNote, bulkMessage, fetchSegments, createSegment, deleteSegment, fetchCampaigns, resendUnopened, createScheduledMessage } from '../../lib/adminApi.js'

const EMAIL_STATUS_COLORS = {
  sent: 'bg-white/10 text-p-muted',
  delivered: 'bg-blue-500/15 text-blue-400',
  opened: 'bg-green-500/15 text-green-400',
  clicked: 'bg-green-500/25 text-green-300',
  bounced: 'bg-red-500/15 text-red-400',
  complained: 'bg-red-500/20 text-red-300',
  delivery_delayed: 'bg-yellow-500/15 text-yellow-400',
}

const COORDINATOR_NAME_KEY = 'vanda_coordinator_name'

function getCoordinatorName() {
  try { return localStorage.getItem(COORDINATOR_NAME_KEY) || '' } catch { return '' }
}
function setCoordinatorName(name) {
  try { localStorage.setItem(COORDINATOR_NAME_KEY, name) } catch {}
}

// Derive US state from a ZIP code's leading 3 digits. No schema change —
// works on existing worker data. Returns '' if unknown.
const ZIP_PREFIX_STATE = [
  [['005','005'],'NY'],[['006','009'],'PR'],[['010','027'],'MA'],[['028','029'],'RI'],
  [['030','038'],'NH'],[['039','049'],'ME'],[['050','059'],'VT'],[['060','069'],'CT'],
  [['070','089'],'NJ'],[['100','149'],'NY'],[['150','196'],'PA'],[['197','199'],'DE'],
  [['200','205'],'DC'],[['206','219'],'MD'],[['220','246'],'VA'],[['247','268'],'WV'],
  [['270','289'],'NC'],[['290','299'],'SC'],[['300','319'],'GA'],[['320','349'],'FL'],
  [['350','369'],'AL'],[['370','385'],'TN'],[['386','397'],'MS'],[['398','399'],'GA'],
  [['400','427'],'KY'],[['430','459'],'OH'],[['460','479'],'IN'],[['480','499'],'MI'],
  [['500','528'],'IA'],[['530','549'],'WI'],[['550','567'],'MN'],[['570','577'],'SD'],
  [['580','588'],'ND'],[['590','599'],'MT'],[['600','629'],'IL'],[['630','658'],'MO'],
  [['660','679'],'KS'],[['680','693'],'NE'],[['700','714'],'LA'],[['716','729'],'AR'],
  [['730','749'],'OK'],[['750','799'],'TX'],[['800','816'],'CO'],[['820','831'],'WY'],
  [['832','838'],'ID'],[['840','847'],'UT'],[['850','865'],'AZ'],[['870','884'],'NM'],
  [['889','898'],'NV'],[['900','961'],'CA'],[['967','968'],'HI'],[['970','979'],'OR'],
  [['980','994'],'WA'],[['995','999'],'AK'],
]

function zipToState(zip) {
  const digits = String(zip || '').replace(/\D/g, '')
  if (digits.length < 3) return ''
  const p = digits.slice(0, 3)
  for (const [[lo, hi], st] of ZIP_PREFIX_STATE) {
    if (p >= lo && p <= hi) return st
  }
  return ''
}

function relativeTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`
  return d.toLocaleDateString()
}

function lastContactColor(iso) {
  if (!iso) return 'bg-white/5 text-p-muted border-p-border'
  const days = (Date.now() - new Date(iso).getTime()) / 86400000
  if (days < 7) return 'bg-green-500/15 text-green-400 border-green-500/30'
  if (days < 30) return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
  return 'bg-orange-500/15 text-orange-400 border-orange-500/30'
}

const STATUS_OPTIONS = ['all', 'pending', 'qualified', 'needs_review', 'not_a_fit', 'approved', 'rejected', 'removed']

const STATUS_COLORS = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  qualified: 'bg-blue-500/20 text-blue-400',
  needs_review: 'bg-orange-500/20 text-orange-400',
  not_a_fit: 'bg-red-500/20 text-red-400',
  approved: 'bg-green-500/20 text-green-400',
  rejected: 'bg-red-500/20 text-red-400',
  removed: 'bg-gray-500/20 text-gray-400',
}

export default function ApplicantsPanel() {
  const [applicants, setApplicants] = useState([])
  const [filter, setFilter] = useState('all')
  const [cityFilter, setCityFilter] = useState('all')
  const [stateFilter, setStateFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const [availFilter, setAvailFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [updating, setUpdating] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [events, setEvents] = useState([])
  const [assignEventId, setAssignEventId] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [assignResult, setAssignResult] = useState(null)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState({})

  // Feature 2: Bulk status change
  const [bulkStatus, setBulkStatus] = useState('')
  const [bulkUpdating, setBulkUpdating] = useState(false)

  // Feature 10: Messaging
  const [messagingWorker, setMessagingWorker] = useState(null)
  const [msgText, setMsgText] = useState('')
  const [msgChannel, setMsgChannel] = useState('both')
  const [sendingMsg, setSendingMsg] = useState(false)

  // Feature 13: PIN reset
  const [resettingPin, setResettingPin] = useState(null)

  // Saved segments (filter presets)
  const [segments, setSegments] = useState([])
  const [segmentsLoaded, setSegmentsLoaded] = useState(false)

  const loadSegments = async () => {
    try { setSegments(await fetchSegments()); setSegmentsLoaded(true) } catch (e) { console.error(e) }
  }
  const applySegment = (seg) => {
    const f = seg.filters || {}
    setFilter(f.status || 'all')
    setCityFilter(f.city || 'all')
    setStateFilter(f.state || 'all')
    setRoleFilter(f.role || 'all')
    setAvailFilter(f.availability || 'all')
    setSearch(f.search || '')
  }
  const saveSegment = async () => {
    const name = window.prompt('Name this segment:')
    if (!name || !name.trim()) return
    try {
      const seg = await createSegment(name.trim(), { status: filter, city: cityFilter, state: stateFilter, role: roleFilter, availability: availFilter, search })
      setSegments(prev => [seg, ...prev])
    } catch (e) { alert('Save failed: ' + e.message) }
  }
  const removeSegment = async (id) => {
    try { await deleteSegment(id); setSegments(prev => prev.filter(s => s.id !== id)) }
    catch (e) { alert('Delete failed: ' + e.message) }
  }

  // Email campaigns (resend to non-openers)
  const [showIntake, setShowIntake] = useState(false)
  const [showCampaigns, setShowCampaigns] = useState(false)
  const [campaigns, setCampaigns] = useState([])
  const [campaignsLoading, setCampaignsLoading] = useState(false)
  const [resendingId, setResendingId] = useState(null)

  const openCampaigns = async () => {
    setShowCampaigns(true)
    setCampaignsLoading(true)
    try { setCampaigns(await fetchCampaigns()) } catch (e) { console.error(e) }
    setCampaignsLoading(false)
  }
  const doResendUnopened = async (id) => {
    setResendingId(id)
    try {
      const r = await resendUnopened(id)
      alert(`Resent to ${r.sent} non-opener${r.sent !== 1 ? 's' : ''}${r.failed ? ` (${r.failed} skipped/failed)` : ''}.`)
      setCampaigns(await fetchCampaigns())
    } catch (e) { alert('Resend failed: ' + e.message) }
    setResendingId(null)
  }

  // Bulk message
  const [showBulkMsg, setShowBulkMsg] = useState(false)
  const [bulkMsgText, setBulkMsgText] = useState('')
  const [bulkMsgSubject, setBulkMsgSubject] = useState('')
  const [bulkMsgChannel, setBulkMsgChannel] = useState('both')
  const [bulkMsgSending, setBulkMsgSending] = useState(false)
  const [bulkMsgResult, setBulkMsgResult] = useState(null)

  const [bulkMsgSendAt, setBulkMsgSendAt] = useState('')

  const handleBulkMessage = async () => {
    if (!bulkMsgText.trim() || selected.size === 0) return
    setBulkMsgSending(true)
    setBulkMsgResult(null)
    try {
      if (bulkMsgSendAt) {
        await createScheduledMessage([...selected], bulkMsgText, bulkMsgChannel, bulkMsgSubject, new Date(bulkMsgSendAt).toISOString())
        setBulkMsgResult({ scheduled: true, at: bulkMsgSendAt })
      } else {
        const res = await bulkMessage([...selected], bulkMsgText, bulkMsgChannel, bulkMsgSubject)
        setBulkMsgResult(res)
      }
    } catch (err) {
      setBulkMsgResult({ error: err.message })
    }
    setBulkMsgSending(false)
  }

  // Coordinator-side ID upload
  const [uploadingIdFor, setUploadingIdFor] = useState(null)

  // Contact notes (per expanded worker)
  const [notesByWorker, setNotesByWorker] = useState({}) // { [workerId]: [note, ...] }
  const [newNoteDraft, setNewNoteDraft] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [coordinatorName, setCoordName] = useState(getCoordinatorName())

  const loadNotesFor = async (workerId) => {
    try {
      const notes = await fetchApplicantNotes(workerId)
      setNotesByWorker(prev => ({ ...prev, [workerId]: notes }))
    } catch (err) {
      console.error('Failed to load notes:', err)
    }
  }

  const addNote = async (workerId) => {
    const text = newNoteDraft.trim()
    if (!text) return
    let author = coordinatorName
    if (!author) {
      author = (window.prompt('Your name or initials (saved on this device):') || '').trim()
      if (!author) return
      setCoordinatorName(author)
      setCoordName(author)
    }
    setSavingNote(true)
    try {
      const created = await createApplicantNote(workerId, author, text)
      setNotesByWorker(prev => ({ ...prev, [workerId]: [created, ...(prev[workerId] || [])] }))
      setNewNoteDraft('')
      setApplicants(prev => prev.map(a => a.id === workerId
        ? { ...a, last_contact: { at: created.created_at, by: created.author, preview: text.slice(0, 120) } }
        : a))
    } catch (err) {
      alert('Failed to save note: ' + err.message)
    }
    setSavingNote(false)
  }

  const removeNote = async (workerId, noteId) => {
    if (!confirm('Delete this note?')) return
    try {
      await deleteApplicantNote(noteId)
      setNotesByWorker(prev => ({ ...prev, [workerId]: (prev[workerId] || []).filter(n => n.id !== noteId) }))
    } catch (err) {
      alert('Failed to delete: ' + err.message)
    }
  }

  const editCoordinatorName = () => {
    const next = (window.prompt('Your name or initials (saved on this device):', coordinatorName) || '').trim()
    if (next) {
      setCoordinatorName(next)
      setCoordName(next)
    }
  }

  const handleAdminUploadId = async (workerId, file) => {
    if (!file) return
    setUploadingIdFor(workerId)
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.8,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: 'image/jpeg',
      })
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(compressed)
      })
      const { id_photo_url } = await adminUploadId(workerId, base64)
      setApplicants(prev => prev.map(x => x.id === workerId ? { ...x, id_photo_url } : x))
    } catch (err) {
      alert('Upload failed: ' + (err?.message || 'unknown'))
    }
    setUploadingIdFor(null)
  }

  const load = async () => {
    setLoading(true)
    try {
      const data = await fetchApplicants(filter === 'all' ? '' : filter)
      setApplicants(data)
    } catch (err) {
      console.error('Failed to load applicants:', err)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [filter])

  // Load events for the assign dropdown
  useEffect(() => {
    fetchEvents().then(setEvents).catch(() => {})
  }, [])

  // Derive unique cities, states, roles, availability from data
  const { cities, states, roles, availabilities } = useMemo(() => {
    const citySet = new Set()
    const stateSet = new Set()
    const roleSet = new Set()
    const availSet = new Set()
    for (const a of applicants) {
      if (a.city) citySet.add(a.city)
      const st = zipToState(a.zip)
      if (st) stateSet.add(st)
      for (const r of (a.roles || [])) roleSet.add(r)
      for (const av of (a.availability || [])) availSet.add(av)
    }
    return {
      cities: [...citySet].sort(),
      states: [...stateSet].sort(),
      roles: [...roleSet].sort(),
      availabilities: [...availSet].sort(),
    }
  }, [applicants])

  // Cities shown in the dropdown — narrowed to the selected state.
  const visibleCities = useMemo(() => {
    if (stateFilter === 'all') return cities
    const set = new Set()
    for (const a of applicants) {
      if (a.city && zipToState(a.zip) === stateFilter) set.add(a.city)
    }
    return [...set].sort()
  }, [applicants, stateFilter, cities])

  // Apply client-side filters + search
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return applicants.filter(a => {
      if (cityFilter !== 'all' && a.city !== cityFilter) return false
      if (stateFilter !== 'all' && zipToState(a.zip) !== stateFilter) return false
      if (roleFilter !== 'all' && !(a.roles || []).includes(roleFilter)) return false
      if (availFilter !== 'all' && !(a.availability || []).includes(availFilter)) return false
      if (q) {
        const name = `${a.first_name || ''} ${a.last_name || ''}`.toLowerCase()
        const phone = (a.phone || '').replace(/\D/g, '')
        const searchDigits = q.replace(/\D/g, '')
        if (!name.includes(q) && !(searchDigits && phone.includes(searchDigits))) return false
      }
      return true
    })
  }, [applicants, cityFilter, stateFilter, roleFilter, availFilter, search])

  // Group by STATE first (derived from zip), city shown as a subtitle on each worker.
  const grouped = useMemo(() => {
    const groups = {}
    for (const a of filtered) {
      const st = zipToState(a.zip) || 'Unknown state'
      if (!groups[st]) groups[st] = []
      groups[st].push(a)
    }
    // Within each state, sort workers by city then name for readability.
    for (const k of Object.keys(groups)) {
      groups[k].sort((x, y) => (x.city || '').localeCompare(y.city || '') || `${x.first_name} ${x.last_name}`.localeCompare(`${y.first_name} ${y.last_name}`))
    }
    // Unknown last, otherwise alphabetical by state.
    return Object.entries(groups).sort((a, b) => {
      if (a[0] === 'Unknown state') return 1
      if (b[0] === 'Unknown state') return -1
      return a[0].localeCompare(b[0])
    })
  }, [filtered])

  const handleStatusChange = async (id, newStatus) => {
    setUpdating(id)
    try {
      await updateApplicant(id, newStatus)
      setApplicants(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a))
    } catch (err) {
      console.error('Failed to update:', err)
    }
    setUpdating(null)
  }

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    const allIds = filtered.map(a => a.id)
    if (allIds.every(id => selected.has(id))) {
      setSelected(prev => {
        const next = new Set(prev)
        allIds.forEach(id => next.delete(id))
        return next
      })
    } else {
      setSelected(prev => {
        const next = new Set(prev)
        allIds.forEach(id => next.add(id))
        return next
      })
    }
  }

  const toggleSelectCity = (cityApplicants) => {
    const ids = cityApplicants.map(a => a.id)
    if (ids.every(id => selected.has(id))) {
      setSelected(prev => {
        const next = new Set(prev)
        ids.forEach(id => next.delete(id))
        return next
      })
    } else {
      setSelected(prev => {
        const next = new Set(prev)
        ids.forEach(id => next.add(id))
        return next
      })
    }
  }

  const handleBulkAssign = async () => {
    if (!assignEventId || selected.size === 0) return
    setAssigning(true)
    setAssignResult(null)
    try {
      const result = await createAssignments(assignEventId, [...selected])
      setAssignResult({ success: true, count: result.created })
      setSelected(new Set())
    } catch (err) {
      setAssignResult({ success: false, error: err.message })
    }
    setAssigning(false)
  }

  // Feature 6: Quick stats
  const workerStats = useMemo(() => {
    const total = applicants.length
    const byStatus = {}
    let withRating = 0, totalRating = 0
    for (const a of applicants) {
      byStatus[a.status] = (byStatus[a.status] || 0) + 1
      if (a.avg_rating != null) { withRating++; totalRating += parseFloat(a.avg_rating) }
    }
    const avgRating = withRating > 0 ? (totalRating / withRating).toFixed(1) : null
    return { total, byStatus, avgRating }
  }, [applicants])

  // Feature 2: Bulk status change
  const handleBulkStatusChange = async () => {
    if (!bulkStatus || selected.size === 0) return
    setBulkUpdating(true)
    try {
      await bulkUpdateStatus([...selected], bulkStatus)
      setApplicants(prev => prev.map(a => selected.has(a.id) ? { ...a, status: bulkStatus } : a))
      setSelected(new Set())
      setBulkStatus('')
    } catch (err) {
      console.error('Bulk status failed:', err)
    }
    setBulkUpdating(false)
  }

  // Feature 10: Send message
  const handleSendMessage = async () => {
    if (!messagingWorker || !msgText.trim()) return
    setSendingMsg(true)
    try {
      await sendAdminMessage(messagingWorker.id, msgText, msgChannel)
      alert(`Message sent to ${messagingWorker.first_name}!`)
      setMessagingWorker(null)
      setMsgText('')
    } catch (err) {
      alert('Send failed: ' + err.message)
    }
    setSendingMsg(false)
  }

  // Feature 13: PIN reset
  const handleResetPin = async (worker) => {
    if (!confirm(`Reset PIN for ${worker.first_name} ${worker.last_name}? They will need to set a new PIN on next login.`)) return
    setResettingPin(worker.id)
    try {
      await resetWorkerPin(worker.id)
      alert(`PIN reset for ${worker.first_name}. They'll set a new one on next login.`)
    } catch (err) {
      alert('Reset failed: ' + err.message)
    }
    setResettingPin(null)
  }

  const activeEvents = events.filter(e => ['pending', 'staffing', 'confirmed'].includes(e.status))

  return (
    <div>
      {showIntake && <InPersonIntake onClose={() => setShowIntake(false)} onCreated={() => load()} />}

      {/* Quick Stats (Feature 6) */}
      {!loading && applicants.length > 0 && (
        <div className="flex gap-4 mb-3 overflow-x-auto pb-1">
          <MiniStat label="Total" value={workerStats.total} />
          {workerStats.byStatus.approved > 0 && <MiniStat label="Approved" value={workerStats.byStatus.approved} color="text-green-400" />}
          {workerStats.byStatus.pending > 0 && <MiniStat label="Pending" value={workerStats.byStatus.pending} color="text-yellow-400" />}
          {workerStats.byStatus.needs_review > 0 && <MiniStat label="Review" value={workerStats.byStatus.needs_review} color="text-orange-400" />}
          {workerStats.avgRating && <MiniStat label="Avg Rating" value={`★ ${workerStats.avgRating}`} color="text-yellow-400" />}
        </div>
      )}

      {/* Status Filters */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
        {STATUS_OPTIONS.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              filter === s
                ? 'bg-p-green text-black'
                : 'bg-p-surface text-p-muted border border-p-border hover:border-p-muted'
            }`}
          >
            {s === 'all' ? 'All' : s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or phone..."
          className="w-full bg-p-surface border border-p-border rounded-lg px-4 py-2 text-sm text-white placeholder:text-p-muted focus:outline-none focus:border-p-link"
        />
      </div>

      {/* Secondary Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <select value={stateFilter} onChange={e => { setStateFilter(e.target.value); setCityFilter('all') }} className="bg-p-surface border border-p-border rounded-lg px-3 py-1.5 text-xs text-white">
          <option value="all">All States</option>
          {states.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={cityFilter} onChange={e => setCityFilter(e.target.value)} className="bg-p-surface border border-p-border rounded-lg px-3 py-1.5 text-xs text-white">
          <option value="all">{stateFilter === 'all' ? 'All Cities' : `All Cities in ${stateFilter}`}</option>
          {visibleCities.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="bg-p-surface border border-p-border rounded-lg px-3 py-1.5 text-xs text-white">
          <option value="all">All Roles</option>
          {roles.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={availFilter} onChange={e => setAvailFilter(e.target.value)} className="bg-p-surface border border-p-border rounded-lg px-3 py-1.5 text-xs text-white">
          <option value="all">All Availability</option>
          {availabilities.map(av => <option key={av} value={av}>{av}</option>)}
        </select>
        <select
          value=""
          onClick={() => { if (!segmentsLoaded) loadSegments() }}
          onChange={e => {
            const v = e.target.value
            if (v === '__save') { saveSegment(); return }
            if (v.startsWith('__del:')) { removeSegment(v.slice(6)); return }
            const seg = segments.find(s => s.id === v)
            if (seg) applySegment(seg)
          }}
          className="bg-p-surface border border-p-border rounded-lg px-3 py-1.5 text-xs text-white"
          title="Saved segments"
        >
          <option value="">Segments…</option>
          <option value="__save">+ Save current filters</option>
          {segments.length > 0 && <option disabled>──────────</option>}
          {segments.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          {segments.length > 0 && <option disabled>── delete ──</option>}
          {segments.map(s => <option key={'d'+s.id} value={'__del:'+s.id}>✕ {s.name}</option>)}
        </select>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setShowIntake(true)}
            className="inline-flex items-center gap-1.5 bg-p-green text-black rounded-lg px-3 py-1.5 text-xs font-semibold hover:opacity-90 transition-opacity"
            title="Add an applicant in person (hiring event)"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 3v10M3 8h10" /></svg>
            In-person
          </button>
          <a
            href="/apply-print"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 bg-p-surface border border-p-border text-p-muted hover:text-white hover:border-p-muted rounded-lg px-3 py-1.5 text-xs transition-colors"
            title="Open the printable application (Print → Save as PDF)"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6V2h8v4M4 12H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1M4 10h8v4H4z" /></svg>
            Print application
          </a>
          <button
            onClick={openCampaigns}
            className="inline-flex items-center gap-1.5 bg-p-surface border border-p-border text-p-muted hover:text-white hover:border-p-muted rounded-lg px-3 py-1.5 text-xs transition-colors"
            title="Email campaigns — resend to non-openers"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="3" width="12" height="10" rx="1.5" /><path d="M2.5 4l5.5 4 5.5-4" /></svg>
            Campaigns
          </button>
          <button
            onClick={async () => {
              try { await downloadWorkersCsv(filter) } catch (err) { alert('Export failed: ' + err.message) }
            }}
            className="inline-flex items-center gap-1.5 bg-p-surface border border-p-border text-p-muted hover:text-white hover:border-p-muted rounded-lg px-3 py-1.5 text-xs transition-colors"
            title={`Download workers as CSV${filter !== 'all' ? ` (status: ${filter})` : ' (all)'}`}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 2v9" />
              <polyline points="4 7 8 11 12 7" />
              <line x1="3" y1="14" x2="13" y2="14" />
            </svg>
            Export Workers
          </button>
          <button
            onClick={async () => {
              try { await downloadW9Csv() } catch (err) { alert('Export failed: ' + err.message) }
            }}
            className="inline-flex items-center gap-1.5 bg-p-surface border border-p-border text-p-muted hover:text-white hover:border-p-muted rounded-lg px-3 py-1.5 text-xs transition-colors"
            title="Download all signed W-9s as CSV (includes decrypted TIN)"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 2v9" />
              <polyline points="4 7 8 11 12 7" />
              <line x1="3" y1="14" x2="13" y2="14" />
            </svg>
            Export W-9 CSV
          </button>
        </div>
      </div>

      {/* Bulk Assign Bar */}
      {selected.size > 0 && (
        <div className="bg-p-surface border border-p-border rounded-lg px-4 py-3 mb-4 flex items-center gap-3 flex-wrap">
          <span className="text-white text-sm font-medium">{selected.size} selected</span>
          <select value={assignEventId} onChange={e => setAssignEventId(e.target.value)} className="bg-black border border-p-border rounded-lg px-3 py-1.5 text-xs text-white flex-1 min-w-[200px]">
            <option value="">Select an event to assign...</option>
            {activeEvents.map(e => (
              <option key={e.id} value={e.id}>{e.title} — {e.city} ({e.event_date})</option>
            ))}
          </select>
          <button
            onClick={handleBulkAssign}
            disabled={!assignEventId || assigning}
            className="px-4 py-1.5 rounded-lg text-xs font-medium text-black bg-p-green hover:opacity-90 transition-all disabled:opacity-40"
          >
            {assigning ? 'Assigning...' : 'Assign to Event'}
          </button>
          <div className="border-l border-p-border pl-3 flex items-center gap-2">
            <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)} className="bg-black border border-p-border rounded-lg px-3 py-1.5 text-xs text-white">
              <option value="">Bulk status change...</option>
              {['approved', 'pending', 'needs_review', 'not_a_fit', 'rejected', 'removed'].map(s => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <button
              onClick={handleBulkStatusChange}
              disabled={!bulkStatus || bulkUpdating}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-black bg-p-green hover:opacity-90 transition-all disabled:opacity-40"
            >{bulkUpdating ? 'Updating...' : 'Apply'}</button>
          </div>
          <div className="border-l border-p-border pl-3">
            <button
              onClick={() => { setShowBulkMsg(true); setBulkMsgResult(null) }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white border border-p-border bg-p-bg hover:border-p-muted transition-all"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2 4h12v8H2z" /><path d="M2 4l6 4 6-4" />
              </svg>
              Message {selected.size}
            </button>
          </div>
          <button onClick={() => setSelected(new Set())} className="text-p-muted text-xs hover:text-white">Clear</button>
        </div>
      )}

      {/* Campaigns Modal — resend to non-openers */}
      {showCampaigns && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4" onClick={() => setShowCampaigns(false)}>
          <div className="bg-p-surface border border-p-border rounded-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-p-border flex items-center justify-between">
              <div>
                <h3 className="text-white font-semibold text-sm">Email Campaigns</h3>
                <p className="text-p-muted text-[10px] mt-0.5">Each bulk email send is recorded here. Resend to whoever hasn't opened yet.</p>
              </div>
              <button onClick={() => setShowCampaigns(false)} className="text-p-muted hover:text-white text-lg">×</button>
            </div>
            <div className="p-4">
              {campaignsLoading ? (
                <p className="text-p-muted text-xs text-center py-6">Loading…</p>
              ) : campaigns.length === 0 ? (
                <p className="text-p-muted text-xs text-center py-6">No email campaigns yet. Send a bulk/group/crew email and it'll appear here.</p>
              ) : (
                <div className="space-y-2">
                  {campaigns.map(c => (
                    <div key={c.id} className="bg-p-bg/50 border border-p-border rounded-lg px-3 py-2.5 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-xs font-medium truncate">{c.subject}</div>
                        <div className="text-p-muted text-[10px]">{new Date(c.created_at).toLocaleString()} · {c.recipients_count} sent · <span className="text-green-400">{c.opened} opened</span> · <span className="text-yellow-400">{c.not_opened} not opened</span></div>
                      </div>
                      <button
                        onClick={() => doResendUnopened(c.id)}
                        disabled={resendingId === c.id || c.not_opened === 0}
                        className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-p-green text-black text-[11px] font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
                        title={c.not_opened === 0 ? 'Everyone opened' : `Resend to ${c.not_opened} non-openers`}
                      >
                        {resendingId === c.id ? 'Resending…' : `Resend to ${c.not_opened}`}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bulk Message Modal */}
      {showBulkMsg && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4" onClick={() => setShowBulkMsg(false)}>
          <div className="bg-p-surface border border-p-border rounded-xl w-full max-w-lg max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-p-border flex items-center justify-between">
              <h3 className="text-white font-semibold text-sm">Message {selected.size} worker{selected.size !== 1 ? 's' : ''}</h3>
              <button onClick={() => setShowBulkMsg(false)} className="text-p-muted hover:text-white text-lg">×</button>
            </div>
            <div className="p-4 space-y-3">
              <div className="relative flex justify-end">
                <MessageTemplates
                  current={{ channel: bulkMsgChannel, subject: bulkMsgSubject, body: bulkMsgText }}
                  onApply={(t) => { setBulkMsgChannel(t.channel || 'both'); setBulkMsgSubject(t.subject || ''); setBulkMsgText(t.body || '') }}
                />
              </div>
              <select value={bulkMsgChannel} onChange={e => setBulkMsgChannel(e.target.value)} className="w-full bg-p-bg border border-p-border rounded-lg px-3 py-2 text-xs text-white">
                <option value="both">SMS + Email</option>
                <option value="sms">SMS Only</option>
                <option value="email">Email Only</option>
              </select>
              {(bulkMsgChannel === 'email' || bulkMsgChannel === 'both') && (
                <input
                  value={bulkMsgSubject}
                  onChange={e => setBulkMsgSubject(e.target.value)}
                  placeholder="Email subject (defaults to 'Message from V&A Hire')"
                  className="w-full bg-p-bg border border-p-border rounded-lg px-3 py-2 text-xs text-white placeholder-p-muted focus:outline-none focus:border-p-link"
                />
              )}
              <textarea
                value={bulkMsgText}
                onChange={e => setBulkMsgText(e.target.value)}
                rows={5}
                placeholder="Type your message… Use {first_name} to personalize each one."
                className="w-full bg-p-bg border border-p-border rounded-lg px-3 py-2 text-sm text-white placeholder-p-muted focus:outline-none focus:border-p-link resize-none"
              />
              <p className="text-p-muted text-[10px]">Tip: <span className="text-white">{'{first_name}'}</span> is replaced with each worker's name. SMS only sends to workers with a phone; email only to those with an address. STOP/HELP handling is automatic.</p>
              <div>
                <label className="text-p-muted text-[10px] mb-1 block">Schedule for later (optional)</label>
                <input
                  type="datetime-local"
                  value={bulkMsgSendAt}
                  onChange={e => setBulkMsgSendAt(e.target.value)}
                  className="w-full bg-p-bg border border-p-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-p-link"
                />
                {bulkMsgSendAt && <p className="text-p-muted text-[10px] mt-1">Processed by the daily run — goes out on/after the chosen date.</p>}
              </div>
              {bulkMsgResult && (
                bulkMsgResult.error ? (
                  <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/30 rounded px-3 py-2">{bulkMsgResult.error}</div>
                ) : bulkMsgResult.scheduled ? (
                  <div className="text-green-400 text-xs bg-green-500/10 border border-green-500/30 rounded px-3 py-2">
                    Scheduled for {new Date(bulkMsgResult.at).toLocaleString()} to {selected.size} worker{selected.size !== 1 ? 's' : ''}.
                  </div>
                ) : (
                  <div className="text-green-400 text-xs bg-green-500/10 border border-green-500/30 rounded px-3 py-2">
                    Sent to {bulkMsgResult.recipients} · SMS {bulkMsgResult.sms.sent} ok{bulkMsgResult.sms.failed ? `, ${bulkMsgResult.sms.failed} failed` : ''} · Email {bulkMsgResult.email.sent} ok{bulkMsgResult.email.failed ? `, ${bulkMsgResult.email.failed} failed` : ''}
                    {bulkMsgResult.errors?.length > 0 && <div className="text-p-muted text-[10px] mt-1">{bulkMsgResult.errors.join(' · ')}</div>}
                  </div>
                )
              )}
            </div>
            <div className="px-4 py-3 border-t border-p-border flex justify-end gap-2">
              <button onClick={() => setShowBulkMsg(false)} className="text-p-muted text-xs hover:text-white px-3 py-2">Close</button>
              <button
                onClick={handleBulkMessage}
                disabled={bulkMsgSending || !bulkMsgText.trim()}
                className="px-4 py-2 rounded-lg bg-p-green text-black text-xs font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
              >{bulkMsgSending ? (bulkMsgSendAt ? 'Scheduling…' : 'Sending…') : (bulkMsgSendAt ? `Schedule for ${selected.size}` : `Send to ${selected.size}`)}</button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Result */}
      {assignResult && (
        <div className={`mb-4 rounded-lg px-3 py-2 text-xs ${assignResult.success ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
          {assignResult.success ? `Assigned ${assignResult.count} worker(s) to event` : assignResult.error}
        </div>
      )}

      {/* Select All */}
      {!loading && filtered.length > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <input
            type="checkbox"
            checked={filtered.every(a => selected.has(a.id))}
            onChange={toggleSelectAll}
            className="accent-green-500 w-4 h-4 cursor-pointer"
          />
          <span className="text-p-muted text-xs">Select all ({filtered.length})</span>
        </div>
      )}

      {loading ? (
        <div className="text-p-muted text-sm py-8 text-center">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-p-muted text-sm py-8 text-center">No applicants found</div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([stateName, workers]) => (
            <div key={stateName}>
              {/* State Header */}
              <div className="flex items-center gap-3 mb-2">
                <input
                  type="checkbox"
                  checked={workers.every(a => selected.has(a.id))}
                  onChange={() => toggleSelectCity(workers)}
                  className="accent-green-500 w-4 h-4 cursor-pointer"
                />
                <h3 className="text-white text-sm font-semibold">{stateName}</h3>
                <span className="text-p-muted text-xs">{workers.length} worker{workers.length !== 1 ? 's' : ''}</span>
              </div>

              <div className="space-y-2 ml-6">
                {workers.map(a => (
                  <div key={a.id} className="bg-p-surface border border-p-border rounded-lg overflow-hidden">
                    {/* Row */}
                    <div className="flex items-center gap-3 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(a.id)}
                        onChange={() => toggleSelect(a.id)}
                        onClick={e => e.stopPropagation()}
                        className="accent-green-500 w-4 h-4 flex-shrink-0 cursor-pointer"
                      />
                      <button
                        onClick={() => {
                          const next = expanded === a.id ? null : a.id
                          setExpanded(next)
                          setNewNoteDraft('')
                          if (next && !notesByWorker[next]) loadNotesFor(next)
                        }}
                        className="flex-1 flex items-center gap-3 text-left hover:bg-white/[0.02] transition-colors min-w-0"
                      >
                        {a.photo_url ? (
                          <img src={a.photo_url} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-p-border flex items-center justify-center flex-shrink-0">
                            <span className="text-p-muted text-xs">{a.first_name?.[0]}{a.last_name?.[0]}</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-sm font-medium truncate">
                            {a.first_name} {a.last_name}
                            {a.city && <span className="text-p-muted font-normal"> · {a.city}</span>}
                          </div>
                          <div className="text-p-muted text-xs truncate">
                            {(a.roles || []).join(', ') || 'No roles'} · {(a.availability || []).join(', ') || ''}
                          </div>
                          <JobSummaryLine history={a.job_history} />
                        </div>
                        {a.avg_rating != null && (
                          <span className="text-yellow-400 text-[10px] flex-shrink-0 hidden sm:inline">★ {a.avg_rating}</span>
                        )}
                        <ReliabilityBadge reliability={a.reliability} compact />
                        {a.active_booking && (
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-medium bg-purple-500/20 text-purple-300 flex-shrink-0 max-w-[160px] truncate"
                            title={`Booked: ${a.active_booking.event_title} · ${a.active_booking.event_date}`}
                          >
                            Booked · {a.active_booking.event_title}
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${a.w9_signed_at ? 'bg-green-500/15 text-green-400' : 'bg-yellow-500/15 text-yellow-400'}`}
                          title={a.w9_signed_at ? `W-9 signed ${new Date(a.w9_signed_at).toLocaleDateString()}` : 'W-9 not on file'}
                        >
                          W-9
                          {a.w9_signed_at ? (
                            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="3 8 7 12 13 4" /></svg>
                          ) : (
                            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="4" y1="8" x2="12" y2="8" /></svg>
                          )}
                        </span>
                        <span
                          className={`hidden sm:inline-flex items-center gap-1 border px-2 py-0.5 rounded text-[10px] font-medium flex-shrink-0 max-w-[180px] truncate ${lastContactColor(a.last_contact?.at)}`}
                          title={a.last_contact
                            ? `Last touched ${new Date(a.last_contact.at).toLocaleString()} by ${a.last_contact.by || '—'}${a.last_contact.preview ? ' · ' + a.last_contact.preview : ''}`
                            : 'No contact notes yet'}
                        >
                          {a.last_contact
                            ? `Touched ${relativeTime(a.last_contact.at)}${a.last_contact.by ? ' · ' + a.last_contact.by : ''}`
                            : 'Never touched'}
                        </span>
                        {a.last_email && (
                          <span
                            className={`hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${EMAIL_STATUS_COLORS[a.last_email.type] || 'bg-white/10 text-p-muted'}`}
                            title={`Last email ${a.last_email.type} ${new Date(a.last_email.at).toLocaleString()}`}
                          >
                            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="3" width="12" height="10" rx="1.5" /><path d="M2.5 4l5.5 4 5.5-4" /></svg>
                            {a.last_email.type}
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[a.status] || 'bg-p-border text-p-muted'}`}>
                          {a.status?.replace(/_/g, ' ')}
                        </span>
                        <span className="text-p-muted text-xs hidden sm:inline">{new Date(a.created_at).toLocaleDateString()}</span>
                      </button>
                    </div>

                    {/* Expanded Detail */}
                    {expanded === a.id && (
                      <div className="px-4 pb-4 border-t border-p-border pt-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {a.photo_url && (
                            <div>
                              <img src={a.photo_url} alt="Selfie" className="w-32 h-32 rounded-lg object-cover" />
                            </div>
                          )}
                          <div className="space-y-2 text-sm">
                            <Detail label="Phone" value={a.phone} />
                            <Detail label="Email" value={a.email} />
                            <Detail label="Zip" value={a.zip} />
                            <Detail label="Roles" value={a.roles?.join(', ')} />
                            <Detail label="Availability" value={a.availability?.join(', ')} />
                            <Detail label="Experience" value={a.experience_types?.join(', ')} />
                            <Detail label="Shift Windows" value={a.availability_windows?.join(', ')} />
                            <Detail label="Transportation" value={a.has_transportation} />
                            <Detail label="Short Notice" value={a.short_notice} />
                            {a.notes && <Detail label="Notes" value={a.notes} />}
                          </div>
                        </div>

                        {/* Hourly rate — the worker's default $/hr, used across timesheets & payroll */}
                        <PayRateEditor
                          worker={a}
                          onSaved={(rate) => setApplicants(prev => prev.map(x => x.id === a.id ? { ...x, pay_rate: rate } : x))}
                        />

                        {/* Reliability — show/no-show record */}
                        {(a.reliability?.pct != null || (a.reliability?.strikes || 0) > 0) && (
                          <div className="mt-3 bg-black/30 border border-p-border rounded-lg p-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-p-muted text-xs">Reliability</span>
                              <ReliabilityBadge reliability={a.reliability} />
                              <span className="text-p-muted text-[11px]">
                                {a.reliability.pct != null
                                  ? `Showed ${a.reliability.shows} of ${a.reliability.shows + a.reliability.no_shows} committed shift${(a.reliability.shows + a.reliability.no_shows) !== 1 ? 's' : ''}`
                                  : 'No completed shifts yet'}
                                {a.reliability.no_shows > 0 && ` · ${a.reliability.no_shows} no-show${a.reliability.no_shows !== 1 ? 's' : ''}`}
                                {a.reliability.strikes > 0 && ` · ${a.reliability.strikes} strike${a.reliability.strikes !== 1 ? 's' : ''}`}
                              </span>
                            </div>
                            {a.reliability.pct != null && a.reliability.pct < 70 && (
                              <p className="text-red-400/90 text-[11px] mt-1.5">Chronic no-show risk — consider removing or de-prioritizing for shifts.</p>
                            )}
                          </div>
                        )}

                        {/* Job history — events applied to / booked vs. worked */}
                        <JobHistory history={a.job_history} />

                        {/* Contact notes */}
                        <div className="mt-3 bg-black/30 border border-p-border rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-p-muted text-xs">Contact notes</span>
                            <span className="text-p-muted text-[10px]">
                              · stamped as <button onClick={editCoordinatorName} className="underline hover:text-white">{coordinatorName || 'set your name'}</button>
                            </span>
                          </div>
                          <div className="flex gap-2 mb-2">
                            <textarea
                              value={newNoteDraft}
                              onChange={e => setNewNoteDraft(e.target.value)}
                              placeholder="What did you discuss? Who did you reach? What's next?"
                              rows={2}
                              className="flex-1 bg-p-bg border border-p-border rounded px-2 py-1.5 text-xs text-white placeholder-p-muted focus:outline-none focus:border-p-link resize-none"
                            />
                            <button
                              onClick={() => addNote(a.id)}
                              disabled={savingNote || !newNoteDraft.trim()}
                              className="self-start px-3 py-1.5 rounded bg-p-green text-black text-xs font-semibold disabled:opacity-40 hover:opacity-90"
                            >{savingNote ? 'Saving…' : 'Add'}</button>
                          </div>
                          {(notesByWorker[a.id] && notesByWorker[a.id].length > 0) ? (
                            <ul className="space-y-1.5">
                              {notesByWorker[a.id].map(n => (
                                <li key={n.id} className="bg-p-bg/50 border border-p-border rounded px-2.5 py-1.5">
                                  <div className="flex items-center gap-2 text-[10px] text-p-muted mb-0.5">
                                    <span className="font-medium text-white">{n.author || '—'}</span>
                                    <span>· {new Date(n.created_at).toLocaleString()}</span>
                                    <span>· {relativeTime(n.created_at)}</span>
                                    <button
                                      onClick={() => removeNote(a.id, n.id)}
                                      className="ml-auto text-red-400 hover:text-red-300"
                                      title="Delete note"
                                    >×</button>
                                  </div>
                                  <div className="text-white text-xs whitespace-pre-wrap">{n.note}</div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-p-muted text-xs">No contact notes yet. Add the first one after you reach out.</p>
                          )}
                        </div>

                        {/* ID photo */}
                        <div className="mt-3 bg-black/30 border border-p-border rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-p-muted text-xs">Government ID</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${a.id_photo_url ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                              {a.id_photo_url ? 'Uploaded' : 'Not provided'}
                            </span>
                            <label className="ml-auto inline-flex items-center gap-1 text-[10px] text-p-green hover:text-white cursor-pointer">
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                disabled={uploadingIdFor === a.id}
                                onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  e.target.value = ''
                                  if (file) handleAdminUploadId(a.id, file)
                                }}
                              />
                              {uploadingIdFor === a.id
                                ? 'Uploading…'
                                : (a.id_photo_url ? 'Replace ID' : 'Upload ID')}
                            </label>
                          </div>
                          {a.id_photo_url ? (
                            <a href={a.id_photo_url} target="_blank" rel="noopener noreferrer" className="inline-block">
                              <img
                                src={a.id_photo_url}
                                alt="Government ID"
                                className="max-w-sm max-h-72 rounded-lg border border-p-border object-contain bg-black"
                              />
                              <div className="text-p-muted text-[10px] mt-1">Click to open full size</div>
                            </a>
                          ) : (
                            <p className="text-p-muted text-xs">No ID on file yet — use Upload ID to attach one yourself.</p>
                          )}
                        </div>

                        {/* W-9 details */}
                        {a.w9_signed_at && (
                          <div className="mt-3 bg-black/30 border border-p-border rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-p-muted text-xs">W-9 on file</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-green-500/20 text-green-400">Signed {new Date(a.w9_signed_at).toLocaleDateString()}</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
                              <Detail label="Legal name" value={a.w9_legal_name} />
                              {a.w9_business_name && <Detail label="Business" value={a.w9_business_name} />}
                              <Detail label="Tax class" value={a.w9_tax_class} />
                              <Detail label="TIN" value={a.w9_tin_last4 ? `••• •• ${a.w9_tin_last4}` : null} />
                              <Detail label="Address" value={[a.w9_address, a.w9_city, a.w9_state, a.w9_zip].filter(Boolean).join(', ')} />
                            </div>
                          </div>
                        )}

                        {/* Verification Video */}
                        {a.video_url ? (
                          <div className="mt-3">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-p-muted text-xs">Verification Video</span>
                              {a.video_verified ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-green-500/20 text-green-400">Verified</span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-yellow-500/20 text-yellow-400">Pending Review</span>
                              )}
                              {a.video_submitted_at && (
                                <span className="text-p-muted text-[10px]">{new Date(a.video_submitted_at).toLocaleDateString()}</span>
                              )}
                            </div>
                            <video
                              src={a.video_url}
                              controls
                              playsInline
                              className="w-full max-w-sm rounded-lg bg-black"
                              style={{ maxHeight: 300 }}
                            />
                            {!a.video_verified && (
                              <button
                                onClick={async () => {
                                  setUpdating(a.id)
                                  try {
                                    await updateApplicant(a.id, a.status, true)
                                    setApplicants(prev => prev.map(x => x.id === a.id ? { ...x, video_verified: true } : x))
                                  } catch (err) { console.error('Verify failed:', err) }
                                  setUpdating(null)
                                }}
                                disabled={updating === a.id}
                                className="mt-2 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50"
                              >
                                {updating === a.id ? '...' : 'Mark as Verified'}
                              </button>
                            )}
                          </div>
                        ) : a.status === 'approved' ? (
                          <div className="mt-3 bg-black/30 rounded-lg px-3 py-2">
                            <span className="text-p-muted text-xs">No verification video submitted yet</span>
                          </div>
                        ) : null}

                        {/* Score */}
                        {a.score_breakdown?.reasoning && (
                          <div className="mt-3 bg-black/30 rounded-lg px-3 py-2">
                            <span className="text-p-muted text-xs">Score: </span>
                            <span className="text-white text-xs">{a.score_breakdown.decision} ({a.score_breakdown.score}/10)</span>
                            <p className="text-p-muted text-xs mt-1">{a.score_breakdown.reasoning}</p>
                          </div>
                        )}

                        {/* Background Check Status */}
                        <div className="mt-3 bg-black/30 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-p-muted text-xs">BG Check:</span>
                            {a.bg_check_cleared ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-green-500/20 text-green-400">Cleared</span>
                            ) : a.bg_check_signed_at ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-yellow-500/20 text-yellow-400">Consent Sent</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-500/20 text-gray-400">Not Started</span>
                            )}
                            {a.bg_check_signed_at && !a.bg_check_cleared && (
                              <button
                                onClick={async () => {
                                  if (!confirm(`Mark ${a.first_name} ${a.last_name}'s background check as cleared?`)) return
                                  setUpdating(a.id)
                                  try {
                                    await editApplicant(a.id, { bg_check_cleared: true })
                                    setApplicants(prev => prev.map(x => x.id === a.id ? { ...x, bg_check_cleared: true } : x))
                                  } catch (err) { console.error('Mark cleared failed:', err) }
                                  setUpdating(null)
                                }}
                                disabled={updating === a.id}
                                className="px-2 py-0.5 rounded text-[10px] font-medium text-white bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-50"
                              >
                                Mark Cleared
                              </button>
                            )}
                            {a.bg_check_result_url && (
                              <a
                                href={a.bg_check_result_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-0.5 rounded text-[10px] font-medium text-blue-400 bg-blue-500/20 hover:bg-blue-500/30 transition-colors"
                              >
                                View Results
                              </a>
                            )}
                            {a.bg_check_signed_at && (
                              <label className="px-2 py-0.5 rounded text-[10px] font-medium text-white bg-p-border hover:bg-[#333] transition-colors cursor-pointer">
                                Upload Results
                                <input
                                  type="file"
                                  accept=".pdf,image/*"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0]
                                    if (!file) return
                                    setUpdating(a.id)
                                    try {
                                      const reader = new FileReader()
                                      reader.onload = async () => {
                                        await editApplicant(a.id, { bg_check_result_base64: reader.result })
                                        setApplicants(prev => prev.map(x => x.id === a.id ? { ...x, bg_check_result_url: 'uploaded' } : x))
                                        setUpdating(null)
                                      }
                                      reader.readAsDataURL(file)
                                    } catch (err) {
                                      console.error('Upload failed:', err)
                                      setUpdating(null)
                                    }
                                  }}
                                />
                              </label>
                            )}
                          </div>
                        </div>

                        {/* Worker Rating */}
                        <div className="mt-3 bg-black/30 rounded-lg px-3 py-2">
                          {a.avg_rating != null ? (
                            <div className="flex items-center gap-3 flex-wrap">
                              <div>
                                <span className="text-p-muted text-xs">Rating: </span>
                                <span className="text-white text-xs font-medium">{a.avg_rating}/5</span>
                                <span className="text-p-muted text-xs"> ({a.total_shifts} shift{a.total_shifts !== 1 ? 's' : ''})</span>
                                <span className="ml-1 text-yellow-400 text-xs">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    i < Math.round(a.avg_rating) ? '★' : '☆'
                                  )).join('')}
                                </span>
                              </div>
                              {a.would_hire_again_pct != null && (
                                <div>
                                  <span className="text-p-muted text-xs">Would hire again: </span>
                                  <span className={`text-xs font-medium ${a.would_hire_again_pct >= 75 ? 'text-green-400' : a.would_hire_again_pct >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                                    {a.would_hire_again_pct}%
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-p-muted text-xs">No ratings yet</span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 mt-4 flex-wrap">
                          {a.status === 'removed' ? (
                            <ActionBtn
                              label="Restore to Pool"
                              cls="bg-blue-600 hover:bg-blue-700"
                              loading={updating === a.id}
                              onClick={() => {
                                if (confirm(`Restore ${a.first_name} ${a.last_name} back to the worker pool?`)) {
                                  handleStatusChange(a.id, 'approved')
                                }
                              }}
                            />
                          ) : (
                            <>
                              {a.status !== 'approved' && a.status !== 'rejected' && (
                                <ActionBtn
                                  label="Approve"
                                  cls="bg-green-600 hover:bg-green-700"
                                  loading={updating === a.id}
                                  onClick={() => handleStatusChange(a.id, 'approved')}
                                />
                              )}
                              {a.status !== 'approved' && a.status !== 'rejected' && (
                                <ActionBtn
                                  label="Reject"
                                  cls="bg-red-600 hover:bg-red-700"
                                  loading={updating === a.id}
                                  onClick={() => handleStatusChange(a.id, 'rejected')}
                                />
                              )}
                              {a.status === 'approved' && (
                                <ActionBtn
                                  label="Revoke Approval"
                                  cls="bg-p-border hover:bg-[#333]"
                                  loading={updating === a.id}
                                  onClick={() => handleStatusChange(a.id, 'pending')}
                                />
                              )}
                              {a.status === 'rejected' && (
                                <ActionBtn
                                  label="Undo Rejection"
                                  cls="bg-p-border hover:bg-[#333]"
                                  loading={updating === a.id}
                                  onClick={() => handleStatusChange(a.id, 'pending')}
                                />
                              )}
                              {a.status !== 'rejected' && (
                                <ActionBtn
                                  label="Remove from Pool"
                                  cls="bg-red-900/50 hover:bg-red-900 border border-red-800/50"
                                  loading={updating === a.id}
                                  onClick={() => {
                                    if (confirm(`Remove ${a.first_name} ${a.last_name} from the worker pool? You can restore them later from the "removed" filter.`)) {
                                      handleStatusChange(a.id, 'removed')
                                    }
                                  }}
                                />
                              )}
                              {a.status !== 'needs_review' && a.status !== 'approved' && a.status !== 'rejected' && (
                                <ActionBtn
                                  label="Flag for Review"
                                  cls="bg-orange-600 hover:bg-orange-700"
                                  loading={updating === a.id}
                                  onClick={() => handleStatusChange(a.id, 'needs_review')}
                                />
                              )}
                            </>
                          )}
                          <ActionBtn
                            label="Edit"
                            cls="bg-p-border hover:bg-[#333]"
                            loading={false}
                            onClick={() => {
                              setEditing(a.id)
                              setEditForm({ first_name: a.first_name || '', last_name: a.last_name || '', email: a.email || '', phone: a.phone || '', city: a.city || '', zip: a.zip || '' })
                            }}
                          />
                          <ActionBtn
                            label="Message"
                            cls="bg-indigo-600 hover:bg-indigo-700"
                            loading={false}
                            onClick={() => { setMessagingWorker(a); setMsgText(''); setMsgChannel('both') }}
                          />
                          <ActionBtn
                            label="Reset PIN"
                            cls="bg-p-border hover:bg-[#333]"
                            loading={resettingPin === a.id}
                            onClick={() => handleResetPin(a)}
                          />
                          <ActionBtn
                            label="Delete"
                            cls="bg-red-900/50 hover:bg-red-900 border border-red-800/50"
                            loading={updating === a.id}
                            onClick={async () => {
                              if (confirm(`PERMANENTLY delete ${a.first_name} ${a.last_name}? This cannot be undone.`)) {
                                setUpdating(a.id)
                                try {
                                  await deleteApplicant(a.id)
                                  setApplicants(prev => prev.filter(x => x.id !== a.id))
                                } catch (err) { console.error('Delete failed:', err) }
                                setUpdating(null)
                              }
                            }}
                          />
                        </div>

                        {/* Edit Form */}
                        {editing === a.id && (
                          <div className="mt-3 bg-black/30 rounded-lg p-3">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                              {['first_name', 'last_name', 'email', 'phone', 'city', 'zip'].map(field => (
                                <div key={field}>
                                  <label className="text-p-muted text-[10px]">{field.replace(/_/g, ' ')}</label>
                                  <input
                                    type="text"
                                    value={editForm[field] || ''}
                                    onChange={e => setEditForm(f => ({ ...f, [field]: e.target.value }))}
                                    className="w-full bg-p-bg border border-p-border rounded px-2 py-1 text-xs text-white mt-0.5"
                                  />
                                </div>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={async () => {
                                  setUpdating(a.id)
                                  try {
                                    await editApplicant(a.id, editForm)
                                    setApplicants(prev => prev.map(x => x.id === a.id ? { ...x, ...editForm } : x))
                                    setEditing(null)
                                  } catch (err) { console.error('Edit failed:', err) }
                                  setUpdating(null)
                                }}
                                disabled={updating === a.id}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium text-black bg-p-green hover:opacity-90 disabled:opacity-50"
                              >
                                {updating === a.id ? 'Saving...' : 'Save'}
                              </button>
                              <button onClick={() => setEditing(null)} className="text-p-muted text-xs hover:text-white">Cancel</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Messaging Modal (Feature 10) */}
      {messagingWorker && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4" onClick={() => setMessagingWorker(null)}>
          <div className="bg-p-surface border border-p-border rounded-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-p-border flex items-center justify-between">
              <h3 className="text-white font-semibold text-sm">Message {messagingWorker.first_name} {messagingWorker.last_name}</h3>
              <button onClick={() => setMessagingWorker(null)} className="text-p-muted hover:text-white text-lg">×</button>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-p-muted text-[10px]">
                {messagingWorker.phone && <span>Phone: {messagingWorker.phone}</span>}
                {messagingWorker.phone && messagingWorker.email && <span> · </span>}
                {messagingWorker.email && <span>Email: {messagingWorker.email}</span>}
              </div>
              <select value={msgChannel} onChange={e => setMsgChannel(e.target.value)} className="w-full bg-p-bg border border-p-border rounded-lg px-3 py-1.5 text-xs text-white">
                <option value="both">SMS + Email</option>
                <option value="sms">SMS Only</option>
                <option value="email">Email Only</option>
              </select>
              <textarea
                value={msgText}
                onChange={e => setMsgText(e.target.value)}
                placeholder="Type your message..."
                rows={4}
                className="w-full bg-p-bg border border-p-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-p-muted focus:outline-none focus:border-p-link resize-none"
              />
              <button
                onClick={handleSendMessage}
                disabled={!msgText.trim() || sendingMsg}
                className="w-full bg-p-green text-black rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-all"
              >{sendingMsg ? 'Sending...' : 'Send Message'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Reliability signal derived from show/no-show history. Returns null for new workers
// with no accountable history and no strikes (nothing to show yet).
function reliabilityTone(pct) {
  if (pct == null) return { label: 'text-p-muted', chip: 'bg-white/5 text-p-muted border-p-border' }
  if (pct >= 90) return { label: 'text-green-400', chip: 'bg-green-500/15 text-green-400 border-green-500/30' }
  if (pct >= 70) return { label: 'text-yellow-400', chip: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' }
  return { label: 'text-red-400', chip: 'bg-red-500/15 text-red-400 border-red-500/30' }
}

function ReliabilityBadge({ reliability, compact }) {
  const r = reliability || {}
  const has = r.pct != null || (r.strikes || 0) > 0
  if (!has) return null
  const tone = reliabilityTone(r.pct)
  const title = r.pct != null
    ? `Reliability ${r.pct}% — showed ${r.shows} of ${r.shows + r.no_shows} committed shifts${r.no_shows ? ` · ${r.no_shows} no-show${r.no_shows !== 1 ? 's' : ''}` : ''}${r.strikes ? ` · ${r.strikes} strike${r.strikes !== 1 ? 's' : ''}` : ''}`
    : `${r.strikes} strike${r.strikes !== 1 ? 's' : ''} on file`
  return (
    <span
      className={`inline-flex items-center gap-1 border px-2 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${tone.chip}`}
      title={title}
    >
      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M8 1.5l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.9 4.2 13.9l.7-4.3-3.1-3 4.3-.6z" />
      </svg>
      {r.pct != null ? `${r.pct}%` : ''}
      {(r.strikes || 0) > 0 && <span className="text-red-400">{r.pct != null ? ' · ' : ''}{r.strikes}✕</span>}
      {!compact && r.no_shows > 0 && <span className="opacity-80">· {r.no_shows} NS</span>}
    </span>
  )
}

const IconBriefcase = () => (
  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-shrink-0">
    <rect x="2" y="5" width="12" height="8" rx="1.5" />
    <path d="M6 5V3.5A1.5 1.5 0 0 1 7.5 2h1A1.5 1.5 0 0 1 10 3.5V5" />
    <path d="M2 8h12" />
  </svg>
)

function jobSummaryDate(d) {
  if (!d) return ''
  const dt = new Date(`${d}T00:00:00`)
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// Compact one-line job summary shown on the collapsed worker row.
function JobSummaryLine({ history }) {
  const list = history || []
  const worked = list.filter(j => j.worked)
  const upcoming = list.filter(j => !j.worked)

  let text, tone
  if (worked.length > 0) {
    const last = worked[0] // sorted newest-first
    text = `${worked.length} shift${worked.length !== 1 ? 's' : ''} · last: ${last.title || 'event'}${last.event_date ? ` (${jobSummaryDate(last.event_date)})` : ''}`
    tone = 'text-green-400/90'
  } else if (upcoming.length > 0) {
    const next = upcoming[upcoming.length - 1] // oldest of upcoming = soonest
    text = `Booked: ${next.title || 'event'}${next.event_date ? ` (${jobSummaryDate(next.event_date)})` : ''} · no past shifts`
    tone = 'text-purple-300/90'
  } else {
    text = 'New · no shifts yet'
    tone = 'text-p-muted'
  }

  return (
    <div className={`flex items-center gap-1 text-[11px] truncate mt-0.5 ${tone}`}>
      <IconBriefcase />
      <span className="truncate">{text}</span>
    </div>
  )
}

function JobHistory({ history }) {
  const list = history || []
  const worked = list.filter(j => j.worked)
  const upcoming = list.filter(j => !j.worked)
  const fmtDate = (d) => d ? new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'No date'

  const Row = ({ j }) => (
    <li className="flex items-center gap-2 bg-p-bg/50 border border-p-border rounded px-2.5 py-1.5">
      <div className="flex-1 min-w-0">
        <div className="text-white text-xs font-medium truncate">
          {j.title || 'Untitled event'}
          {j.is_supervisor && <span className="ml-1.5 text-[9px] text-purple-300 align-middle">SUPERVISOR</span>}
        </div>
        <div className="text-p-muted text-[10px] truncate">
          {fmtDate(j.event_date)}{j.city ? ` · ${j.city}` : ''}
          {j.worked && j.hours_worked != null ? ` · ${j.hours_worked} hrs` : ''}
        </div>
      </div>
      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-p-muted flex-shrink-0 capitalize">
        {(j.assign_status || '').replace(/_/g, ' ')}
      </span>
    </li>
  )

  return (
    <div className="mt-3 bg-black/30 border border-p-border rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-p-muted text-xs">Job history</span>
        <span className="text-p-muted text-[10px]">· {worked.length} worked · {upcoming.length} upcoming/applied</span>
      </div>
      {list.length === 0 ? (
        <p className="text-p-muted text-xs">No events yet — this worker hasn't been assigned to any job.</p>
      ) : (
        <div className="space-y-3">
          {upcoming.length > 0 && (
            <div>
              <div className="text-p-muted text-[10px] uppercase tracking-wider mb-1">Upcoming / Applied</div>
              <ul className="space-y-1">{upcoming.map((j, i) => <Row key={'u' + i} j={j} />)}</ul>
            </div>
          )}
          {worked.length > 0 && (
            <div>
              <div className="text-p-muted text-[10px] uppercase tracking-wider mb-1">Worked</div>
              <ul className="space-y-1">{worked.map((j, i) => <Row key={'w' + i} j={j} />)}</ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PayRateEditor({ worker, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(worker.pay_rate ?? '')
  const [saving, setSaving] = useState(false)
  const rate = worker.pay_rate

  const save = async () => {
    setSaving(true)
    try {
      const clean = val === '' ? null : parseFloat(val)
      await editApplicant(worker.id, { pay_rate: clean })
      onSaved(clean)
      setEditing(false)
    } catch (e) { alert('Failed to save rate: ' + e.message) }
    setSaving(false)
  }

  return (
    <div className="mt-3 bg-black/30 border border-p-border rounded-lg px-3 py-2 flex items-center gap-2 flex-wrap">
      <span className="text-p-muted text-xs">Hourly rate</span>
      {editing ? (
        <>
          <span className="text-p-muted text-sm">$</span>
          <input
            type="number" step="0.01" min="0" autoFocus
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save() }}
            className="w-24 bg-p-bg border border-p-border rounded px-2 py-1 text-sm text-white"
            placeholder="e.g. 15"
          />
          <span className="text-p-muted text-xs">/hr</span>
          <button onClick={save} disabled={saving} className="ml-1 px-2.5 py-1 rounded bg-p-green text-black text-xs font-semibold disabled:opacity-50">{saving ? '…' : 'Save'}</button>
          <button onClick={() => { setEditing(false); setVal(worker.pay_rate ?? '') }} className="text-p-muted text-xs hover:text-white">Cancel</button>
        </>
      ) : (
        <>
          <span className={`text-sm font-medium ${rate != null ? 'text-white' : 'text-p-muted'}`}>
            {rate != null ? `$${rate}/hr` : 'Not set'}
          </span>
          <button onClick={() => { setEditing(true); setVal(worker.pay_rate ?? '') }} className="text-p-link text-xs hover:text-white ml-1">{rate != null ? 'Edit' : 'Set rate'}</button>
          <span className="text-p-muted text-[10px] ml-auto">Applies on timesheets &amp; payroll unless overridden</span>
        </>
      )}
    </div>
  )
}

function MiniStat({ label, value, color = 'text-white' }) {
  return (
    <div className="flex-shrink-0">
      <span className={`text-sm font-bold ${color}`}>{value}</span>
      <span className="text-p-muted text-[10px] ml-1">{label}</span>
    </div>
  )
}

function Detail({ label, value }) {
  if (!value) return null
  return (
    <div>
      <span className="text-p-muted">{label}: </span>
      <span className="text-white">{value}</span>
    </div>
  )
}

function ActionBtn({ label, cls, loading, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors disabled:opacity-50 ${cls}`}
    >
      {loading ? '...' : label}
    </button>
  )
}
