import { useState } from 'react'
import LandingScreen from './components/LandingScreen.jsx'
import BasicInfoForm from './components/BasicInfoForm.jsx'
import SubmittedScreen from './components/SubmittedScreen.jsx'

const SCREENS = {
  LANDING: 'landing',
  APPLICATION: 'application',
  SUBMITTED: 'submitted',
}

const initialFormData = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  city: '',
  zip: '',
  roles: [],
  availability: [],
  experience_types: [],
  availability_windows: [],
  has_transportation: '',
  short_notice: '',
  notes: '',
  photo: null,
}

export default function App() {
  const [screen, setScreen] = useState(SCREENS.LANDING)
  const [formData, setFormData] = useState(initialFormData)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const handleSubmit = async () => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const { photo, ...fields } = formData
      const payload = { ...fields }
      if (photo) payload.photo_base64 = photo
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Submission failed')
      }
      setScreen(SCREENS.SUBMITTED)
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] font-inter">
      {screen === SCREENS.LANDING && (
        <LandingScreen onStart={() => setScreen(SCREENS.APPLICATION)} />
      )}
      {screen === SCREENS.APPLICATION && (
        <BasicInfoForm
          formData={formData}
          onChange={setFormData}
          onSubmit={handleSubmit}
          submitting={submitting}
          submitError={submitError}
          onBack={() => setScreen(SCREENS.LANDING)}
        />
      )}
      {screen === SCREENS.SUBMITTED && (
        <SubmittedScreen firstName={formData.first_name} phone={formData.phone} />
      )}
    </div>
  )
}
