import { useState, useEffect } from 'react'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
]

const SEX_OPTIONS = [
  { value: '', label: 'Select...' },
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Non-Binary', label: 'Non-Binary' },
]

const RACE_OPTIONS = [
  { value: '', label: 'Select...' },
  { value: 'American Indian or Alaska Native', label: 'American Indian or Alaska Native' },
  { value: 'Asian', label: 'Asian' },
  { value: 'Black or African American', label: 'Black or African American' },
  { value: 'Hispanic or Latino', label: 'Hispanic or Latino' },
  { value: 'Native Hawaiian or Other Pacific Islander', label: 'Native Hawaiian or Other Pacific Islander' },
  { value: 'White', label: 'White' },
  { value: 'Two or More Races', label: 'Two or More Races' },
  { value: 'Other', label: 'Other' },
  { value: 'Prefer not to say', label: 'Prefer not to say' },
]

function formatSsn(val) {
  const digits = val.replace(/\D/g, '').slice(0, 9)
  if (digits.length <= 3) return digits
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`
}

const inputStyle = {
  width: '100%', padding: '14px 16px', borderRadius: 8, border: '1px solid #333',
  background: '#141414', color: '#fff', fontSize: 16, boxSizing: 'border-box',
}

const selectStyle = { ...inputStyle, appearance: 'none' }

const labelStyle = { display: 'block', marginBottom: 6, fontSize: 13, color: '#aaa' }

const PCG_PAYMENT_URL = 'https://buy.stripe.com/9B65kEdmj7DV1dAdElefC00'

export default function BgCheckPage({ phone: phoneParam }) {
  const [phone, setPhone] = useState(phoneParam || '')
  const [worker, setWorker] = useState(null)
  const [step, setStep] = useState(phoneParam ? 'loading' : 'lookup')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Form fields
  const [legalName, setLegalName] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [sex, setSex] = useState('')
  const [race, setRace] = useState('')
  const [dob, setDob] = useState('')
  const [ssn, setSsn] = useState('')
  const [consentType, setConsentType] = useState('90_days')
  const [certified, setCertified] = useState(false)
  const [signatureName, setSignatureName] = useState('')

  // Status after submission
  const [bgData, setBgData] = useState(null)

  useEffect(() => {
    if (phoneParam) lookupWorker(phoneParam)
  }, [])

  async function lookupWorker(ph) {
    setError('')
    const digits = (ph || phone).replace(/\D/g, '')
    if (digits.length < 10) {
      setError('Please enter a valid 10-digit phone number.')
      setStep('lookup')
      return
    }

    try {
      const res = await fetch(`/api/checkin?phone=${encodeURIComponent(digits)}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Worker not found. Please make sure you have applied first.')
        setStep('lookup')
        return
      }
      setWorker(data.worker || data)

      // Check bg check status
      const bgRes = await fetch(`/api/bg-check?phone=${encodeURIComponent(digits)}`)
      const bg = await bgRes.json()
      if (bg.bg_check_signed_at) {
        setBgData(bg)
        setStep('done')
        return
      }

      // Pre-fill name
      const w = data.worker || data
      if (w.first_name || w.last_name) {
        setLegalName(`${w.first_name || ''} ${w.last_name || ''}`.trim())
      }
      setStep('form')
    } catch {
      setError('Connection error. Please try again.')
      setStep('lookup')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const ssnDigits = ssn.replace(/\D/g, '')
    if (ssnDigits.length !== 9) { setError('Please enter a valid 9-digit Social Security Number.'); return }
    if (!legalName.trim()) { setError('Full legal name is required.'); return }
    if (!address.trim()) { setError('Street address is required.'); return }
    if (!city.trim()) { setError('City is required.'); return }
    if (!state) { setError('State is required.'); return }
    if (!/^\d{5}$/.test(zip)) { setError('ZIP must be 5 digits.'); return }
    if (!sex) { setError('Sex/Gender is required.'); return }
    if (!race) { setError('Race is required.'); return }
    if (!dob) { setError('Date of birth is required.'); return }
    if (!certified) { setError('You must agree to the background check consent.'); return }
    if (!signatureName.trim()) { setError('Please type your full legal name as your electronic signature.'); return }

    setSubmitting(true)
    try {
      const res = await fetch('/api/bg-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.replace(/\D/g, ''),
          legal_name: legalName.trim(),
          address: address.trim(),
          city: city.trim(),
          state,
          zip: zip.trim(),
          sex,
          race,
          dob,
          ssn: ssnDigits,
          consent_type: consentType,
          signature_name: signatureName.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Submission failed. Please try again.'); return }
      setBgData({ bg_check_signed_at: data.bg_check_signed_at, bg_check_ssn_last4: ssnDigits.slice(-4) })
      setStep('success')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 500, margin: '0 auto', padding: '40px 20px' }}>
        <h1 style={{ fontSize: 24, marginBottom: 4, textAlign: 'center' }}>Background Check</h1>
        <p style={{ color: '#888', textAlign: 'center', marginBottom: 8, fontSize: 14 }}>
          PCG Screening Services — Authorization Consent
        </p>
        {/* Progress indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 32, height: 4, borderRadius: 2, background: '#ffffff' }} />
          <div style={{ width: 32, height: 4, borderRadius: 2, background: '#ffffff' }} />
          <div style={{ width: 32, height: 4, borderRadius: 2, background: '#ffffff' }} />
          <div style={{ width: 32, height: 4, borderRadius: 2, background: '#333' }} />
        </div>
        <p style={{ color: '#666', fontSize: 12, textAlign: 'center', marginBottom: 24 }}>Step 4 of 4</p>

        {error && (
          <div style={{ background: '#331111', border: '1px solid #552222', color: '#ff6666', padding: '12px 16px', borderRadius: 8, marginBottom: 20, fontSize: 14 }}>
            {error}
          </div>
        )}

        {/* Step: Phone Lookup */}
        {step === 'lookup' && (
          <form onSubmit={(e) => { e.preventDefault(); lookupWorker() }}>
            <label style={labelStyle}>Enter your phone number</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="(404) 555-1234"
              required
              style={{ ...inputStyle, marginBottom: 16 }}
            />
            <button type="submit" style={{ width: '100%', padding: 14, borderRadius: 8, border: 'none', background: '#ffffff', color: '#000', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>
              Look Up My Application
            </button>
          </form>
        )}

        {/* Step: Loading */}
        {step === 'loading' && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ width: 48, height: 48, border: '4px solid #333', borderTopColor: '#ffffff', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 20px' }} />
            <p style={{ color: '#aaa' }}>Loading...</p>
          </div>
        )}

        {/* Step: Consent Form */}
        {step === 'form' && (
          <form onSubmit={handleSubmit}>
            <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 12, padding: 20, marginBottom: 20 }}>
              <p style={{ color: '#ffffff', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 4px', fontWeight: 600 }}>
                Background Check Authorization
              </p>
              <p style={{ color: '#666', fontSize: 12, margin: 0 }}>
                PCG Screening Services — Consumer Report Consent
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Legal Name */}
              <div>
                <label style={labelStyle}>Full Legal Name</label>
                <input
                  type="text"
                  value={legalName}
                  onChange={e => setLegalName(e.target.value)}
                  required
                  style={inputStyle}
                />
              </div>

              {/* Address */}
              <div>
                <label style={labelStyle}>Street Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  required
                  style={inputStyle}
                />
              </div>

              {/* City, State, ZIP row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12 }}>
                <div>
                  <label style={labelStyle}>City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    required
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>State</label>
                  <select
                    value={state}
                    onChange={e => setState(e.target.value)}
                    required
                    style={{ ...selectStyle, width: 80 }}
                  >
                    <option value="">—</option>
                    {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>ZIP</label>
                  <input
                    type="text"
                    value={zip}
                    onChange={e => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
                    required
                    maxLength={5}
                    style={{ ...inputStyle, width: 90 }}
                  />
                </div>
              </div>

              {/* Sex and Race row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Sex / Gender</label>
                  <select value={sex} onChange={e => setSex(e.target.value)} required style={selectStyle}>
                    {SEX_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Race</label>
                  <select value={race} onChange={e => setRace(e.target.value)} required style={selectStyle}>
                    {RACE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              {/* DOB */}
              <div>
                <label style={labelStyle}>Date of Birth</label>
                <input
                  type="date"
                  value={dob}
                  onChange={e => setDob(e.target.value)}
                  required
                  style={inputStyle}
                />
              </div>

              {/* SSN */}
              <div>
                <label style={labelStyle}>Social Security Number</label>
                <input
                  type="password"
                  value={ssn}
                  onChange={e => setSsn(formatSsn(e.target.value))}
                  placeholder="XXX-XX-XXXX"
                  required
                  inputMode="numeric"
                  autoComplete="off"
                  style={inputStyle}
                />
                <p style={{ color: '#555', fontSize: 11, marginTop: 4 }}>
                  Your SSN is encrypted and transmitted securely
                </p>
              </div>

              {/* Consent Type */}
              <div>
                <label style={labelStyle}>Consent Duration</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label
                    onClick={() => setConsentType('90_days')}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#141414', border: `1px solid ${consentType === '90_days' ? '#ffffff' : '#1e1e1e'}`, borderRadius: 8, cursor: 'pointer' }}
                  >
                    <div style={{ width: 20, height: 20, borderRadius: '50%', border: consentType === '90_days' ? '6px solid #ffffff' : '2px solid #555', boxSizing: 'border-box' }} />
                    <span style={{ color: '#ccc', fontSize: 14 }}>Valid for 90 days from signature</span>
                  </label>
                  <label
                    onClick={() => setConsentType('employment_duration')}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#141414', border: `1px solid ${consentType === 'employment_duration' ? '#ffffff' : '#1e1e1e'}`, borderRadius: 8, cursor: 'pointer' }}
                  >
                    <div style={{ width: 20, height: 20, borderRadius: '50%', border: consentType === 'employment_duration' ? '6px solid #ffffff' : '2px solid #555', boxSizing: 'border-box' }} />
                    <span style={{ color: '#ccc', fontSize: 14 }}>Duration of employment</span>
                  </label>
                </div>
              </div>

              {/* Purpose Code (read-only) */}
              <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 8, padding: '12px 16px' }}>
                <label style={{ ...labelStyle, marginBottom: 4 }}>Purpose Code</label>
                <p style={{ color: '#fff', fontSize: 14, margin: 0 }}>E — Regular Employment</p>
              </div>

              {/* Certification */}
              <div
                onClick={() => setCertified(!certified)}
                style={{ background: '#141414', border: `1px solid ${certified ? '#ffffff' : '#1e1e1e'}`, borderRadius: 8, padding: 16, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
              >
                <div style={{ display: 'flex', gap: 12, fontSize: 13, color: '#ccc', lineHeight: 1.6 }}>
                  <div style={{
                    width: 24, height: 24, minWidth: 24, borderRadius: 4, marginTop: 2,
                    border: certified ? 'none' : '2px solid #555',
                    background: certified ? '#ffffff' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {certified && <span style={{ color: '#000', fontSize: 16, fontWeight: 700 }}>&#10003;</span>}
                  </div>
                  <span>
                    I authorize V&A Hire and PCG Screening Services to obtain a consumer report
                    and/or investigative consumer report about me for employment purposes.
                    I understand that this may include information regarding my criminal history,
                    driving record, credit history, education, and employment verification.
                    I have read and understand my rights under the Fair Credit Reporting Act (FCRA).
                  </span>
                </div>
              </div>

              {/* Signature */}
              <div>
                <label style={labelStyle}>Electronic signature — type your full legal name</label>
                <input
                  type="text"
                  value={signatureName}
                  onChange={e => setSignatureName(e.target.value)}
                  required
                  style={{ ...inputStyle, fontStyle: 'italic', fontFamily: 'Georgia, serif', fontSize: 18 }}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: '100%', padding: 16, borderRadius: 8, border: 'none',
                  background: '#ffffff', color: '#000', fontSize: 16, fontWeight: 600,
                  cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1,
                  marginTop: 8,
                }}
              >
                {submitting ? 'Submitting...' : 'Submit & Continue to Payment'}
              </button>

              <a href="/" style={{ display: 'block', textAlign: 'center', padding: '12px', color: '#666', fontSize: 14, textDecoration: 'none', marginTop: 4 }}>
                Skip for now — I'll come back later
              </a>
            </div>
          </form>
        )}

        {/* Step: Success — redirect to payment */}
        {step === 'success' && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 32, color: '#000' }}>
              &#10003;
            </div>
            <h2 style={{ marginBottom: 8 }}>Consent Form Submitted</h2>
            <p style={{ color: '#aaa', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
              Your background check authorization has been securely submitted to PCG Screening Services.
            </p>

            <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 12, padding: 20, marginBottom: 24, textAlign: 'left' }}>
              <p style={{ color: '#fff', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Next Step: Complete Payment</p>
              <p style={{ color: '#aaa', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                Please complete the background check payment to finalize your screening. Click the button below to proceed to the secure payment page.
              </p>
            </div>

            <a
              href={PCG_PAYMENT_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-block', padding: '16px 32px', background: '#ffffff', color: '#000', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 16, marginBottom: 16 }}
            >
              Complete Payment &rarr;
            </a>

            <p style={{ color: '#666', fontSize: 12, marginTop: 16 }}>
              Payment is processed securely by Stripe on behalf of PCG Screening Services.
            </p>

            <a href="/" style={{ display: 'inline-block', marginTop: 20, color: '#666', fontSize: 14, textDecoration: 'none' }}>
              Back to Home
            </a>
          </div>
        )}

        {/* Step: Already submitted */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 32, color: '#000' }}>
              &#10003;
            </div>
            <h2 style={{ marginBottom: 8 }}>Background Check on File</h2>
            <p style={{ color: '#aaa', fontSize: 14, lineHeight: 1.6, marginBottom: 8 }}>
              Your consent form has already been submitted.
            </p>
            {bgData?.bg_check_ssn_last4 && (
              <p style={{ color: '#666', fontSize: 13 }}>
                SSN ending in <strong style={{ color: '#fff' }}>***-**-{bgData.bg_check_ssn_last4}</strong>
              </p>
            )}

            {/* Progress indicator */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, margin: '24px 0' }}>
              <div style={{ width: 32, height: 4, borderRadius: 2, background: '#ffffff' }} />
              <div style={{ width: 32, height: 4, borderRadius: 2, background: '#ffffff' }} />
              <div style={{ width: 32, height: 4, borderRadius: 2, background: '#ffffff' }} />
              <div style={{ width: 32, height: 4, borderRadius: 2, background: '#ffffff' }} />
            </div>
            <p style={{ color: '#666', fontSize: 12, marginBottom: 24 }}>Onboarding complete</p>

            {bgData?.bg_check_cleared ? (
              <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 12, padding: 20, marginBottom: 24, textAlign: 'left' }}>
                <p style={{ color: '#22c55e', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Background Check Cleared</p>
                <p style={{ color: '#aaa', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                  Your background check has been completed and cleared. You're all set!
                </p>
              </div>
            ) : (
              <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 12, padding: 20, marginBottom: 24, textAlign: 'left' }}>
                <p style={{ color: '#f59e0b', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Pending Review</p>
                <p style={{ color: '#aaa', fontSize: 13, lineHeight: 1.6, margin: '0 0 12px' }}>
                  Your consent form has been submitted. Results are typically returned within 2-3 business days.
                </p>
                <a
                  href={PCG_PAYMENT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'underline' }}
                >
                  Complete Payment (if not already done)
                </a>
              </div>
            )}

            <a href="/" style={{ display: 'inline-block', padding: '14px 28px', background: '#ffffff', color: '#000', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}>
              Back to Home
            </a>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
