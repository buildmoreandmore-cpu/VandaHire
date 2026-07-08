import { useState, useRef } from 'react'
import ProgressBar from './ProgressBar.jsx'
import VandaLogo from './VandaLogo.jsx'

const ROLES = [
  { value: 'janitorial', label: 'Janitorial' },
  { value: 'cleanup', label: 'Cleanup' },
  { value: 'setup_breakdown', label: 'Setup & Breakdown' },
  { value: 'brand_activation', label: 'Brand Activation' },
  { value: 'general_labor', label: 'General Labor' },
]

const AVAILABILITY = [
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekends', label: 'Weekends' },
  { value: 'on_call', label: 'On-Call' },
]

const EXPERIENCE_TYPES = [
  { value: 'event_staffing', label: 'Event Staffing' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'food_service', label: 'Food Service' },
  { value: 'retail', label: 'Retail' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'moving', label: 'Moving / Labor' },
  { value: 'security', label: 'Security' },
  { value: 'none', label: 'No Experience Yet' },
]

const AVAILABILITY_WINDOWS = [
  { value: 'morning', label: 'Mornings (6a–12p)' },
  { value: 'afternoon', label: 'Afternoons (12–5p)' },
  { value: 'evening', label: 'Evenings (5–10p)' },
  { value: 'overnight', label: 'Overnight (10p–6a)' },
  { value: 'flexible', label: 'Flexible / Any' },
]

const SHORT_NOTICE_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'sometimes', label: 'Sometimes' },
  { value: 'no', label: 'No' },
]

function compressImage(file, maxDim = 800, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          } else {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        resolve(dataUrl)
      }
      img.onerror = reject
      img.src = e.target.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function PhotoUpload({ value, onChange, error }) {
  const inputRef = useRef(null)
  const [loading, setLoading] = useState(false)

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    try {
      const compressed = await compressImage(file)
      onChange(compressed)
    } catch {
      onChange(null)
    } finally {
      setLoading(false)
    }
  }

  const remove = () => {
    onChange(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-widest text-[#888] mb-2">
        Quick Selfie
      </label>
      <p className="text-[#555] text-xs mb-3">So we know who to look for. Snap a photo or upload one.</p>

      {value ? (
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[#ffffff] flex-shrink-0">
            <img src={value} alt="Selfie preview" className="w-full h-full object-cover" />
          </div>
          <button
            type="button"
            onClick={remove}
            className="text-[#888] text-sm underline hover:text-white transition-colors cursor-pointer"
          >
            Retake
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className="w-20 h-20 rounded-full border-2 border-dashed border-[#333] hover:border-[#ffffff] flex items-center justify-center transition-all duration-200 cursor-pointer"
        >
          {loading ? (
            <svg className="w-6 h-6 animate-spin text-[#888]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-8 h-8 text-[#555]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
            </svg>
          )}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
      {error && <p className="text-[#ff4444] text-xs mt-1">{error}</p>}
    </div>
  )
}

function formatPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

function PillToggle({ options, selected, onChange }) {
  const toggle = (val) => {
    if (selected.includes(val)) {
      onChange(selected.filter(v => v !== val))
    } else {
      onChange([...selected, val])
    }
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => {
        const active = selected.includes(opt.value)
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 cursor-pointer
              ${active
                ? 'border-[#ffffff] bg-[#ffffff]/10 text-[#ffffff]'
                : 'border-[#333] text-[#888] hover:border-[#555]'
              }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function SingleSelect({ options, selected, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => {
        const active = selected === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 cursor-pointer
              ${active
                ? 'border-[#ffffff] bg-[#ffffff]/10 text-[#ffffff]'
                : 'border-[#333] text-[#888] hover:border-[#555]'
              }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function Field({ label, error, children }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-widest text-[#888] mb-2">
        {label}
      </label>
      {children}
      {error && <p className="text-[#ff4444] text-xs mt-1">{error}</p>}
    </div>
  )
}

export default function BasicInfoForm({ formData, onChange, onSubmit, submitting, submitError, onBack, bgCheckRequired = false }) {
  const [errors, setErrors] = useState({})
  const [section, setSection] = useState(1) // Progressive disclosure: 1 = basics, 2 = screening

  const set = (field, value) => {
    onChange(prev => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }))
  }

  const validate = () => {
    const e = {}
    if (!formData.first_name.trim()) e.first_name = 'Required'
    if (!formData.last_name.trim()) e.last_name = 'Required'
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      e.email = 'Enter a valid email'
    }
    const phoneDigits = formData.phone.replace(/\D/g, '')
    if (phoneDigits.length < 10) e.phone = 'Enter a 10-digit US phone number'
    if (!formData.city.trim()) e.city = 'Required'
    if (!formData.zip.trim() || !/^\d{5}$/.test(formData.zip)) e.zip = 'Enter a valid 5-digit zip'
    if (formData.roles.length === 0) e.roles = 'Select at least one role'
    if (formData.availability.length === 0) e.availability = 'Select at least one option'
    if (formData.experience_types.length === 0) e.experience_types = 'Select at least one'
    if (formData.availability_windows.length === 0) e.availability_windows = 'Select at least one'
    if (!formData.has_transportation) e.has_transportation = 'Required'
    if (!formData.short_notice) e.short_notice = 'Required'
    if (!formData.photo) e.photo = 'Please add a photo'
    return e
  }

  const handleSubmit = () => {
    const e = validate()
    if (Object.keys(e).length > 0) {
      setErrors(e)
      return
    }
    onSubmit()
  }

  const inputClass = (field) =>
    `w-full bg-[#141414] border rounded-xl px-4 py-3 text-white text-base focus:outline-none focus:ring-2 focus:ring-[#ffffff] placeholder-[#555] transition-all duration-200 ${
      errors[field] ? 'border-[#ff4444]' : 'border-[#222]'
    }`

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      <ProgressBar step={1} total={2} />

      <div className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <VandaLogo size="sm" />
            <p className="text-[#555] text-xs mt-1">Step 1 of 2</p>
          </div>
          {onBack && (
            <button onClick={onBack} className="text-[#555] text-sm hover:text-white transition-colors">← Back</button>
          )}
        </div>

        <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Apply now</h2>
        <p className="text-[#888] text-sm mb-8">No resume needed. Just tap through a few quick questions.</p>

        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First Name" error={errors.first_name}>
              <input
                type="text"
                placeholder="Marcus"
                value={formData.first_name}
                onChange={e => set('first_name', e.target.value)}
                className={inputClass('first_name')}
              />
            </Field>
            <Field label="Last Name" error={errors.last_name}>
              <input
                type="text"
                placeholder="Jones"
                value={formData.last_name}
                onChange={e => set('last_name', e.target.value)}
                className={inputClass('last_name')}
              />
            </Field>
          </div>

          <PhotoUpload
            value={formData.photo}
            onChange={val => set('photo', val)}
            error={errors.photo}
          />

          <Field label="Email" error={errors.email}>
            <input
              type="email"
              placeholder="marcus@gmail.com"
              value={formData.email}
              onChange={e => set('email', e.target.value)}
              className={inputClass('email')}
            />
          </Field>

          <Field label="Phone" error={errors.phone}>
            <input
              type="tel"
              placeholder="(404) 555-0123"
              value={formData.phone}
              onChange={e => set('phone', formatPhone(e.target.value))}
              className={inputClass('phone')}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="City" error={errors.city}>
              <input
                type="text"
                placeholder="Atlanta"
                value={formData.city}
                onChange={e => set('city', e.target.value)}
                className={inputClass('city')}
              />
            </Field>
            <Field label="Zip Code" error={errors.zip}>
              <input
                type="text"
                placeholder="30303"
                value={formData.zip}
                onChange={e => set('zip', e.target.value.replace(/\D/g, '').slice(0, 5))}
                className={inputClass('zip')}
              />
            </Field>
          </div>

          <Field label="Role Interest" error={errors.roles}>
            <PillToggle
              options={ROLES}
              selected={formData.roles}
              onChange={val => set('roles', val)}
            />
            <input
              type="text"
              placeholder="Other roles (e.g. Bar Back, VIP Runner) — comma separated"
              value={formData.other_roles_text || ''}
              onChange={(e) => {
                const text = e.target.value
                const extras = text.split(',').map(s => s.trim()).filter(Boolean)
                const baseRoles = (formData.roles || []).filter(r => ROLES.includes(r))
                set('other_roles_text', text)
                set('roles', [...baseRoles, ...extras])
              }}
              className="mt-3 w-full bg-p-surface border border-p-border rounded-lg px-4 py-2.5 text-white text-sm placeholder-p-muted focus:outline-none focus:border-p-green transition-colors"
            />
          </Field>

          <Field label="General Availability" error={errors.availability}>
            <PillToggle
              options={AVAILABILITY}
              selected={formData.availability}
              onChange={val => set('availability', val)}
            />
          </Field>

          {/* Section 1 continue button */}
          {section === 1 && (
            <>
              {/* SMS consent checkbox — visible on the first screen for TCR/A2P reviewers */}
              <label className="mt-6 flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!formData.sms_consent}
                  onChange={(e) => set('sms_consent', e.target.checked)}
                  className="mt-0.5 w-5 h-5 flex-shrink-0 accent-green-500 cursor-pointer"
                />
                <span className={`text-[12px] leading-relaxed ${errors.sms_consent ? 'text-[#ff6b6b]' : 'text-[#999]'}`}>
                  By checking this box, you agree to receive SMS messages from V&amp;A Hire
                  (Varist &amp; Associates of Georgia LLC) related to customer care, shift offers,
                  assignment confirmations, scheduling, shift details, and reminders. You may reply STOP
                  to opt out at any time. Reply HELP for assistance. Message and data rates may
                  apply. Message frequency will vary. See our{' '}
                  <a href="/privacy" className="underline hover:text-white">Privacy Policy</a>{' '}
                  and <a href="/terms" className="underline hover:text-white">Terms &amp; Conditions</a>.
                </span>
              </label>
              {errors.sms_consent && <p className="mt-1 text-[#ff6b6b] text-xs">{errors.sms_consent}</p>}

              <button
                type="button"
                onClick={() => {
                  const e = {}
                  if (!formData.first_name.trim()) e.first_name = 'Required'
                  if (!formData.last_name.trim()) e.last_name = 'Required'
                  if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) e.email = 'Enter a valid email'
                  const phoneDigits = formData.phone.replace(/\D/g, '')
                  if (phoneDigits.length < 10) e.phone = 'Enter a 10-digit US phone number'
                  if (!formData.city.trim()) e.city = 'Required'
                  if (!formData.zip.trim() || !/^\d{5}$/.test(formData.zip)) e.zip = 'Enter a valid 5-digit zip'
                  if (formData.roles.length === 0) e.roles = 'Select at least one role'
                  if (formData.availability.length === 0) e.availability = 'Select at least one option'
                  if (!formData.photo) e.photo = 'Please add a photo'
                  if (Object.keys(e).length > 0) {
                    setErrors(e)
                    return
                  }
                  setErrors({})
                  setSection(2)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                className="mt-4 w-full rounded-full py-4 font-semibold text-base bg-[#ffffff] text-black hover:opacity-90 transition-all duration-200 cursor-pointer"
              >
                Continue →
              </button>
            </>
          )}

          {/* Structured screening — section 2 (progressive disclosure) */}
          {section === 2 && (
            <div className="border-t border-[#222] pt-5 mt-2 fade-up">
              <p className="text-[#888] text-sm mb-5">Almost done — just a few quick taps.</p>

              <div className="flex flex-col gap-5">
                <Field label="Past Experience" error={errors.experience_types}>
                  <PillToggle
                    options={EXPERIENCE_TYPES}
                    selected={formData.experience_types}
                    onChange={val => set('experience_types', val)}
                  />
                </Field>

                <Field label="Shift Windows" error={errors.availability_windows}>
                  <PillToggle
                    options={AVAILABILITY_WINDOWS}
                    selected={formData.availability_windows}
                    onChange={val => set('availability_windows', val)}
                  />
                </Field>

                <Field label="Reliable Transportation?" error={errors.has_transportation}>
                  <SingleSelect
                    options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]}
                    selected={formData.has_transportation}
                    onChange={val => set('has_transportation', val)}
                  />
                </Field>

                <Field label="Available on Short Notice?" error={errors.short_notice}>
                  <SingleSelect
                    options={SHORT_NOTICE_OPTIONS}
                    selected={formData.short_notice}
                    onChange={val => set('short_notice', val)}
                  />
                </Field>

                <Field label="Anything Else? (optional)">
                  <textarea
                    placeholder="Anything we should know..."
                    value={formData.notes}
                    onChange={e => set('notes', e.target.value)}
                    rows={2}
                    maxLength={300}
                    className={inputClass('notes') + ' resize-none'}
                  />
                </Field>
              </div>
            </div>
          )}
        </div>

        {submitError && (
          <div className="mt-4 bg-[#ff4444]/10 border border-[#ff4444]/30 rounded-xl px-4 py-3">
            <p className="text-[#ff4444] text-sm">{submitError}</p>
          </div>
        )}

        {section === 2 && (
          <>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setSection(1)}
                className="rounded-full py-4 px-6 font-semibold text-base border border-[#2a2a2a] text-[#888] hover:border-[#444] transition-all duration-200 cursor-pointer"
              >
                ← Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className={`flex-1 rounded-full py-4 font-semibold text-base transition-all duration-200 flex items-center justify-center gap-2
                  ${submitting
                    ? 'bg-[#333] text-[#666] cursor-not-allowed'
                    : 'bg-[#ffffff] text-black hover:opacity-90 cursor-pointer'
                  }`}
              >
                {submitting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Submitting...
                  </>
                ) : (
                  'Submit Application'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
