import { useState } from 'react'
import EventRequestForm from '../components/EventRequestForm.jsx'
import EventSubmittedScreen from '../components/EventSubmittedScreen.jsx'

export default function EventRequestPage() {
  const [submitted, setSubmitted] = useState(false)
  const [eventTitle, setEventTitle] = useState('')

  return (
    <div className="min-h-screen bg-[#0a0a0a] font-inter">
      {!submitted ? (
        <EventRequestForm onSuccess={(title) => { setEventTitle(title); setSubmitted(true) }} />
      ) : (
        <EventSubmittedScreen title={eventTitle} />
      )}
    </div>
  )
}
