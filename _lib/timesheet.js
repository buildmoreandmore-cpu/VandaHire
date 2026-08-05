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

  const anyRate = payload.days.some(d => (d.rows || []).some(r => num(r.pay_rate) > 0))
  payload.days.forEach((day, di) => {
    const rows = day.rows || []
    const aoa = []
    aoa.push(['Varist & Associates'])
    aoa.push(['Company:', company])
    aoa.push(['Event:', event])
    aoa.push(['Date:', day.date || ''])
    aoa.push([])
    aoa.push(['#', 'Name', 'Start Time', 'End Time', 'Break (min)', 'Total Hours', ...(anyRate ? ['Rate', 'Pay'] : [])])
    let dayTotal = 0, dayPay = 0
    rows.forEach((r, i) => {
      const h = num(r.total_hours)
      const rate = num(r.pay_rate)
      const pay = Math.round(h * rate * 100) / 100
      dayTotal += h; dayPay += pay
      if (r.name) { perWorker[r.name] = (perWorker[r.name] || 0) + h; usedNames.add(r.name) }
      aoa.push([i + 1, r.name || '', r.start_time || '', r.end_time || '', num(r.break_minutes) || '', h || '', ...(anyRate ? [rate || '', pay || ''] : [])])
    })
    aoa.push(['', '', '', '', 'Total Hours', round(dayTotal), ...(anyRate ? ['', round(dayPay)] : [])])
    aoa.push([])
    aoa.push(['Company signature:', ''])
    aoa.push(['Varist & Associates signature:', sig])
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = [{ wch: 6 }, { wch: 26 }, { wch: 12 }, { wch: 12 }, { wch: 11 }, { wch: 12 }, ...(anyRate ? [{ wch: 8 }, { wch: 10 }] : [])]
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

// Master payroll grid: one row per worker, a column per date, then Hours,
// Pay Rate, Payout, Paid — plus a totals row. Mirrors the office spreadsheet.
// p = { event, dates:[], rows:[{ name, byDate:{date:hrs}, hours, pay_rate, payout, paid }] }
export function buildPayrollXlsxBase64(p) {
  const wb = XLSX.utils.book_new()
  const dates = p.dates || []
  const header = ['First and Last Name', ...dates, 'Hours', 'Pay Rate', 'Payout', 'Paid']
  const aoa = [header]
  const dayTotals = dates.map(() => 0)
  let totHours = 0, totPayout = 0
  for (const r of (p.rows || [])) {
    const cells = dates.map((d, i) => { const v = num(r.byDate?.[d]); dayTotals[i] += v; return v || '' })
    totHours += num(r.hours); totPayout += num(r.payout)
    aoa.push([r.name, ...cells, round(num(r.hours)), r.pay_rate != null ? num(r.pay_rate) : '', r.payout != null ? round(num(r.payout)) : '', r.paid ? 'Paid' : ''])
  }
  aoa.push(['TOTAL', ...dayTotals.map(v => round(v)), round(totHours), '', round(totPayout), ''])
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [{ wch: 24 }, ...dates.map(() => ({ wch: 8 })), { wch: 8 }, { wch: 9 }, { wch: 10 }, { wch: 8 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Payroll')
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
