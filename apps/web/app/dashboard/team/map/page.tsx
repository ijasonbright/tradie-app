'use client'

import { useEffect, useState } from 'react'
import { APIProvider, Map, AdvancedMarker, InfoWindow } from '@vis.gl/react-google-maps'

interface TeamLocation {
  id: string
  user_id: string
  latitude: number
  longitude: number
  accuracy: number | null
  heading: number | null
  speed: number | null
  altitude: number | null
  is_active: boolean
  last_updated_at: string
  full_name: string
  email: string
  phone: string | null
  profile_photo_url: string | null
  role: string
  employment_type: string | null
  primary_trade_name: string | null
  minutes_since_update: number
}

interface MapData {
  locations: TeamLocation[]
  count: number
  maxAgeMinutes: number
}

const ROLE_COLORS: Record<string, string> = {
  owner: '#10b981',
  admin: '#3b82f6',
  employee: '#8b5cf6',
  subcontractor: '#f59e0b',
}

const DEFAULT_CENTER = { lat: -37.8136, lng: 144.9631 } // Melbourne
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''

export default function TeamMapPage() {
  const [mapData, setMapData] = useState<MapData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedLocation, setSelectedLocation] = useState<TeamLocation | null>(null)
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER)
  const [mapZoom, setMapZoom] = useState(11)

  const fetchMapData = async () => {
    try {
      const response = await fetch('/api/team/locations?maxAge=120')
      if (!response.ok) {
        throw new Error('Failed to fetch team locations')
      }
      const data = await response.json()

      // Convert numeric strings to numbers (PostgreSQL returns them as strings)
      if (data.locations) {
        data.locations = data.locations.map((loc: any) => ({
          ...loc,
          latitude: parseFloat(loc.latitude),
          longitude: parseFloat(loc.longitude),
          accuracy: loc.accuracy ? parseFloat(loc.accuracy) : null,
          heading: loc.heading ? parseFloat(loc.heading) : null,
          speed: loc.speed ? parseFloat(loc.speed) : null,
          altitude: loc.altitude ? parseFloat(loc.altitude) : null,
          minutes_since_update: parseFloat(loc.minutes_since_update),
        }))
      }

      setMapData(data)
      setError(null)

      // Auto-center map on team locations
      if (data.locations && data.locations.length > 0) {
        const lats = data.locations.map((l: TeamLocation) => l.latitude)
        const lngs = data.locations.map((l: TeamLocation) => l.longitude)

        const minLat = Math.min(...lats)
        const maxLat = Math.max(...lats)
        const minLng = Math.min(...lngs)
        const maxLng = Math.max(...lngs)

        const centerLat = (minLat + maxLat) / 2
        const centerLng = (minLng + maxLng) / 2

        setMapCenter({ lat: centerLat, lng: centerLng })

        // Calculate zoom based on bounds
        const latDiff = maxLat - minLat
        const lngDiff = maxLng - minLng
        const maxDiff = Math.max(latDiff, lngDiff)

        // Simple zoom calculation
        let zoom = 11
        if (maxDiff < 0.01) zoom = 15
        else if (maxDiff < 0.05) zoom = 13
        else if (maxDiff < 0.1) zoom = 12
        else if (maxDiff < 0.5) zoom = 10
        else zoom = 9

        setMapZoom(zoom)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMapData()
    // Auto-refresh every 2 minutes
    const interval = setInterval(fetchMapData, 120000)
    return () => clearInterval(interval)
  }, [])

  const getMarkerColor = (role: string): string => {
    return ROLE_COLORS[role] || '#6b7280'
  }

  const getTimeAgoText = (minutes: number): string => {
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${Math.round(minutes)}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  const getRoleBadgeColor = (role: string): string => {
    switch (role) {
      case 'owner':
        return 'bg-green-100 text-green-800'
      case 'admin':
        return 'bg-blue-100 text-blue-800'
      case 'employee':
        return 'bg-purple-100 text-purple-800'
      case 'subcontractor':
        return 'bg-amber-100 text-amber-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-semibold mb-2">Google Maps API Key Required</h3>
          <p className="text-red-700">
            Please set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in your environment variables.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Team Location Map</h1>
            <p className="text-sm text-gray-600 mt-1">
              {loading ? 'Loading...' : `Showing ${mapData?.count || 0} team members (last 2 hours)`}
            </p>
          </div>
          <button
            onClick={fetchMapData}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative">
        {error && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 bg-red-50 border border-red-200 rounded-lg p-4 shadow-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
          <Map
            defaultCenter={DEFAULT_CENTER}
            center={mapCenter}
            defaultZoom={11}
            zoom={mapZoom}
            mapId="team-location-map"
            style={{ width: '100%', height: '100%' }}
          >
            {mapData?.locations.map((location) => (
              <AdvancedMarker
                key={location.id}
                position={{ lat: location.latitude, lng: location.longitude }}
                onClick={() => setSelectedLocation(location)}
              >
                <div
                  className="w-10 h-10 rounded-full border-4 border-white shadow-lg flex items-center justify-center cursor-pointer hover:scale-110 transition-transform"
                  style={{ backgroundColor: getMarkerColor(location.role) }}
                >
                  <span className="text-white font-bold text-sm">
                    {location.full_name?.split(' ').map((n) => n[0]).join('').substring(0, 2) || '??'}
                  </span>
                  {location.minutes_since_update < 5 && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full animate-pulse" />
                  )}
                </div>
              </AdvancedMarker>
            ))}

            {selectedLocation && (
              <InfoWindow
                position={{ lat: selectedLocation.latitude, lng: selectedLocation.longitude }}
                onCloseClick={() => setSelectedLocation(null)}
              >
                <div className="p-2 min-w-[250px]">
                  <div className="flex items-start gap-3 mb-3">
                    {selectedLocation.profile_photo_url ? (
                      <img
                        src={selectedLocation.profile_photo_url}
                        alt={selectedLocation.full_name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: getMarkerColor(selectedLocation.role) }}
                      >
                        {selectedLocation.full_name?.split(' ').map((n) => n[0]).join('').substring(0, 2) || '??'}
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{selectedLocation.full_name}</h3>
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium mt-1 ${getRoleBadgeColor(selectedLocation.role)}`}>
                        {selectedLocation.role}
                      </span>
                    </div>
                  </div>

                  {selectedLocation.primary_trade_name && (
                    <div className="text-sm text-gray-600 mb-2">
                      <span className="font-medium">Trade:</span> {selectedLocation.primary_trade_name}
                    </div>
                  )}

                  <div className="text-sm text-gray-600 mb-2">
                    <span className="font-medium">Email:</span> {selectedLocation.email}
                  </div>

                  {selectedLocation.phone && (
                    <div className="text-sm text-gray-600 mb-2">
                      <span className="font-medium">Phone:</span> {selectedLocation.phone}
                    </div>
                  )}

                  <div className="border-t pt-2 mt-2">
                    <div className="text-xs text-gray-500">
                      Last updated: {getTimeAgoText(selectedLocation.minutes_since_update)}
                    </div>
                    {selectedLocation.accuracy && (
                      <div className="text-xs text-gray-500">
                        Accuracy: ±{Math.round(selectedLocation.accuracy)}m
                      </div>
                    )}
                    {selectedLocation.speed && selectedLocation.speed > 0 && (
                      <div className="text-xs text-gray-500">
                        Speed: {Math.round(selectedLocation.speed * 3.6)} km/h
                      </div>
                    )}
                  </div>
                </div>
              </InfoWindow>
            )}
          </Map>
        </APIProvider>
      </div>

      {/* Team List Sidebar */}
      <div className="absolute right-4 top-24 bottom-4 w-80 bg-white rounded-lg shadow-lg overflow-hidden flex flex-col">
        <div className="bg-gray-50 px-4 py-3 border-b">
          <h2 className="font-semibold text-gray-900">Team Members</h2>
          <p className="text-xs text-gray-600 mt-1">Click on a marker or card to view details</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}

          {!loading && mapData?.locations.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="font-medium">No team members sharing location</p>
              <p className="text-sm text-gray-400 mt-1">Locations from the last 2 hours are shown</p>
            </div>
          )}

          {mapData?.locations.map((location) => (
            <div
              key={location.id}
              onClick={() => {
                setSelectedLocation(location)
                setMapCenter({ lat: location.latitude, lng: location.longitude })
                setMapZoom(15)
              }}
              className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                selectedLocation?.id === location.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                {location.profile_photo_url ? (
                  <img
                    src={location.profile_photo_url}
                    alt={location.full_name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: getMarkerColor(location.role) }}
                  >
                    {location.full_name?.split(' ').map((n) => n[0]).join('').substring(0, 2) || '??'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 truncate">{location.full_name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getRoleBadgeColor(location.role)}`}>
                      {location.role}
                    </span>
                    {location.minutes_since_update < 5 && (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        Live
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {location.primary_trade_name && (
                <div className="text-xs text-gray-600 mb-1">
                  {location.primary_trade_name}
                </div>
              )}
              <div className="text-xs text-gray-500">
                Updated {getTimeAgoText(location.minutes_since_update)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
