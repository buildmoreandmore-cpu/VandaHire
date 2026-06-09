import { useState, useEffect, createContext, useContext } from 'react'
import App from './App.jsx'
import EventRequestPage from './pages/EventRequestPage.jsx'
import AdminPage from './pages/AdminPage.jsx'
import ConfirmPage from './pages/ConfirmPage.jsx'
import ShiftsPage from './pages/ShiftsPage.jsx'
import SurveyPage from './pages/SurveyPage.jsx'
import StatusPage from './pages/StatusPage.jsx'
import MyShiftsPage from './pages/MyShiftsPage.jsx'
import HowItWorksPage from './pages/HowItWorksPage.jsx'
import OrganizerPortalPage from './pages/OrganizerPortalPage.jsx'
import SeoLandingPage from './components/SeoLandingPage.jsx'
import PrivacyPolicyPage from './pages/PrivacyPolicyPage.jsx'
import TermsOfServicePage from './pages/TermsOfServicePage.jsx'
import BlogIndexPage from './pages/BlogIndexPage.jsx'
import BlogPostPage from './pages/BlogPostPage.jsx'
import VideoVerifyPage from './pages/VideoVerifyPage.jsx'
import W9FormPage from './pages/W9FormPage.jsx'
import BgCheckPage from './pages/BgCheckPage.jsx'
import IdUploadPage from './pages/IdUploadPage.jsx'
import SupervisorPortalPage from './pages/SupervisorPortalPage.jsx'

const RouterContext = createContext()

export function useNavigate() {
  return useContext(RouterContext)
}

function getPath() {
  return window.location.pathname
}

const SEO_PAGES = {
  // --- Tier 1: Original 5 ---
  '/event-staffing-atlanta': {
    keyword: 'event staffing Atlanta',
    headline: 'Atlanta Event Staffing — Vetted Crews, Fast Dispatch',
    subhead: 'Need reliable event staff in Atlanta? V&A Hire provides vetted workers for events of any size — dispatched by SMS, no group texts.',
    description: [
      'Atlanta is one of the busiest event markets in the Southeast, with conventions at the Georgia World Congress Center, concerts at State Farm Arena, festivals across Piedmont Park, and corporate activations throughout Midtown and Buckhead. When your event is on the line, you need crew you can trust to show up on time and ready to work.',
      'V&A Hire specializes in event staffing across the Atlanta metro. Every worker in our pool has been reviewed and approved by our team before they\'re offered shifts. When your event is confirmed, we dispatch each crew member directly by SMS — full details, no group chats, no missed messages.',
      'Whether you need setup and breakdown crew for a stadium event, janitorial support for a multi-day convention, or brand activation staff for a product launch in Atlantic Station, V&A Hire can staff your crew quickly. Submit your request and we\'ll confirm availability within 24 hours.',
    ],
  },
  '/festival-staff-atlanta': {
    keyword: 'festival staff Atlanta',
    headline: 'Festival Staff in Atlanta — Ready When You Are',
    subhead: 'From Music Midtown to local neighborhood festivals, V&A Hire provides experienced festival staff across the Atlanta area.',
    description: [
      'Atlanta\'s festival scene runs year-round — outdoor music events in summer, food and art festivals in the fall, and holiday markets across the city in winter. Each event brings its own staffing challenges: crowd management, vendor support, cleanup between sets, and setup before gates open.',
      'V&A Hire provides festival staff across Atlanta and the surrounding metro area. Our workers are vetted, briefed before every event, and dispatched individually by SMS so there\'s no confusion about where to go or who to report to. We staff janitorial crews, setup and breakdown teams, registration and check-in staff, security support, and general labor.',
      'Festivals move fast. V&A Hire moves faster. Submit your festival staffing request and we\'ll build your crew roster and confirm availability within 24 hours. Our on-site supervisor support means you\'ll always have a point of contact for the day of.',
    ],
  },
  '/event-labor-atlanta': {
    keyword: 'event labor Atlanta',
    headline: 'Event Labor in Atlanta — Show Up Ready',
    subhead: 'Reliable event labor across Atlanta — for load-in, breakdown, general labor, and everything in between.',
    description: [
      'Event labor is the backbone of any successful event. Load-in crews, setup teams, breakdown workers, and general labor keep your venue moving from the moment doors open to the final sweep. In Atlanta\'s competitive event market, the difference between a smooth event and a chaotic one often comes down to the quality of your ground crew.',
      'V&A Hire provides event labor throughout Atlanta and the greater metro area, including Buckhead, Midtown, Decatur, and beyond. We staff roles including general labor, setup and breakdown, janitorial, catering support, and registration. Every worker is pre-approved and briefed with shift-specific details before they arrive on site.',
      'No last-minute scrambling for no-shows. No group texts that get ignored. When you book labor through V&A Hire, each worker receives a direct SMS with their meeting point, supervisor contact, pay rate, dress code, and any briefing information. Submit your labor request and we\'ll get back to you within 24 hours.',
    ],
  },
  '/crowd-control-staffing-atlanta': {
    keyword: 'crowd control staffing Atlanta',
    headline: 'Crowd Control Staffing in Atlanta',
    subhead: 'Professional crowd management and security support staff for Atlanta events — vetted, briefed, and dispatched.',
    description: [
      'Managing large crowds at Atlanta events requires experienced, calm, and prepared staff. Whether you\'re managing foot traffic at a major convention at the Georgia World Congress Center, controlling entry lines at a sold-out concert, or maintaining order at a high-volume festival, your crowd control team needs to be reliable and well-briefed.',
      'V&A Hire provides crowd control staffing support across the Atlanta area. Our workers are reviewed before approval, briefed on event-specific protocols before their shift, and dispatched directly with SMS instructions covering their assignment, meeting point, supervisor contact, and dress code.',
      'We staff registration and check-in staff, crowd flow positions, venue support roles, and general crowd management labor. Our team can also coordinate pre-event briefings — on-site or virtual — so your staff knows what to expect before they arrive. Submit a staffing request and we\'ll confirm your roster within 24 hours.',
    ],
  },
  '/brand-activation-staff-atlanta': {
    keyword: 'brand activation staff Atlanta',
    headline: 'Brand Activation Staff in Atlanta',
    subhead: 'Engaging, brand-ready staff for product launches, pop-ups, and experiential activations across Atlanta.',
    description: [
      'Brand activations in Atlanta require staff who are professional, personable, and on-brand from the first moment. Whether you\'re launching a product at Atlantic Station, running a pop-up in Ponce City Market, or executing an experiential campaign at a major festival, your activation staff represents your brand directly to consumers.',
      'V&A Hire staffs brand activation roles across Atlanta and the surrounding metro area. We provide staff for product demonstrations, sampling, registration, check-in, social media activation support, and general event labor. All workers are pre-approved, vetted by our team, and briefed with your brand guidelines and shift details before they arrive.',
      'From Midtown to Buckhead to East Atlanta, V&A Hire can build a crew for your next activation quickly. We dispatch each team member individually by SMS — no group chats, no last-minute dropouts going unnoticed. Submit your activation staffing request and we\'ll confirm your team within 24 hours.',
    ],
  },

  // --- Tier 1: New 8 ---
  '/trade-show-staffing-atlanta': {
    keyword: 'trade show staffing Atlanta',
    headline: 'Trade Show Staffing in Atlanta — Booth Staff, Floor Support, Load-In Crews',
    subhead: 'Professional trade show staff for Atlanta convention venues — booth labor, registration, floor support, and load-in crews.',
    description: [
      'Atlanta hosts some of the largest trade shows in the Southeast, with major events at the Georgia World Congress Center drawing tens of thousands of attendees across multiple days. Trade show staffing requires precision: booth setup crews that understand load-in windows, registration staff who can handle high-volume check-in, and floor support teams ready to move with the event.',
      'V&A Hire provides trade show staffing across Atlanta convention venues. Every worker is vetted before joining our pool and receives an individual SMS briefing before their shift — meeting point, supervisor contact, dress code, and role-specific instructions. No group chats. No missed messages. Just workers who show up prepared.',
      'Whether you need a 6-person load-in crew for a booth installation or 20 registration staff for a multi-day conference, V&A Hire can build your roster and confirm within 24 hours. Submit your trade show staffing request and we\'ll get back to you the same day.',
    ],
  },
  '/conference-staffing-atlanta': {
    keyword: 'conference staffing Atlanta',
    headline: 'Conference Staffing in Atlanta — Registration, Logistics, and Floor Support',
    subhead: 'Vetted conference staff for Atlanta events — registration crews, room monitors, A/V runners, and general conference labor.',
    description: [
      'Atlanta conferences range from 50-person corporate offsites to multi-day industry events with thousands of attendees. Each one needs a different staffing mix, but the requirements are consistent: workers who arrive on time, know their role, and don\'t require hand-holding on the day of your event.',
      'V&A Hire staffs Atlanta conferences with vetted, briefed workers across every role in your event. Registration and check-in staff, room monitors, break service support, load-in crews, and general event labor — all dispatched individually by SMS with shift-specific briefing details before they arrive on site.',
      'Corporate conferences have tight timelines and high visibility. A registration line that backs up at 8am sets the wrong tone for the entire day. V&A Hire\'s pre-briefing system means your staff knows exactly where to go, who to report to, and what the plan is before they walk through the door. Submit your conference staffing request and we\'ll confirm your crew within 24 hours.',
    ],
  },
  '/corporate-event-staffing-atlanta': {
    keyword: 'corporate event staffing Atlanta',
    headline: 'Corporate Event Staffing in Atlanta',
    subhead: 'Professional, vetted staff for Atlanta corporate events — galas, client dinners, product launches, and employee events.',
    description: [
      'Corporate events in Atlanta demand a different caliber of staff. Your guests are clients, partners, and executives. The margin for error is low. A setup crew that\'s still working when your attendees arrive, a server who doesn\'t know the floor plan, or a registration team that falls behind at check-in — each one reflects on you.',
      'V&A Hire provides corporate event staffing across Atlanta. We staff setup and breakdown crews, catering servers and runners, registration and check-in staff, and general event labor. Every worker in our pool is vetted and pre-approved. Every worker receives an individual SMS briefing 24 hours before their shift covering their meeting point, supervisor contact, dress code, and role.',
      'Whether you\'re staffing a 50-person client dinner in Buckhead or a 500-person gala at a downtown Atlanta venue, V&A Hire can build your crew and confirm availability within 24 hours. Submit a corporate event staffing request and we\'ll get back to you the same day.',
    ],
  },
  '/event-setup-crew-atlanta': {
    keyword: 'event setup crew Atlanta',
    headline: 'Event Setup Crew in Atlanta — Ready for Load-In',
    subhead: 'Reliable setup crews for Atlanta events — furniture, staging, AV prep, and venue configuration done right the first time.',
    description: [
      'Event setup is where everything begins. A crew that moves efficiently, handles venue equipment carefully, and finishes before your other vendors need to begin their work makes every other part of your event easier. A crew that shows up late, works slowly, or doesn\'t know the floor plan creates a cascade of problems that follows you all day.',
      'V&A Hire provides event setup crews across Atlanta. Our workers are vetted, briefed before every shift, and dispatched individually by SMS with their meeting point, supervisor contact, and setup-specific instructions. Whether you need a 3-person furniture setup crew for a ballroom flip or a 10-person load-in team for a major installation, we can staff your crew quickly.',
      'Atlanta venues have specific load-in windows, dock access requirements, and equipment protocols. V&A Hire\'s briefing system includes venue-specific details so your setup crew isn\'t learning the building on your time. Submit your setup crew request and we\'ll confirm within 24 hours.',
    ],
  },
  '/event-cleanup-crew-atlanta': {
    keyword: 'event cleanup crew Atlanta',
    headline: 'Event Cleanup Crew in Atlanta — Fast, Thorough, Professional',
    subhead: 'Post-event cleanup and breakdown crews for Atlanta venues — janitorial, teardown, and venue restore teams ready when your event ends.',
    description: [
      'Post-event cleanup is the part of event planning that gets underestimated every time. Your event ends, your guests leave, and you have a venue contract that requires the space to be restored to a specific condition within a specific window. A cleanup crew that moves fast and knows the work is the difference between hitting that window and paying overage fees.',
      'V&A Hire provides event cleanup and breakdown crews across Atlanta. We staff janitorial teams, furniture breakdown crews, trash removal labor, and full venue restore teams. Every worker is pre-approved and briefed before their shift with a meeting point, supervisor contact, and specific task breakdown for the cleanup scope.',
      'For multi-day events, we can coordinate rotating cleanup crews that maintain venue condition throughout the event before executing full breakdown and restore at the close. Submit your cleanup crew request and we\'ll confirm your team within 24 hours.',
    ],
  },
  '/catering-staff-atlanta': {
    keyword: 'catering staff Atlanta',
    headline: 'Catering Staff in Atlanta — Servers, Runners, and Banquet Labor',
    subhead: 'Professional catering support staff for Atlanta events — food runners, servers, bussers, and banquet labor ready for your next event.',
    description: [
      'Great food service at an event requires more than a catering company. It requires enough hands on the floor to execute service smoothly — servers who know the floor plan, runners who keep food moving from kitchen to table, bussers who clear plates before they stack up, and support staff who can adapt when the timeline shifts.',
      'V&A Hire provides catering support staff for Atlanta events across every service format: plated dinners, buffet service, cocktail receptions, and banquet events. All workers are vetted, pre-approved, and briefed before their shift with specific service instructions, floor layouts, and supervisor contacts.',
      'Catering staff ratios matter. For plated service, plan for 1 server per 10–12 guests. For buffet, 1 per 20–25. V&A Hire can help you calculate the right headcount for your event format and confirm your team within 24 hours of your request.',
    ],
  },
  '/event-registration-staff-atlanta': {
    keyword: 'event registration staff Atlanta',
    headline: 'Event Registration Staff in Atlanta',
    subhead: 'Professional check-in and registration staff for Atlanta conferences, galas, and corporate events.',
    description: [
      'The first impression your attendees have of your event is at registration. A check-in line that moves smoothly, staff who are confident with the system, and a process that gets guests to their seats without friction — these things are invisible when they work and unforgettable when they don\'t.',
      'V&A Hire provides event registration and check-in staff across Atlanta. Our workers are briefed on your specific check-in system, badge distribution process, and guest flow before they arrive on site. Every worker receives individual SMS instructions covering the meeting point, supervisor contact, dress code, and registration-specific details.',
      'For events up to 200 guests: plan for 4 registration staff with a 30-minute arrival window. For 200–500 guests: 6–8 staff. For larger events, we\'ll help you calculate the right ratio and build in floaters who can handle exceptions and redirect guests. Submit your request and we\'ll confirm your registration team within 24 hours.',
    ],
  },
  '/wedding-event-staff-atlanta': {
    keyword: 'wedding event staff Atlanta',
    headline: 'Wedding Event Staff in Atlanta',
    subhead: 'Vetted, professional wedding day staff for Atlanta venues — setup, service, and breakdown crews for your wedding.',
    description: [
      'A wedding day has no margin for error and no second takes. Your venue setup needs to be complete before guests arrive. Your service staff needs to execute a timeline that was planned months in advance. Your breakdown crew needs to have the space restored before the venue\'s cutoff. Every role on your wedding day crew needs to be filled by someone who shows up prepared.',
      'V&A Hire provides wedding event staff across Atlanta. We staff venue setup crews, ceremony and reception assistants, catering service support, bartender\'s assistants, and breakdown teams. Every worker is vetted before joining our pool and receives a pre-shift SMS briefing with venue-specific details, supervisor contact, and their specific role for the day.',
      'Atlanta wedding venues each have their own access protocols, vendor timelines, and load-in requirements. V&A Hire\'s briefing process includes venue-specific information so your crew arrives knowing the plan. Submit your wedding staffing request and we\'ll confirm your team within 24 hours.',
    ],
  },

  // --- Tier 3: Local / Niche ---
  '/event-staffing-buckhead-atlanta': {
    keyword: 'event staffing Buckhead Atlanta',
    headline: 'Event Staffing in Buckhead, Atlanta',
    subhead: 'Vetted event crews for Buckhead venues — corporate events, galas, private events, and more.',
    description: [
      'Buckhead is home to some of Atlanta\'s highest-profile event venues — luxury hotels, private clubs, rooftop spaces, and corporate campuses. Events in Buckhead tend to have elevated expectations: polished staff, precise timelines, and presentation that matches the venue.',
      'V&A Hire provides event staffing for Buckhead events across all roles: setup and breakdown, catering support, registration, and general event labor. Every worker is vetted and pre-approved before joining our pool. Every worker is briefed individually by SMS before their shift with venue-specific meeting points, supervisor contacts, and dress code requirements.',
      'Submit your Buckhead event staffing request and we\'ll confirm your crew within 24 hours.',
    ],
  },
  '/event-staffing-midtown-atlanta': {
    keyword: 'event staffing Midtown Atlanta',
    headline: 'Event Staffing in Midtown Atlanta',
    subhead: 'On-demand event crews for Midtown Atlanta venues — conferences, festivals, activations, and corporate events.',
    description: [
      'Midtown Atlanta is the heart of the city\'s event scene — from the Fox Theatre to Piedmont Park, from corporate campuses to rooftop venues. Midtown events range from large-scale festivals to intimate corporate functions, and staffing requirements vary just as widely.',
      'V&A Hire staffs Midtown Atlanta events with vetted, briefed workers across every role. Whether you\'re managing a 2,000-person outdoor event in Piedmont Park or a 150-person conference at a Midtown hotel, we can build your crew roster and confirm availability within 24 hours.',
      'Submit your Midtown event staffing request and we\'ll get back to you the same day.',
    ],
  },
  '/event-staffing-decatur-ga': {
    keyword: 'event staffing Decatur GA',
    headline: 'Event Staffing in Decatur, GA',
    subhead: 'Reliable event crews for Decatur events — festivals, corporate gatherings, and community events.',
    description: [
      'Decatur hosts a vibrant calendar of events year-round, including the Decatur Book Festival, local restaurant festivals, and community events across the city. Each event requires reliable, prepared staff who know their role before they arrive.',
      'V&A Hire provides event staffing for Decatur events, including setup crews, festival staff, registration workers, janitorial teams, and general event labor. All workers are vetted, pre-approved, and briefed individually by SMS before their shift.',
      'Submit your Decatur event staffing request and we\'ll confirm your crew within 24 hours.',
    ],
  },
  '/event-staffing-sandy-springs-ga': {
    keyword: 'event staffing Sandy Springs GA',
    headline: 'Event Staffing in Sandy Springs, GA',
    subhead: 'Professional event crews for Sandy Springs venues — corporate events, private functions, and community gatherings.',
    description: [
      'Sandy Springs is home to major corporate headquarters, upscale event venues, and a growing calendar of community events. Whether you\'re staffing a corporate gathering at a Sandy Springs campus or a private event at one of the area\'s premier venues, you need crew that reflects the professionalism of the location.',
      'V&A Hire provides event staffing for Sandy Springs events. Our workers are vetted, briefed before every shift, and dispatched directly by SMS with venue-specific instructions. We staff setup and breakdown crews, catering support, registration staff, and general event labor.',
      'Submit your Sandy Springs event staffing request and we\'ll confirm your team within 24 hours.',
    ],
  },
  '/event-staffing-marietta-ga': {
    keyword: 'event staffing Marietta GA',
    headline: 'Event Staffing in Marietta, GA',
    subhead: 'Vetted event crews for Marietta events — corporate gatherings, community events, and private functions.',
    description: [
      'Marietta\'s event calendar includes corporate events, community festivals, and private gatherings across the city and the broader Cobb County area. Staffing events in Marietta requires workers who are prepared before they arrive — not learning their role when they walk in the door.',
      'V&A Hire provides event staffing for Marietta and the Cobb County area. Every worker is vetted before joining our pool and briefed individually by SMS before their shift with specific meeting points, supervisor contacts, and role details.',
      'Submit your Marietta event staffing request and we\'ll confirm your crew within 24 hours.',
    ],
  },
  '/event-staffing-alpharetta-ga': {
    keyword: 'event staffing Alpharetta GA',
    headline: 'Event Staffing in Alpharetta, GA',
    subhead: 'On-demand event crews for Alpharetta — corporate events, concerts, festivals, and private functions.',
    description: [
      'Alpharetta is one of Atlanta\'s fastest-growing event markets — home to Ameris Bank Amphitheatre, a thriving corporate corridor, and a growing hospitality scene. Events in Alpharetta span outdoor concerts, corporate gatherings, and private functions that require professional, reliable staff.',
      'V&A Hire provides event staffing for Alpharetta and the North Fulton area. We staff setup crews, catering support, registration staff, janitorial teams, and general event labor. All workers are pre-approved and briefed by SMS before their shift.',
      'Submit your Alpharetta event staffing request and we\'ll confirm your crew within 24 hours.',
    ],
  },
  '/event-staffing-college-park-ga': {
    keyword: 'event staffing College Park GA',
    headline: 'Event Staffing in College Park, GA',
    subhead: 'Vetted event crews for College Park and the ATL airport corridor — convention, hospitality, and event labor.',
    description: [
      'College Park sits at the gateway to Atlanta Hartsfield-Jackson Airport and is home to major convention hotels, conference centers, and corporate event venues. The area hosts a high volume of multi-day conferences, corporate training events, and industry gatherings that require consistent, reliable staffing across multiple shifts.',
      'V&A Hire provides event staffing for College Park venues. Our workers are vetted, briefed before every shift, and dispatched individually by SMS. We staff conference registration crews, catering support, setup and breakdown teams, and general event labor.',
      'Submit your College Park event staffing request and we\'ll confirm your crew within 24 hours.',
    ],
  },
  '/event-staff-georgia-world-congress-center': {
    keyword: 'event staff Georgia World Congress Center',
    headline: 'Event Staff for the Georgia World Congress Center',
    subhead: 'Experienced event crews for GWCC events — load-in labor, registration staff, janitorial crews, and floor support.',
    description: [
      'The Georgia World Congress Center is one of the largest convention centers in the United States, hosting major trade shows, conferences, conventions, and sporting events year-round. Events at the GWCC have strict load-in windows, complex logistics, and high staffing volumes. You need workers who know how to operate in that environment.',
      'V&A Hire provides event staffing for GWCC events. We staff load-in and breakdown crews, trade show booth labor, registration and check-in staff, floor support, and janitorial teams. Every worker is vetted before joining our pool and briefed individually by SMS with GWCC-specific meeting points, dock access details, and supervisor contacts.',
      'For large GWCC events, we recommend submitting your staffing request at least 7 days out to ensure crew availability. Submit your request and we\'ll confirm your team within 24 hours.',
    ],
  },
  '/event-staff-ponce-city-market': {
    keyword: 'event staff Ponce City Market',
    headline: 'Event Staff for Ponce City Market',
    subhead: 'Professional event crews for PCM activations, pop-ups, private events, and brand activations.',
    description: [
      'Ponce City Market is one of Atlanta\'s premier mixed-use event destinations — from rooftop events and brand pop-ups to private dining experiences and corporate activations. Events at PCM require staff who understand the venue\'s flow, know the access points, and can execute in a high-visibility environment.',
      'V&A Hire provides event staff for Ponce City Market events. We staff brand activation teams, setup crews, catering support, registration workers, and general event labor. All workers are briefed with PCM-specific meeting points and access details before their shift.',
      'Submit your Ponce City Market event staffing request and we\'ll confirm your crew within 24 hours.',
    ],
  },
  '/event-staff-mercedes-benz-stadium': {
    keyword: 'event staff Mercedes-Benz Stadium area',
    headline: 'Event Staff for Mercedes-Benz Stadium Events',
    subhead: 'Experienced event crews for stadium-area events — setup, janitorial, labor, and support for large-scale Atlanta events.',
    description: [
      'Mercedes-Benz Stadium and the surrounding Westside Atlanta corridor host some of the largest events in the Southeast — Super Bowl activations, college football championships, major concerts, and stadium-scale corporate events. These events require high-volume staffing with workers who can handle large-scale logistics without hand-holding.',
      'V&A Hire provides event staff for Mercedes-Benz Stadium area events. We staff large-scale setup and breakdown crews, janitorial and cleanup teams, load-in labor, registration and check-in staff, and general event support. Every worker is vetted, pre-approved, and briefed individually by SMS before their shift.',
      'For stadium-scale events, submit your staffing request at least 7–10 days in advance. We\'ll build your roster, confirm workers, and deliver shift-specific SMS briefings to every crew member before show day. Submit your request and we\'ll confirm within 24 hours.',
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
  } else if (path === '/my-shifts') {
    page = <MyShiftsPage />
  } else if (path === '/status') {
    page = <StatusPage />
  } else if (path.startsWith('/w9/')) {
    const phoneParam = path.replace('/w9/', '')
    page = <W9FormPage phone={phoneParam} />
  } else if (path === '/w9') {
    page = <W9FormPage />
  } else if (path.startsWith('/bg-check/')) {
    const phoneParam = path.replace('/bg-check/', '')
    page = <BgCheckPage phone={phoneParam} />
  } else if (path === '/bg-check') {
    page = <BgCheckPage />
  } else if (path.startsWith('/id-upload/')) {
    const phoneParam = path.replace('/id-upload/', '')
    page = <IdUploadPage phone={phoneParam} />
  } else if (path === '/id-upload') {
    page = <IdUploadPage />
  } else if (path === '/supervisor') {
    page = <SupervisorPortalPage />
  } else if (path === '/verify') {
    page = <VideoVerifyPage />
  } else if (path === '/how-it-works') {
    page = <HowItWorksPage />
  } else if (path.startsWith('/pay/')) {
    const token = path.replace('/pay/', '')
    page = <OrganizerPortalPage token={token} />
  } else if (path === '/organizer') {
    page = <OrganizerPortalPage />
  } else if (path === '/privacy') {
    page = <PrivacyPolicyPage />
  } else if (path === '/terms') {
    page = <TermsOfServicePage />
  } else if (path === '/blog') {
    page = <BlogIndexPage />
  } else if (path.startsWith('/blog/')) {
    const slug = path.replace('/blog/', '')
    page = <BlogPostPage slug={slug} />
  } else if (path.startsWith('/join/')) {
    const code = path.replace('/join/', '')
    page = <App groupCode={code} />
  } else if (path === '/apply') {
    page = <App startScreen="application" />
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
