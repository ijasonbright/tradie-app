import React, { createContext, useContext, useState, useEffect } from 'react'
import * as SecureStore from 'expo-secure-store'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://tradie-app-web.vercel.app/api'

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
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [sessionToken, setSessionToken] = useState<string | null>(null)

  // Load session on mount
  useEffect(() => {
    const loadSession = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync('session_token')
        const storedUser = await SecureStore.getItemAsync('user_data')

        if (storedToken && storedUser) {
          setSessionToken(storedToken)
          setUser(JSON.parse(storedUser))
          setIsSignedIn(true)
        }
      } catch (error) {
        console.error('Failed to load session:', error)
      } finally {
        setIsLoaded(true)
      }
    }
    loadSession()
  }, [])

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

      setSessionToken(token)
      setUser(user)
      setIsSignedIn(true)
    } catch (error) {
      console.error('Sign in failed:', error)
      throw error
    }
  }

  const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
    try {
      // Note: Currently using sign-in endpoint as Clerk doesn't support
      // password-based sign-up via API. Users should be created via web app first.
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

      setSessionToken(token)
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

      setSessionToken(null)
      setUser(null)
      setIsSignedIn(false)
    } catch (error) {
      console.error('Sign out failed:', error)
    }
  }

  return (
    <AuthContext.Provider value={{ isLoaded, isSignedIn, user, signIn, signUp, signOut }}>
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
