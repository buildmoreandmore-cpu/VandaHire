import { useState, useEffect } from 'react'

export default function useGeolocation() {
  const [state, setState] = useState({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    loading: true,
  })

  useEffect(() => {
    if (!navigator.geolocation) {
      setState(s => ({ ...s, error: 'Geolocation not supported', loading: false }))
      return
    }

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
  }, [])

  return state
}
