import { useState } from 'react'
import LandingScreen from './components/LandingScreen.jsx'
import BasicInfoForm from './components/BasicInfoForm.jsx'
import SocialVerify from './components/SocialVerify.jsx'
import SubmittedScreen from './components/SubmittedScreen.jsx'

const SCREENS = {
  LANDING: 'landing',
  BASIC_INFO: 'basic_info',
  SOCIAL_VERIFY: 'social_verify',
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
}

const initialSocialData = {
  instagram_connected: false,
  facebook_connected: false,
  tiktok_connected: false,
  linkedin_connected: false,
  instagram_data: null,
  facebook_data: null,
  tiktok_data: null,
  linkedin_data: null,
}

export default function App() {
  const [screen, setScreen] = useState(SCREENS.LANDING)
  const [formData, setFormData] = useState(initialFormData)
  const [socialData, setSocialData] = useState(initialSocialData)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const handleSocialConnect = (platform, data) => {
    setSocialData(prev => ({
      ...prev,
      [`${platform}_connected`]: true,
      [`${platform}_data`]: data,
    }))
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const payload = { ...formData, ...socialData }
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
        <LandingScreen onStart={() => setScreen(SCREENS.BASIC_INFO)} />
      )}
      {screen === SCREENS.BASIC_INFO && (
        <BasicInfoForm
          formData={formData}
          onChange={setFormData}
          onNext={() => setScreen(SCREENS.SOCIAL_VERIFY)}
        />
      )}
      {screen === SCREENS.SOCIAL_VERIFY && (
        <SocialVerify
          formData={formData}
          socialData={socialData}
          onConnect={handleSocialConnect}
          onSubmit={handleSubmit}
          submitting={submitting}
          submitError={submitError}
        />
      )}
      {screen === SCREENS.SUBMITTED && (
        <SubmittedScreen firstName={formData.first_name} />
      )}
    </div>
  )
}
