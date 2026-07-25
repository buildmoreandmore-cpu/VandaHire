import { useState } from 'react'
import TimesheetCapture from '../TimesheetCapture.jsx'
import { parseTimesheet, submitTimesheetAdmin } from '../../lib/adminApi.js'

export default function TimesheetsPanel() {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <div className="bg-p-surface border border-p-border rounded-lg p-5">
        <h3 className="text-white text-sm font-semibold mb-1">Timesheets</h3>
        <p className="text-p-muted text-xs mb-4 max-w-xl">
          Scan a handwritten timesheet — it's transcribed automatically, you review and fix anything, sign off, then it's
          emailed to <span className="text-white">info@vassoc.com</span> as an Excel file. Multi-day events are supported
          (add a photo per day; hours are totaled with a summary sheet).
        </p>
        <button onClick={() => setOpen(true)} className="px-4 py-2 rounded-lg bg-p-green text-black text-xs font-semibold hover:opacity-90">+ New Timesheet</button>
      </div>
      {open && (
        <TimesheetCapture
          title="New Timesheet"
          parseImage={(base64) => parseTimesheet(base64)}
          submitTimesheet={(payload) => submitTimesheetAdmin(payload)}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
