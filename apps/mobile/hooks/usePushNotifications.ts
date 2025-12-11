import { useState, useEffect, useRef } from 'react'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { apiClient } from '../lib/api-client'

// Configure how notifications are handled when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

export function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null)
  const [notification, setNotification] = useState<Notifications.Notification | null>(null)
  const notificationListener = useRef<Notifications.Subscription>()
  const responseListener = useRef<Notifications.Subscription>()

  useEffect(() => {
    registerForPushNotificationsAsync().then(token => {
      if (token) {
        setExpoPushToken(token)
        // Register token with backend
        registerTokenWithBackend(token)
      }
    })

    // Listen for notifications received while app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      setNotification(notification)
    })

    // Listen for user interactions with notifications
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response)
      // Handle notification tap - navigate to relevant screen
      handleNotificationResponse(response)
    })

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove()
      }
      if (responseListener.current) {
        responseListener.current.remove()
      }
    }
  }, [])

  return {
    expoPushToken,
    notification,
  }
}

async function registerForPushNotificationsAsync() {
  let token: string | null = null

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    })
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    console.log('Failed to get push token for push notification!')
    return null
  }

  try {
    // Get projectId from app.json or use environment variable
    const projectId = process.env.EXPO_PUBLIC_PROJECT_ID

    token = (await Notifications.getExpoPushTokenAsync({
      projectId: projectId,
    })).data
    console.log('Expo Push Token:', token)
  } catch (error) {
    console.error('Error getting push token:', error)
    console.error('Make sure to set EXPO_PUBLIC_PROJECT_ID in .env or run: npx expo login && eas init')
  }

  return token
}

async function registerTokenWithBackend(token: string) {
  try {
    const response = await apiClient.registerPushToken(token)
    console.log('Push token registered with backend:', response.message)
  } catch (error) {
    console.error('Error registering push token:', error)
  }
}

function handleNotificationResponse(response: Notifications.NotificationResponse) {
  const data = response.notification.request.content.data

  // Handle different notification types
  if (data.type === 'job_assigned') {
    // Navigate to job detail
    console.log('Navigate to job:', data.job_id)
    // router.push(`/jobs/${data.job_id}`)
  } else if (data.type === 'invoice_paid') {
    // Navigate to invoice detail
    console.log('Navigate to invoice:', data.invoice_id)
    // router.push(`/invoices/${data.invoice_id}`)
  } else if (data.type === 'appointment_reminder') {
    // Navigate to calendar
    console.log('Navigate to appointment:', data.appointment_id)
    // router.push('/calendar')
  }
}
