import { useState, useEffect, createContext, useContext } from 'react'
import App from './App.jsx'
import EventRequestPage from './pages/EventRequestPage.jsx'
import AdminPage from './pages/AdminPage.jsx'
import ConfirmPage from './pages/ConfirmPage.jsx'
import ShiftsPage from './pages/ShiftsPage.jsx'
import SurveyPage from './pages/SurveyPage.jsx'
import StatusPage from './pages/StatusPage.jsx'
import HowItWorksPage from './pages/HowItWorksPage.jsx'
import OrganizerPortalPage from './pages/OrganizerPortalPage.jsx'
import SeoLandingPage from './components/SeoLandingPage.jsx'

const RouterContext = createContext()

export function useNavigate() {
  return useContext(RouterContext)
}

function getPath() {
  return window.location.pathname
}

const SEO_PAGES = {
  '/event-staffing-atlanta': {
    keyword: 'event staffing Atlanta',
    headline: 'Atlanta Event Staffing — Vetted Crews, Fast Dispatch',
    subhead: 'Need reliable event staff in Atlanta? Vanda provides vetted workers for events of any size — dispatched by SMS, no group texts.',
    description: [
      'Atlanta is one of the busiest event markets in the Southeast, with conventions at the Georgia World Congress Center, concerts at State Farm Arena, festivals across Piedmont Park, and corporate activations throughout Midtown and Buckhead. When your event is on the line, you need crew you can trust to show up on time and ready to work.',
      'Vanda specializes in event staffing across the Atlanta metro. Every worker in our pool has been reviewed and approved by our team before they\'re offered shifts. When your event is confirmed, we dispatch each crew member directly by SMS — full details, no group chats, no missed messages.',
      'Whether you need setup and breakdown crew for a stadium event, janitorial support for a multi-day convention, or brand activation staff for a product launch in Atlantic Station, Vanda can staff your crew quickly. Submit your request and we\'ll confirm availability within 24 hours.',
    ],
  },
  '/festival-staff-atlanta': {
    keyword: 'festival staff Atlanta',
    headline: 'Festival Staff in Atlanta — Ready When You Are',
    subhead: 'From Music Midtown to local neighborhood festivals, Vanda provides experienced festival staff across the Atlanta area.',
    description: [
      'Atlanta\'s festival scene runs year-round — outdoor music events in summer, food and art festivals in the fall, and holiday markets across the city in winter. Each event brings its own staffing challenges: crowd management, vendor support, cleanup between sets, and setup before gates open.',
      'Vanda provides festival staff across Atlanta and the surrounding metro area. Our workers are vetted, briefed before every event, and dispatched individually by SMS so there\'s no confusion about where to go or who to report to. We staff janitorial crews, setup and breakdown teams, registration and check-in staff, security support, and general labor.',
      'Festivals move fast. Vanda moves faster. Submit your festival staffing request and we\'ll build your crew roster and confirm availability within 24 hours. Our on-site supervisor support means you\'ll always have a point of contact for the day of.',
    ],
  },
  '/event-labor-atlanta': {
    keyword: 'event labor Atlanta',
    headline: 'Event Labor in Atlanta — Show Up Ready',
    subhead: 'Reliable event labor across Atlanta — for load-in, breakdown, general labor, and everything in between.',
    description: [
      'Event labor is the backbone of any successful event. Load-in crews, setup teams, breakdown workers, and general labor keep your venue moving from the moment doors open to the final sweep. In Atlanta\'s competitive event market, the difference between a smooth event and a chaotic one often comes down to the quality of your ground crew.',
      'Vanda provides event labor throughout Atlanta and the greater metro area, including Buckhead, Midtown, Decatur, and beyond. We staff roles including general labor, setup and breakdown, janitorial, catering support, and registration. Every worker is pre-approved and briefed with shift-specific details before they arrive on site.',
      'No last-minute scrambling for no-shows. No group texts that get ignored. When you book labor through Vanda, each worker receives a direct SMS with their meeting point, supervisor contact, pay rate, dress code, and any briefing information. Submit your labor request and we\'ll get back to you within 24 hours.',
    ],
  },
  '/crowd-control-staffing-atlanta': {
    keyword: 'crowd control staffing Atlanta',
    headline: 'Crowd Control Staffing in Atlanta',
    subhead: 'Professional crowd management and security support staff for Atlanta events — vetted, briefed, and dispatched.',
    description: [
      'Managing large crowds at Atlanta events requires experienced, calm, and prepared staff. Whether you\'re managing foot traffic at a major convention at the Georgia World Congress Center, controlling entry lines at a sold-out concert, or maintaining order at a high-volume festival, your crowd control team needs to be reliable and well-briefed.',
      'Vanda provides crowd control staffing support across the Atlanta area. Our workers are reviewed before approval, briefed on event-specific protocols before their shift, and dispatched directly with SMS instructions covering their assignment, meeting point, supervisor contact, and dress code.',
      'We staff registration and check-in staff, crowd flow positions, venue support roles, and general crowd management labor. Our team can also coordinate pre-event briefings — on-site or virtual — so your staff knows what to expect before they arrive. Submit a staffing request and we\'ll confirm your roster within 24 hours.',
    ],
  },
  '/brand-activation-staff-atlanta': {
    keyword: 'brand activation staff Atlanta',
    headline: 'Brand Activation Staff in Atlanta',
    subhead: 'Engaging, brand-ready staff for product launches, pop-ups, and experiential activations across Atlanta.',
    description: [
      'Brand activations in Atlanta require staff who are professional, personable, and on-brand from the first moment. Whether you\'re launching a product at Atlantic Station, running a pop-up in Ponce City Market, or executing an experiential campaign at a major festival, your activation staff represents your brand directly to consumers.',
      'Vanda staffs brand activation roles across Atlanta and the surrounding metro area. We provide staff for product demonstrations, sampling, registration, check-in, social media activation support, and general event labor. All workers are pre-approved, vetted by our team, and briefed with your brand guidelines and shift details before they arrive.',
      'From Midtown to Buckhead to East Atlanta, Vanda can build a crew for your next activation quickly. We dispatch each team member individually by SMS — no group chats, no last-minute dropouts going unnoticed. Submit your activation staffing request and we\'ll confirm your team within 24 hours.',
    ],
  },
}

export default function Router() {
  const [path, setPath] = useState(getPath)

  useEffect(() => {
    const handler = () => setPath(getPath())
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])

  const navigate = (to) => {
    window.history.pushState({}, '', to)
    setPath(to)
  }

  let page
  if (path.startsWith('/admin')) {
    page = <AdminPage />
  } else if (path.startsWith('/events')) {
    page = <EventRequestPage />
  } else if (path.startsWith('/confirm')) {
    page = <ConfirmPage />
  } else if (path.startsWith('/shifts')) {
    page = <ShiftsPage />
  } else if (path.startsWith('/survey/')) {
    const token = path.replace('/survey/', '')
    page = <SurveyPage token={token} />
  } else if (path === '/status') {
    page = <StatusPage />
  } else if (path === '/how-it-works') {
    page = <HowItWorksPage />
  } else if (path === '/organizer') {
    page = <OrganizerPortalPage />
  } else if (SEO_PAGES[path]) {
    page = <SeoLandingPage {...SEO_PAGES[path]} />
  } else {
    page = <App />
  }

  return (
    <RouterContext.Provider value={navigate}>
      {page}
    </RouterContext.Provider>
  )
}
