// Text-from lines available when creating/editing an event. The chosen number is
// what a worker sees and replies to, so route each event to the right employee.
// Edit labels/numbers here as your team changes.
export const SENDER_NUMBERS = [
  { label: 'V&A Hire (main)', number: '+14049057443' },
  { label: 'G', number: '+14708008363' },
  { label: 'Laverne', number: '+16785590161' },
]

export function senderLabel(number) {
  if (!number) return 'V&A Hire (main)'
  const digits = String(number).replace(/\D/g, '')
  const match = SENDER_NUMBERS.find(s => s.number.replace(/\D/g, '') === digits)
  return match ? match.label : number
}

export function formatSenderNumber(number) {
  const d = String(number || '').replace(/\D/g, '').replace(/^1/, '')
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : number
}
