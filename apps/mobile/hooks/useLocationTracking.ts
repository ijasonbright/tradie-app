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
        const { status: backgroundStatus } = await Location.getBackgroundPermissionsAsync()

        const hasBothPermissions =
          foregroundStatus === Location.PermissionStatus.GRANTED &&
          backgroundStatus === Location.PermissionStatus.GRANTED

        setHasPermission(hasBothPermissions)

        // Check if location tracking is currently enabled
        const isTaskRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)
        setIsEnabled(isTaskRunning)
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

      // Request background location permission
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync()

      if (backgroundStatus !== Location.PermissionStatus.GRANTED) {
        setError('Background location permission denied')
        setHasPermission(false)
        Alert.alert(
          'Background Permission Required',
          'Background location permission allows your team to see your location even when the app is closed.',
          [{ text: 'OK' }]
        )
        return false
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
