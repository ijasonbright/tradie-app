import { useState, useEffect, useCallback } from 'react'
import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import { apiClient } from '@/lib/api-client'
import { Alert } from 'react-native'

const LOCATION_TASK_NAME = 'background-location-task'

// Track if background task is registered
let isBackgroundTaskRegistered = false

// Define the background task
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Background location error:', error)
    return
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] }

    // Send location updates to API
    for (const location of locations) {
      try {
        await apiClient.updateLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy || undefined,
          heading: location.coords.heading || undefined,
          speed: location.coords.speed || undefined,
          altitude: location.coords.altitude || undefined,
          isActive: true,
        })
        console.log('Background location updated:', location.coords)
      } catch (error) {
        console.error('Failed to update background location:', error)
      }
    }
  }
})

export interface LocationTrackingState {
  isEnabled: boolean
  isLoading: boolean
  hasPermission: boolean | null
  currentLocation: Location.LocationObject | null
  error: string | null
}

export interface LocationTrackingActions {
  requestPermissions: () => Promise<boolean>
  enableTracking: () => Promise<void>
  disableTracking: () => Promise<void>
  toggleTracking: () => Promise<void>
  updateCurrentLocation: () => Promise<void>
}

export function useLocationTracking(): LocationTrackingState & LocationTrackingActions {
  const [isEnabled, setIsEnabled] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Check initial permission status
  useEffect(() => {
    const checkInitialStatus = async () => {
      try {
        const { status: foregroundStatus } = await Location.getForegroundPermissionsAsync()

        // In Expo Go, background permission check might fail, so we handle it gracefully
        let backgroundStatus = Location.PermissionStatus.DENIED
        try {
          const result = await Location.getBackgroundPermissionsAsync()
          backgroundStatus = result.status
        } catch (err) {
          console.warn('Background permission check not available (Expo Go)')
        }

        // For Expo Go, we consider foreground permission sufficient
        const hasPermissions = foregroundStatus === Location.PermissionStatus.GRANTED

        setHasPermission(hasPermissions)

        // Check if location tracking is currently enabled
        try {
          const isTaskRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)
          setIsEnabled(isTaskRunning)
        } catch (err) {
          console.warn('Location task check not available:', err)
          setIsEnabled(false)
        }
      } catch (err) {
        console.error('Error checking location permissions:', err)
        setHasPermission(false)
      }
    }

    checkInitialStatus()
  }, [])

  // Request location permissions
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true)
      setError(null)

      // Request foreground location permission
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync()

      if (foregroundStatus !== Location.PermissionStatus.GRANTED) {
        setError('Foreground location permission denied')
        setHasPermission(false)
        Alert.alert(
          'Permission Required',
          'Location permission is required to track your location and show it on the team map.',
          [{ text: 'OK' }]
        )
        return false
      }

      // Try to request background location permission
      // Note: This will fail in Expo Go, but that's okay - foreground is enough for testing
      try {
        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync()

        if (backgroundStatus !== Location.PermissionStatus.GRANTED) {
          console.warn('Background location permission denied - continuing with foreground only')
          Alert.alert(
            'Foreground Location Only',
            'Background location is not available in Expo Go. Your location will only update while the app is open. To enable background tracking, build a development build.',
            [{ text: 'OK' }]
          )
        }
      } catch (err) {
        console.warn('Background permission not available (Expo Go limitation):', err)
        // Continue anyway with foreground permission
      }

      setHasPermission(true)
      return true
    } catch (err) {
      console.error('Error requesting permissions:', err)
      setError(err instanceof Error ? err.message : 'Failed to request permissions')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Update current location (one-time)
  const updateCurrentLocation = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      })

      setCurrentLocation(location)

      // Send to API
      await apiClient.updateLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || undefined,
        heading: location.coords.heading || undefined,
        speed: location.coords.speed || undefined,
        altitude: location.coords.altitude || undefined,
        isActive: true,
      })

      console.log('Current location updated')
    } catch (err) {
      console.error('Error updating current location:', err)
      setError(err instanceof Error ? err.message : 'Failed to update location')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Enable location tracking (foreground + background)
  const enableTracking = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Check permissions first
      if (!hasPermission) {
        const granted = await requestPermissions()
        if (!granted) {
          return
        }
      }

      // Try to start background location updates (will fail in Expo Go)
      try {
        // Register background task if not already registered
        if (!isBackgroundTaskRegistered) {
          isBackgroundTaskRegistered = true
        }

        // Start background location updates
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 300000, // 5 minutes
          distanceInterval: 100, // 100 meters
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: 'Location Tracking Active',
            notificationBody: 'Your location is being shared with your team',
            notificationColor: '#007AFF',
          },
        })
        console.log('Background location tracking enabled')
      } catch (bgErr) {
        console.warn('Background location not available (Expo Go limitation):', bgErr)
        // Continue without background tracking - we'll just update location manually
        Alert.alert(
          'Foreground Only',
          'Location tracking enabled for foreground only. In Expo Go, your location will only update while the app is open. Build a development build for full background tracking.',
          [{ text: 'OK' }]
        )
      }

      // Get initial location
      await updateCurrentLocation()

      // Update tracking state in API
      await apiClient.toggleLocationSharing(true)

      setIsEnabled(true)
      console.log('Location tracking enabled')
    } catch (err) {
      console.error('Error enabling tracking:', err)
      setError(err instanceof Error ? err.message : 'Failed to enable tracking')
      Alert.alert(
        'Error',
        'Failed to enable location tracking. Please try again.',
        [{ text: 'OK' }]
      )
    } finally {
      setIsLoading(false)
    }
  }, [hasPermission, requestPermissions, updateCurrentLocation])

  // Disable location tracking
  const disableTracking = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Stop background location updates
      const isTaskRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)
      if (isTaskRunning) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME)
      }

      // Update tracking state in API
      await apiClient.toggleLocationSharing(false)

      setIsEnabled(false)
      console.log('Location tracking disabled')
    } catch (err) {
      console.error('Error disabling tracking:', err)
      setError(err instanceof Error ? err.message : 'Failed to disable tracking')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Toggle tracking on/off
  const toggleTracking = useCallback(async () => {
    if (isEnabled) {
      await disableTracking()
    } else {
      await enableTracking()
    }
  }, [isEnabled, enableTracking, disableTracking])

  return {
    // State
    isEnabled,
    isLoading,
    hasPermission,
    currentLocation,
    error,
    // Actions
    requestPermissions,
    enableTracking,
    disableTracking,
    toggleTracking,
    updateCurrentLocation,
  }
}
