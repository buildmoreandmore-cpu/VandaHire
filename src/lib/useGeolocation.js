import { useState, useEffect } from 'react'

export default function useGeolocation(enabled = true) {
  const [state, setState] = useState({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    loading: false,
  })

  useEffect(() => {
    if (!enabled) return

    if (!navigator.geolocation) {
      setState(s => ({ ...s, error: 'Geolocation not supported', loading: false }))
      return
    }

    setState(s => ({ ...s, loading: true }))

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setState({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          error: null,
          loading: false,
        })
      },
      (err) => {
        setState(s => ({ ...s, error: err.message, loading: false }))
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    )

    return () => navigator.geolocation.clearWatch(id)
  }, [enabled])

  return state
}
