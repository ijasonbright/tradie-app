import { useEffect, useRef, useState } from 'react'
import { View, StyleSheet, Animated, Easing, Image, Text } from 'react-native'
import { useAuth } from '../lib/auth'
import { useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useTheme } from '../context/ThemeContext'

// Default Taskforce logo
const DEFAULT_LOGO = require('../assets/default-logo.png')

export default function Index() {
  const { isLoaded, isSignedIn } = useAuth()
  const { brandColor, logoUrl, loading: themeLoading } = useTheme()
  const router = useRouter()
  const [showSplash, setShowSplash] = useState(true)

  // Debug logging
  useEffect(() => {
    console.log('[Splash Screen] Brand Color:', brandColor)
    console.log('[Splash Screen] Logo URL:', logoUrl)
    console.log('[Splash Screen] Theme Loading:', themeLoading)
  }, [brandColor, logoUrl, themeLoading])

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.8)).current
  const pulseAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    // Start animations
    Animated.parallel([
      // Fade in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      // Scale up
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // After initial animation, start pulsing
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start()
    })
  }, [])

  useEffect(() => {
    if (!isLoaded || themeLoading) return

    // Show splash for at least 1.5 seconds for smooth experience
    const minSplashTime = setTimeout(() => {
      setShowSplash(false)

      if (isSignedIn) {
        router.replace('/(tabs)/jobs')
      } else {
        router.replace('/(auth)/sign-in')
      }
    }, 1500)

    return () => clearTimeout(minSplashTime)
  }, [isLoaded, isSignedIn, themeLoading])

  const animatedStyle = {
    opacity: fadeAnim,
    transform: [
      { scale: Animated.multiply(scaleAnim, pulseAnim) }
    ],
  }

  return (
    <View style={[styles.container, { backgroundColor: brandColor }]}>
      <StatusBar style="light" />

      <Animated.View style={[styles.logoContainer, animatedStyle]}>
        {logoUrl ? (
          // Organization's custom logo from database
          <Image
            source={{ uri: logoUrl }}
            style={styles.logo}
            resizeMode="contain"
          />
        ) : (
          // Default Taskforce logo
          <Image
            source={DEFAULT_LOGO}
            style={styles.logo}
            resizeMode="contain"
          />
        )}
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 250,
    height: 150,
  },
})
