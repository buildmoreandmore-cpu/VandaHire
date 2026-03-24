import { useState, useEffect, useMemo } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  fetchGroups, createGroup, updateGroup, deleteGroup,
  fetchGroupMembers, updateGroupMembers,
  fetchApplicants, createAssignments, fetchEvents,
} from '../../lib/adminApi.js'

const SITE_URL = 'https://vandahire.com'

export default function WorkerGroupsPanel() {
  const [expanded, setExpanded] = useState(false)
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(false)
  const [subTab, setSubTab] = useState('crew')
  const [showCreate, setShowCreate] = useState(false)
  const [editingMembers, setEditingMembers] = useState(null) // group object
  const [members, setMembers] = useState([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [allWorkers, setAllWorkers] = useState([])
  const [workerSearch, setWorkerSearch] = useState('')
  const [qrVisible, setQrVisible] = useState({}) // { [groupId]: bool }
  const [assignEvent, setAssignEvent] = useState({}) // { [groupId]: eventId }
  const [events, setEvents] = useState([])
  const [assigning, setAssigning] = useState(null)

  // Create form
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('crew')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await fetchGroups()
      setGroups(data || [])
    } catch (err) {
      console.error('Failed to load groups:', err)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (expanded) load()
  }, [expanded])

  const filtered = useMemo(() =>
    groups.filter(g => g.type === subTab && !g.archived),
    [groups, subTab]
  )

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      await createGroup({ name: newName.trim(), type: newType, description: newDesc.trim() })
      setNewName('')
      setNewDesc('')
      setShowCreate(false)
      await load()
    } catch (err) {
      alert('Failed to create group: ' + err.message)
    }
    setCreating(false)
  }

  const handleDelete = async (group) => {
    if (!confirm(`Delete "${group.name}"? Members will be unlinked but workers won't be deleted.`)) return
    try {
      await deleteGroup(group.id)
      await load()
    } catch (err) {
      alert('Failed to delete: ' + err.message)
    }
  }

  const handleArchive = async (group) => {
    try {
      await updateGroup(group.id, { archived: true })
      await load()
    } catch (err) {
      alert('Failed to archive: ' + err.message)
    }
  }

  // Edit members
  const openEditMembers = async (group) => {
    setEditingMembers(group)
    setMembersLoading(true)
    setWorkerSearch('')
    try {
      const [m, w] = await Promise.all([
        fetchGroupMembers(group.id),
        fetchApplicants('approved'),
      ])
      setMembers(m || [])
      setAllWorkers(w || [])
    } catch (err) {
      console.error('Failed to load members:', err)
    }
    setMembersLoading(false)
  }

  const handleRemoveMember = async (workerId) => {
    if (!editingMembers) return
    try {
      await updateGroupMembers(editingMembers.id, [workerId], 'remove')
      setMembers(prev => prev.filter(m => m.worker_id !== workerId))
    } catch (err) {
      alert('Failed to remove: ' + err.message)
    }
  }

  const handleAddMember = async (workerId) => {
    if (!editingMembers) return
    try {
      await updateGroupMembers(editingMembers.id, [workerId], 'add')
      const worker = allWorkers.find(w => w.id === workerId)
      if (worker) setMembers(prev => [...prev, { worker_id: workerId, ...worker }])
    } catch (err) {
      alert('Failed to add: ' + err.message)
    }
  }

  const memberIds = useMemo(() => new Set(members.map(m => m.worker_id)), [members])

  const filteredWorkers = useMemo(() => {
    if (!workerSearch.trim()) return []
    const q = workerSearch.toLowerCase()
    return allWorkers
      .filter(w => !memberIds.has(w.id))
      .filter(w =>
        `${w.first_name} ${w.last_name}`.toLowerCase().includes(q) ||
        (w.city || '').toLowerCase().includes(q)
      )
      .slice(0, 10)
  }, [allWorkers, memberIds, workerSearch])

  // Assign crew to event
  const handleAssignToEvent = async (group) => {
    const eventId = assignEvent[group.id]
    if (!eventId) return alert('Select an event first')
    setAssigning(group.id)
    try {
      const m = await fetchGroupMembers(group.id)
      const workerIds = (m || []).map(x => x.worker_id).filter(Boolean)
      if (!workerIds.length) { alert('No members in this group'); setAssigning(null); return }
      await createAssignments(eventId, workerIds)
      alert(`Assigned ${workerIds.length} workers to event`)
    } catch (err) {
      alert('Failed to assign: ' + err.message)
    }
    setAssigning(null)
  }

  // Load events for assign dropdown
  useEffect(() => {
    if (expanded && subTab === 'crew') {
      fetchEvents().then(e => setEvents(e || [])).catch(() => {})
    }
  }, [expanded, subTab])

  const copyLink = (code) => {
    navigator.clipboard.writeText(`${SITE_URL}/join/${code}`)
    alert('Link copied!')
  }

  return (
    <div className="mb-6 border border-p-border rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 bg-p-surface hover:bg-p-surface/80 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-white font-medium text-sm">Worker Groups</span>
          <span className="text-p-muted text-xs">({groups.length})</span>
        </div>
        <div className="flex items-center gap-2">
          {expanded && (
            <span
              onClick={(e) => { e.stopPropagation(); setShowCreate(true) }}
              className="text-xs bg-p-green text-black px-3 py-1 rounded font-medium hover:bg-p-green/90 cursor-pointer"
            >
              Create Group
            </span>
          )}
          <span className="text-p-muted text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4">
          {/* Sub-tabs */}
          <div className="flex gap-1 mt-3 mb-4">
            {['crew', 'recruitment'].map(t => (
              <button
                key={t}
                onClick={() => setSubTab(t)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  subTab === t
                    ? 'bg-p-green text-black'
                    : 'text-p-muted hover:text-white bg-p-surface'
                }`}
              >
                {t === 'crew' ? 'Crews' : 'Recruitment'}
              </button>
            ))}
          </div>

          {loading && <p className="text-p-muted text-xs">Loading...</p>}

          {!loading && filtered.length === 0 && (
            <p className="text-p-muted text-xs">No {subTab} groups yet. Create one above.</p>
          )}

          {/* Group cards */}
          <div className="space-y-3">
            {filtered.map(g => (
              <div key={g.id} className="border border-p-border rounded-lg p-3 bg-p-surface/50">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="text-white text-sm font-medium">{g.name}</h4>
                    {g.description && <p className="text-p-muted text-xs mt-0.5">{g.description}</p>}
                    <p className="text-p-muted text-[10px] mt-1">
                      {g.member_count} member{g.member_count !== 1 ? 's' : ''} · {new Date(g.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEditMembers(g)} className="text-xs text-p-muted hover:text-white px-2 py-1 border border-p-border rounded">
                      Edit Members
                    </button>
                    <button onClick={() => handleArchive(g)} className="text-xs text-p-muted hover:text-yellow-400 px-2 py-1 border border-p-border rounded">
                      Archive
                    </button>
                    <button onClick={() => handleDelete(g)} className="text-xs text-p-muted hover:text-red-400 px-2 py-1 border border-p-border rounded">
                      Delete
                    </button>
                  </div>
                </div>

                {/* Crew-specific: Assign to Event */}
                {g.type === 'crew' && (
                  <div className="flex items-center gap-2 mt-2">
                    <select
                      value={assignEvent[g.id] || ''}
                      onChange={(e) => setAssignEvent(prev => ({ ...prev, [g.id]: e.target.value }))}
                      className="flex-1 bg-[#0a0a0a] border border-p-border rounded text-white text-xs px-2 py-1.5"
                    >
                      <option value="">Assign to Event...</option>
                      {events.filter(ev => ev.status !== 'cancelled' && ev.status !== 'completed').map(ev => (
                        <option key={ev.id} value={ev.id}>{ev.name} — {ev.event_date}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleAssignToEvent(g)}
                      disabled={assigning === g.id}
                      className="text-xs bg-p-green text-black px-3 py-1.5 rounded font-medium hover:bg-p-green/90 disabled:opacity-50"
                    >
                      {assigning === g.id ? 'Assigning...' : 'Assign'}
                    </button>
                  </div>
                )}

                {/* Recruitment-specific: Share link + QR */}
                {g.type === 'recruitment' && (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-[11px] text-p-muted bg-[#0a0a0a] px-2 py-1.5 rounded border border-p-border truncate">
                        {SITE_URL}/join/{g.code}
                      </code>
                      <button
                        onClick={() => copyLink(g.code)}
                        className="text-xs text-p-muted hover:text-white px-2 py-1 border border-p-border rounded whitespace-nowrap"
                      >
                        Copy
                      </button>
                      <button
                        onClick={() => setQrVisible(prev => ({ ...prev, [g.id]: !prev[g.id] }))}
                        className="text-xs text-p-muted hover:text-white px-2 py-1 border border-p-border rounded whitespace-nowrap"
                      >
                        {qrVisible[g.id] ? 'Hide QR' : 'Show QR'}
                      </button>
                    </div>
                    {qrVisible[g.id] && (
                      <div className="flex justify-center py-3 bg-white rounded-lg">
                        <QRCodeSVG
                          value={`${SITE_URL}/join/${g.code}`}
                          size={160}
                          level="M"
                          includeMargin
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-[#141414] border border-p-border rounded-xl p-5 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-medium mb-4">Create Worker Group</h3>
            <div className="space-y-3">
              <div>
                <label className="text-p-muted text-xs block mb-1">Name</label>
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. ATL A-Team or Spring 2026 Hiring"
                  className="w-full bg-[#0a0a0a] border border-p-border rounded px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-p-muted text-xs block mb-1">Type</label>
                <select
                  value={newType}
                  onChange={e => setNewType(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-p-border rounded px-3 py-2 text-white text-sm"
                >
                  <option value="crew">Crew (Reusable team)</option>
                  <option value="recruitment">Recruitment (Share link)</option>
                </select>
              </div>
              <div>
                <label className="text-p-muted text-xs block mb-1">Description (optional)</label>
                <textarea
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  rows={2}
                  className="w-full bg-[#0a0a0a] border border-p-border rounded px-3 py-2 text-white text-sm resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowCreate(false)} className="text-p-muted text-sm px-4 py-2 hover:text-white">Cancel</button>
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="bg-p-green text-black text-sm font-medium px-4 py-2 rounded hover:bg-p-green/90 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Members Modal */}
      {editingMembers && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setEditingMembers(null)}>
          <div className="bg-[#141414] border border-p-border rounded-xl p-5 w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-medium mb-1">Members — {editingMembers.name}</h3>
            <p className="text-p-muted text-xs mb-4">{members.length} member{members.length !== 1 ? 's' : ''}</p>

            {membersLoading ? (
              <p className="text-p-muted text-xs">Loading...</p>
            ) : (
              <>
                {/* Search to add */}
                <div className="mb-3">
                  <input
                    value={workerSearch}
                    onChange={e => setWorkerSearch(e.target.value)}
                    placeholder="Search approved workers to add..."
                    className="w-full bg-[#0a0a0a] border border-p-border rounded px-3 py-2 text-white text-sm"
                  />
                  {filteredWorkers.length > 0 && (
                    <div className="mt-1 border border-p-border rounded bg-[#0a0a0a] max-h-32 overflow-y-auto">
                      {filteredWorkers.map(w => (
                        <button
                          key={w.id}
                          onClick={() => { handleAddMember(w.id); setWorkerSearch('') }}
                          className="w-full text-left px-3 py-1.5 text-xs text-white hover:bg-p-surface flex items-center gap-2"
                        >
                          {w.photo_url && <img src={w.photo_url} className="w-5 h-5 rounded-full object-cover" />}
                          <span>{w.first_name} {w.last_name}</span>
                          <span className="text-p-muted ml-auto">{w.city}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Current members */}
                <div className="flex-1 overflow-y-auto space-y-1">
                  {members.map(m => (
                    <div key={m.worker_id} className="flex items-center justify-between px-3 py-2 bg-p-surface/50 rounded">
                      <div className="flex items-center gap-2">
                        {m.photo_url && <img src={m.photo_url} className="w-6 h-6 rounded-full object-cover" />}
                        <span className="text-white text-xs">{m.first_name} {m.last_name}</span>
                        <span className="text-p-muted text-[10px]">{m.city}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          m.status === 'approved' ? 'bg-green-900/50 text-green-400' : 'bg-yellow-900/50 text-yellow-400'
                        }`}>{m.status}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveMember(m.worker_id)}
                        className="text-red-400 hover:text-red-300 text-xs"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {members.length === 0 && (
                    <p className="text-p-muted text-xs text-center py-4">No members yet. Search above to add workers.</p>
                  )}
                </div>
              </>
            )}

            <div className="flex justify-end mt-4">
              <button onClick={() => setEditingMembers(null)} className="text-sm text-p-muted hover:text-white px-4 py-2">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
