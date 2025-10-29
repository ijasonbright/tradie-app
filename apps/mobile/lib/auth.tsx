import React, { createContext, useContext, useState, useEffect } from 'react'
import * as SecureStore from 'expo-secure-store'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://tradie-app-web.vercel.app/api'
const WEB_URL = 'https://tradie-app-web.vercel.app'

WebBrowser.maybeCompleteAuthSession()

type User = {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
  fullName: string
}

type AuthContextType = {
  isLoaded: boolean
  isSignedIn: boolean
  user: User | null
  signIn: (email: string, password: string) => Promise<void>
  signInWithOAuth: () => Promise<void>
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [user, setUser] = useState<User | null>(null)

  // Load session on mount
  useEffect(() => {
    const loadSession = async () => {
      try {
        console.log('Loading stored session...')
        const storedToken = await SecureStore.getItemAsync('session_token')
        const storedUser = await SecureStore.getItemAsync('user_data')

        console.log('Stored token exists:', !!storedToken)
        console.log('Stored user exists:', !!storedUser)

        if (storedToken && storedUser) {
          const userData = JSON.parse(storedUser)
          console.log('Loaded user from storage:', userData)
          setUser(userData)
          setIsSignedIn(true)
          console.log('Session restored successfully!')
        } else {
          console.log('No stored session found')
        }
      } catch (error) {
        console.error('Failed to load session:', error)
      } finally {
        setIsLoaded(true)
      }
    }
    loadSession()
  }, [])

  // Handle deep link OAuth callback
  useEffect(() => {
    const handleUrl = async (event: { url: string }) => {
      const url = event.url
      console.log('Deep link received:', url)

      if (url.startsWith('tradieapp://auth-callback')) {
        console.log('Processing auth callback...')
        const params = new URL(url).searchParams
        const token = params.get('token')
        const userJson = params.get('user')

        console.log('Token exists:', !!token)
        console.log('User JSON exists:', !!userJson)

        if (token && userJson) {
          try {
            const userData = JSON.parse(decodeURIComponent(userJson))
            console.log('Parsed user data:', userData)

            const user: User = {
              id: userData.id,
              firstName: userData.firstName || null,
              lastName: userData.lastName || null,
              email: userData.email,
              fullName: userData.fullName,
            }

            console.log('Saving to SecureStore...')
            await SecureStore.setItemAsync('session_token', token)
            await SecureStore.setItemAsync('user_data', JSON.stringify(user))

            console.log('Setting auth state...')
            setUser(user)
            setIsSignedIn(true)
            console.log('Auth state updated! isSignedIn should now be true')
          } catch (error) {
            console.error('Failed to process OAuth callback:', error)
          }
        } else {
          console.log('Missing token or user data')
        }
      } else {
        console.log('URL does not start with tradieapp://auth-callback')
      }
    }

    // Listen for deep link events
    const subscription = Linking.addEventListener('url', handleUrl)

    // Check if app was opened with a URL
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleUrl({ url })
      }
    })

    return () => {
      subscription.remove()
    }
  }, [])

  const signInWithOAuth = async () => {
    try {
      // Open Clerk's sign-in page directly
      // After sign-in, Clerk will redirect to /mobile-callback which generates token
      // and redirects to tradieapp://auth-callback
      const signInUrl = `${WEB_URL}/sign-in?redirect_url=${encodeURIComponent('/mobile-callback')}`

      console.log('Opening sign-in URL:', signInUrl)

      const result = await WebBrowser.openAuthSessionAsync(
        signInUrl,
        'tradieapp://auth-callback'
      )

      console.log('WebBrowser result:', result)

      if (result.type === 'success' && result.url) {
        // Process the callback URL directly - don't wait for deep link event
        console.log('OAuth success! Processing callback URL...')

        const url = result.url
        if (url.startsWith('tradieapp://auth-callback')) {
          const params = new URL(url).searchParams
          const token = params.get('token')
          const userJson = params.get('user')

          console.log('Token exists:', !!token)
          console.log('User JSON exists:', !!userJson)

          if (token && userJson) {
            const userData = JSON.parse(decodeURIComponent(userJson))
            console.log('Parsed user data:', userData)

            const user: User = {
              id: userData.id,
              firstName: userData.firstName || null,
              lastName: userData.lastName || null,
              email: userData.email,
              fullName: userData.fullName,
            }

            console.log('Saving to SecureStore...')
            await SecureStore.setItemAsync('session_token', token)
            await SecureStore.setItemAsync('user_data', JSON.stringify(user))

            console.log('Setting auth state...')
            setUser(user)
            setIsSignedIn(true)
            console.log('Auth state updated! isSignedIn should now be true')
          }
        }
      } else if (result.type === 'cancel') {
        throw new Error('Sign in cancelled')
      }
    } catch (error) {
      console.error('OAuth sign in failed:', error)
      throw error
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_URL}/mobile-auth/sign-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to sign in')
      }

      const { token, user: userData } = await response.json()

      const user: User = {
        id: userData.id,
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
        fullName: userData.fullName,
      }

      await SecureStore.setItemAsync('session_token', token)
      await SecureStore.setItemAsync('user_data', JSON.stringify(user))

      setUser(user)
      setIsSignedIn(true)
    } catch (error) {
      console.error('Sign in failed:', error)
      throw error
    }
  }

  const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
    try {
      const response = await fetch(`${API_URL}/mobile-auth/sign-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to sign up')
      }

      const { token, user: userData } = await response.json()

      const user: User = {
        id: userData.id,
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
        fullName: userData.fullName,
      }

      await SecureStore.setItemAsync('session_token', token)
      await SecureStore.setItemAsync('user_data', JSON.stringify(user))

      setUser(user)
      setIsSignedIn(true)
    } catch (error) {
      console.error('Sign up failed:', error)
      throw error
    }
  }

  const signOut = async () => {
    try {
      await SecureStore.deleteItemAsync('session_token')
      await SecureStore.deleteItemAsync('user_data')

      setUser(null)
      setIsSignedIn(false)
    } catch (error) {
      console.error('Sign out failed:', error)
    }
  }

  return (
    <AuthContext.Provider value={{ isLoaded, isSignedIn, user, signIn, signInWithOAuth, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

// Custom hooks matching Clerk's API
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return {
    isLoaded: context.isLoaded,
    isSignedIn: context.isSignedIn,
    user: context.user,
    signOut: context.signOut,
  }
}

export function useUser() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useUser must be used within AuthProvider')
  }
  return {
    user: context.user,
    isLoaded: context.isLoaded,
  }
}

export function useSignIn() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useSignIn must be used within AuthProvider')
  }
  return {
    signIn: {
      create: async ({ identifier, password }: { identifier: string; password: string }) => {
        await context.signIn(identifier, password)
        return { createdSessionId: '1' }
      }
    },
    signInWithOAuth: context.signInWithOAuth,
    setActive: async () => {},
    isLoaded: context.isLoaded,
  }
}

export function useSignUp() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useSignUp must be used within AuthProvider')
  }
  return {
    signUp: {
      create: async ({ emailAddress, password, firstName, lastName }: any) => {
        await context.signUp(emailAddress, password, firstName, lastName)
      },
      prepareEmailAddressVerification: async () => {},
      attemptEmailAddressVerification: async () => {
        return { createdSessionId: '1' }
      }
    },
    setActive: async () => {},
    isLoaded: context.isLoaded,
  }
}

// Export API client with auth token
export async function apiClient(endpoint: string, options: RequestInit = {}) {
  const token = await SecureStore.getItemAsync('session_token')

  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers,
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`)
  }

  return response.json()
}
