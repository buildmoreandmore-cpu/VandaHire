import { useState, useEffect } from 'react'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
]

const TAX_CLASSES = [
  { value: 'individual', label: 'Individual / Sole proprietor' },
  { value: 'llc_c', label: 'LLC — C corporation' },
  { value: 'llc_s', label: 'LLC — S corporation' },
  { value: 'llc_p', label: 'LLC — Partnership' },
  { value: 'c_corp', label: 'C Corporation' },
  { value: 's_corp', label: 'S Corporation' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'trust', label: 'Trust / Estate' },
  { value: 'other', label: 'Other' },
]

function formatTin(val) {
  const digits = val.replace(/\D/g, '').slice(0, 9)
  // Format as SSN: XXX-XX-XXXX
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

export default function W9FormPage({ phone: phoneParam }) {
  const [phone, setPhone] = useState(phoneParam || '')
  const [worker, setWorker] = useState(null)
  const [step, setStep] = useState(phoneParam ? 'loading' : 'lookup')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Form fields
  const [legalName, setLegalName] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [taxClass, setTaxClass] = useState('individual')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [tin, setTin] = useState('')
  const [certified, setCertified] = useState(false)
  const [signatureName, setSignatureName] = useState('')

  // W-9 status after submission
  const [w9Data, setW9Data] = useState(null)

  // Auto-lookup if phone param provided
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
      // Check worker exists
      const res = await fetch(`/api/checkin?phone=${encodeURIComponent(digits)}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Worker not found. Please make sure you have applied first.')
        setStep('lookup')
        return
      }
      setWorker(data.worker || data)

      // Check W-9 status
      const w9Res = await fetch(`/api/w9?phone=${encodeURIComponent(digits)}`)
      const w9 = await w9Res.json()
      if (w9.has_w9) {
        setW9Data(w9)
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

    const tinDigits = tin.replace(/\D/g, '')
    if (tinDigits.length !== 9) { setError('Please enter a valid 9-digit SSN or EIN.'); return }
    if (!certified) { setError('You must certify the information is correct.'); return }
    if (!signatureName.trim()) { setError('Please type your full legal name as your signature.'); return }

    setSubmitting(true)
    try {
      const res = await fetch('/api/w9', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.replace(/\D/g, ''),
          legal_name: legalName.trim(),
          business_name: businessName.trim(),
          tax_class: taxClass,
          address: address.trim(),
          city: city.trim(),
          state,
          zip: zip.trim(),
          tin: tinDigits,
          certification: true,
          signature_name: signatureName.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Submission failed. Please try again.'); return }
      setW9Data({ w9_tin_last4: tinDigits.slice(-4), w9_signed_at: data.w9_signed_at })
      setStep('done')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 500, margin: '0 auto', padding: '40px 20px' }}>
        <h1 style={{ fontSize: 24, marginBottom: 4, textAlign: 'center' }}>W-9 Tax Form</h1>
        <p style={{ color: '#888', textAlign: 'center', marginBottom: 8, fontSize: 14 }}>
          Required before you can be assigned shifts
        </p>
        {/* Progress indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 32, height: 4, borderRadius: 2, background: '#ffffff' }} />
          <div style={{ width: 32, height: 4, borderRadius: 2, background: '#ffffff' }} />
          <div style={{ width: 32, height: 4, borderRadius: 2, background: '#333' }} />
        </div>
        <p style={{ color: '#666', fontSize: 12, textAlign: 'center', marginBottom: 24 }}>Step 3 of 3</p>

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

        {/* Step: W-9 Form */}
        {step === 'form' && (
          <form onSubmit={handleSubmit}>
            <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 12, padding: 20, marginBottom: 20 }}>
              <p style={{ color: '#ffffff', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 4px', fontWeight: 600 }}>
                IRS Form W-9 Substitute
              </p>
              <p style={{ color: '#666', fontSize: 12, margin: 0 }}>
                Request for Taxpayer Identification Number and Certification
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Legal Name */}
              <div>
                <label style={labelStyle}>Legal name (as shown on your tax return)</label>
                <input
                  type="text"
                  value={legalName}
                  onChange={e => setLegalName(e.target.value)}
                  required
                  style={inputStyle}
                />
              </div>

              {/* Business Name */}
              <div>
                <label style={labelStyle}>Business name, if different from above</label>
                <input
                  type="text"
                  value={businessName}
                  onChange={e => setBusinessName(e.target.value)}
                  placeholder="Optional"
                  style={inputStyle}
                />
              </div>

              {/* Tax Classification */}
              <div>
                <label style={labelStyle}>Federal tax classification</label>
                <select
                  value={taxClass}
                  onChange={e => setTaxClass(e.target.value)}
                  required
                  style={selectStyle}
                >
                  {TAX_CLASSES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* Address */}
              <div>
                <label style={labelStyle}>Street address</label>
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

              {/* TIN */}
              <div>
                <label style={labelStyle}>Taxpayer Identification Number (SSN or EIN)</label>
                <input
                  type="text"
                  value={tin}
                  onChange={e => setTin(formatTin(e.target.value))}
                  placeholder="XXX-XX-XXXX"
                  required
                  inputMode="numeric"
                  style={inputStyle}
                />
                <p style={{ color: '#555', fontSize: 11, marginTop: 4 }}>
                  Social Security Number or Employer Identification Number
                </p>
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
                    {certified && <span style={{ color: '#000', fontSize: 16, fontWeight: 700 }}>✓</span>}
                  </div>
                  <span>
                    Under penalties of perjury, I certify that the number shown on this form is my correct
                    taxpayer identification number (or I am waiting for a number to be issued to me), I am
                    a U.S. person, and I am not subject to backup withholding.
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
                {submitting ? 'Submitting...' : 'Submit W-9'}
              </button>

              <a href="/" style={{ display: 'block', textAlign: 'center', padding: '12px', color: '#666', fontSize: 14, textDecoration: 'none', marginTop: 4 }}>
                Skip for now — I'll come back later
              </a>
            </div>
          </form>
        )}

        {/* Step: Done — onboarding complete */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 32, color: '#000' }}>
              ✓
            </div>
            <h2 style={{ marginBottom: 8 }}>W-9 On File</h2>
            <p style={{ color: '#aaa', fontSize: 14, lineHeight: 1.6, marginBottom: 8 }}>
              Your tax information has been securely submitted.
            </p>
            {w9Data?.w9_tin_last4 && (
              <p style={{ color: '#666', fontSize: 13 }}>
                TIN ending in <strong style={{ color: '#fff' }}>***-**-{w9Data.w9_tin_last4}</strong>
              </p>
            )}

            {/* Progress indicator */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, margin: '24px 0' }}>
              <div style={{ width: 32, height: 4, borderRadius: 2, background: '#ffffff' }} />
              <div style={{ width: 32, height: 4, borderRadius: 2, background: '#ffffff' }} />
              <div style={{ width: 32, height: 4, borderRadius: 2, background: '#ffffff' }} />
            </div>
            <p style={{ color: '#666', fontSize: 12, marginBottom: 24 }}>Onboarding complete</p>

            <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 12, padding: 20, marginBottom: 24, textAlign: 'left' }}>
              <p style={{ color: '#fff', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>You're all set!</p>
              <p style={{ color: '#aaa', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                Your profile is complete. You'll receive shift notifications via text message. Once assigned to an event, you'll get all the details you need.
              </p>
            </div>

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
