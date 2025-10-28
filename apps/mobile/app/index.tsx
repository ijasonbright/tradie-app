import { useEffect } from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { useAuth } from '../lib/auth'
import { useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'

export default function Index() {
  const { isLoaded, isSignedIn } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoaded) return

    if (isSignedIn) {
      // User is signed in, redirect to main app (tabs)
      router.replace('/(tabs)/jobs')
    } else {
      // User is not signed in, redirect to sign in
      router.replace('/(auth)/sign-in')
    }
  }, [isLoaded, isSignedIn])

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2563eb" />
      <StatusBar style="auto" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
