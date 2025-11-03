import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity, Alert } from 'react-native'
import { useState, useEffect, useCallback } from 'react'
import MapView, { Marker, Region, PROVIDER_GOOGLE } from 'react-native-maps'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import * as Location from 'expo-location'
import { apiClient } from '../../lib/api-client'
import { useTheme } from '../../context/ThemeContext'
import { useFocusEffect } from '@react-navigation/native'

interface TeamLocation {
  id: string
  user_id: string
  latitude: number
  longitude: number
  accuracy: number | null
  heading: number | null
  speed: number | null
  last_updated_at: string
  full_name: string
  email: string
  profile_photo_url: string | null
  role: string
  primary_trade_name: string | null
  minutes_since_update: number
}

interface MapOverviewData {
  teamLocations: TeamLocation[]
  jobLocations: any[]
  stats: {
    activeTeamMembers: number
    activeJobs: number
    maxAgeMinutes: number
  }
}

const ROLE_COLORS: Record<string, string> = {
  owner: '#10b981',
  admin: '#3b82f6',
  employee: '#8b5cf6',
  subcontractor: '#f59e0b',
}

export default function MapScreen() {
  const { brandColor } = useTheme()
  const [loading, setLoading] = useState(true)
  const [mapData, setMapData] = useState<MapOverviewData | null>(null)
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null)
  const [region, setRegion] = useState<Region>({
    latitude: -37.8136, // Default to Melbourne
    longitude: 144.9631,
    latitudeDelta: 0.5,
    longitudeDelta: 0.5,
  })

  const fetchMapData = async () => {
    try {
      const response = await apiClient.getMapOverview({ maxAge: 120 })
      setMapData(response)

      // If we have team locations, center the map on them
      if (response.teamLocations.length > 0) {
        const lats = response.teamLocations.map((l) => l.latitude)
        const longs = response.teamLocations.map((l) => l.longitude)

        const minLat = Math.min(...lats)
        const maxLat = Math.max(...lats)
        const minLong = Math.min(...longs)
        const maxLong = Math.max(...longs)

        const centerLat = (minLat + maxLat) / 2
        const centerLong = (minLong + maxLong) / 2
        const latDelta = (maxLat - minLat) * 1.5 || 0.1
        const longDelta = (maxLong - minLong) * 1.5 || 0.1

        setRegion({
          latitude: centerLat,
          longitude: centerLong,
          latitudeDelta: Math.max(latDelta, 0.05),
          longitudeDelta: Math.max(longDelta, 0.05),
        })
      }
    } catch (error: any) {
      console.error('Failed to fetch map data:', error)
      // Set empty data to show the map with no locations instead of erroring
      setMapData({
        teamLocations: [],
        jobLocations: [],
        stats: {
          activeTeamMembers: 0,
          activeJobs: 0,
          maxAgeMinutes: 120,
        },
      })
    } finally {
      setLoading(false)
    }
  }

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync()
      if (status !== 'granted') {
        return
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      })
      setCurrentLocation(location)

      // Center map on current location
      setRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      })
    } catch (error) {
      console.error('Failed to get current location:', error)
    }
  }

  // Fetch data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchMapData()
      getCurrentLocation()

      // Auto-refresh every 2 minutes
      const interval = setInterval(fetchMapData, 120000)
      return () => clearInterval(interval)
    }, [])
  )

  const handleCenterOnMe = () => {
    if (currentLocation) {
      setRegion({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      })
    } else {
      getCurrentLocation()
    }
  }

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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={brandColor} />
        <Text style={styles.loadingText}>Loading team locations...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        region={region}
        onRegionChangeComplete={setRegion}
        provider={PROVIDER_GOOGLE}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={true}
        showsScale={true}
      >
        {mapData?.teamLocations.map((location) => (
          <Marker
            key={location.id}
            coordinate={{
              latitude: location.latitude,
              longitude: location.longitude,
            }}
            title={location.full_name}
            description={`${location.role}${location.primary_trade_name ? ` • ${location.primary_trade_name}` : ''} • ${getTimeAgoText(location.minutes_since_update)}`}
            pinColor={getMarkerColor(location.role)}
          >
            <View style={styles.markerContainer}>
              <MaterialCommunityIcons
                name="account-circle"
                size={36}
                color={getMarkerColor(location.role)}
              />
              {location.minutes_since_update < 5 && (
                <View style={[styles.activeDot, { backgroundColor: getMarkerColor(location.role) }]} />
              )}
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Stats Card */}
      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <MaterialCommunityIcons name="account-group" size={24} color={brandColor} />
          <Text style={styles.statValue}>{mapData?.stats.activeTeamMembers || 0}</Text>
          <Text style={styles.statLabel}>Team Active</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <MaterialCommunityIcons name="briefcase" size={24} color={brandColor} />
          <Text style={styles.statValue}>{mapData?.stats.activeJobs || 0}</Text>
          <Text style={styles.statLabel}>Jobs</Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlButton, { backgroundColor: brandColor }]}
          onPress={handleCenterOnMe}
        >
          <MaterialCommunityIcons name="crosshairs-gps" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.controlButton, { backgroundColor: brandColor }]}
          onPress={fetchMapData}
        >
          <MaterialCommunityIcons name="refresh" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Empty State */}
      {mapData?.teamLocations.length === 0 && (
        <View style={styles.emptyState}>
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons name="map-marker-off" size={64} color="#9ca3af" />
            <Text style={styles.emptyTitle}>No Team Locations</Text>
            <Text style={styles.emptyDescription}>
              No team members are currently sharing their location.
              Location updates from the last 2 hours are shown.
            </Text>
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  statsCard: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 16,
  },
  controls: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    gap: 12,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  emptyState: {
    position: 'absolute',
    top: '30%',
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
  },
})
