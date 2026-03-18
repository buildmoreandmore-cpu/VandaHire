import { useState, useEffect, createContext, useContext } from 'react'
import App from './App.jsx'
import EventRequestPage from './pages/EventRequestPage.jsx'
import AdminPage from './pages/AdminPage.jsx'
import ConfirmPage from './pages/ConfirmPage.jsx'

const RouterContext = createContext()

export function useNavigate() {
  return useContext(RouterContext)
}

function getPath() {
  return window.location.pathname
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

  const page = path.startsWith('/admin')
    ? <AdminPage />
    : path.startsWith('/events')
    ? <EventRequestPage />
    : path.startsWith('/confirm')
    ? <ConfirmPage />
    : <App />

  return (
    <RouterContext.Provider value={navigate}>
      {page}
    </RouterContext.Provider>
  )
}
