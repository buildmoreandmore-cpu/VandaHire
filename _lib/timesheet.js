import * as XLSX from 'xlsx'

// Where finished timesheets + P&L go. Both addresses receive every send.
export const OFFICE_EMAILS = ['feryvarist2@gmail.com', 'info@vassoc.com']

// Build an .xlsx (base64) mirroring the V&A timesheet: one sheet per day plus a
// Summary sheet totalling hours per worker across all days.
// payload = { company, event, associate_signature, days: [{ date, rows:[{name,start_time,end_time,total_hours}] }] }
export function buildTimesheetXlsxBase64(payload) {
  const wb = XLSX.utils.book_new()
  const company = payload.company || ''
  const event = payload.event || ''
  const sig = payload.associate_signature || ''

  const perWorker = {} // name -> total hours across days
  let usedNames = new Set()

  payload.days.forEach((day, di) => {
    const rows = day.rows || []
    const aoa = []
    aoa.push(['Varist & Associates'])
    aoa.push(['Company:', company])
    aoa.push(['Event:', event])
    aoa.push(['Date:', day.date || ''])
    aoa.push([])
    aoa.push(['#', 'Name', 'Start Time', 'End Time', 'Total Hours'])
    let dayTotal = 0
    rows.forEach((r, i) => {
      const h = num(r.total_hours)
      dayTotal += h
      if (r.name) { perWorker[r.name] = (perWorker[r.name] || 0) + h; usedNames.add(r.name) }
      aoa.push([i + 1, r.name || '', r.start_time || '', r.end_time || '', h || ''])
    })
    aoa.push(['', '', '', 'Total Hours', round(dayTotal)])
    aoa.push([])
    aoa.push(['Company signature:', ''])
    aoa.push(['Varist & Associates signature:', sig])
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = [{ wch: 6 }, { wch: 26 }, { wch: 12 }, { wch: 12 }, { wch: 12 }]
    const name = (day.date || `Day ${di + 1}`).replace(/[\\/?*[\]:]/g, '-').slice(0, 28)
    XLSX.utils.book_append_sheet(wb, ws, name || `Day ${di + 1}`)
  })

  // Summary sheet — per-worker totals across all days
  if (payload.days.length > 1) {
    const s = []
    s.push(['Varist & Associates — Summary'])
    s.push(['Company:', company])
    s.push(['Event:', event])
    s.push(['Days:', payload.days.map(d => d.date).filter(Boolean).join(', ')])
    s.push([])
    s.push(['#', 'Name', 'Total Hours (all days)'])
    let grand = 0
    ;[...usedNames].sort().forEach((n, i) => { const h = round(perWorker[n]); grand += h; s.push([i + 1, n, h]) })
    s.push(['', 'Grand Total', round(grand)])
    const ws = XLSX.utils.aoa_to_sheet(s)
    ws['!cols'] = [{ wch: 6 }, { wch: 26 }, { wch: 20 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Summary')
  }

  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' })
}

// A one-sheet P&L workbook for the office (net after labor + expenses).
// p = { event, company, hours, worker_count, revenue, labor, expenses:[{description,amount}], net, margin }
export function buildProfitXlsxBase64(p) {
  const wb = XLSX.utils.book_new()
  const aoa = []
  aoa.push(['Varist & Associates — Profit / Net'])
  aoa.push(['Event:', p.event || ''])
  if (p.company) aoa.push(['Company:', p.company])
  aoa.push(['Hours worked:', round(num(p.hours))])
  if (p.worker_count) aoa.push(['Workers:', p.worker_count])
  aoa.push([])
  aoa.push(['Revenue', round(num(p.revenue))])
  aoa.push(['Labor', -round(num(p.labor))])
  aoa.push([])
  aoa.push(['Expenses', ''])
  let expTotal = 0
  for (const e of (p.expenses || [])) { const a = num(e.amount); expTotal += a; aoa.push(['  ' + (e.description || '(expense)'), -round(a)]) }
  aoa.push(['Expenses total', -round(expTotal)])
  aoa.push([])
  aoa.push(['NET', round(num(p.net))])
  aoa.push(['Margin %', p.margin != null ? p.margin : ''])
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [{ wch: 28 }, { wch: 16 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Profit')
  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' })
}

export function timesheetTotals(payload) {
  let grand = 0
  const perDay = payload.days.map(d => {
    const t = round((d.rows || []).reduce((a, r) => a + num(r.total_hours), 0))
    grand += t
    return { date: d.date, total: t, workers: (d.rows || []).length }
  })
  return { perDay, grand: round(grand) }
}

function num(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : 0 }
function round(n) { return Math.round(n * 10) / 10 }
