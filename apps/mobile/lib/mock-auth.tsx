import React, { createContext, useContext, useState, useEffect } from 'react'
import * as SecureStore from 'expo-secure-store'

type User = {
  id: string
  firstName: string
  lastName: string
  email: string
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

export function MockAuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    // Check for existing session
    const loadSession = async () => {
      const storedUser = await SecureStore.getItemAsync('mock_user')
      if (storedUser) {
        setUser(JSON.parse(storedUser))
        setIsSignedIn(true)
      }
      setIsLoaded(true)
    }
    loadSession()
  }, [])

  const signIn = async (email: string, password: string) => {
    // Mock sign in - accept any email/password
    const mockUser: User = {
      id: '1',
      firstName: 'Demo',
      lastName: 'User',
      email: email,
    }
    await SecureStore.setItemAsync('mock_user', JSON.stringify(mockUser))
    setUser(mockUser)
    setIsSignedIn(true)
  }

  const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
    // Mock sign up - accept any data
    const mockUser: User = {
      id: '1',
      firstName,
      lastName,
      email,
    }
    await SecureStore.setItemAsync('mock_user', JSON.stringify(mockUser))
    setUser(mockUser)
    setIsSignedIn(true)
  }

  const signOut = async () => {
    await SecureStore.deleteItemAsync('mock_user')
    setUser(null)
    setIsSignedIn(false)
  }

  return (
    <AuthContext.Provider value={{ isLoaded, isSignedIn, user, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within MockAuthProvider')
  }
  return context
}

export function useUser() {
  const { user } = useAuth()
  return { user, isLoaded: true }
}

export function useSignIn() {
  const { signIn } = useAuth()
  return {
    signIn: {
      create: async ({ identifier, password }: { identifier: string; password: string }) => {
        await signIn(identifier, password)
        return { createdSessionId: '1' }
      }
    },
    setActive: async () => {},
    isLoaded: true,
  }
}

export function useSignUp() {
  const { signUp } = useAuth()
  return {
    signUp: {
      create: async ({ emailAddress, password, firstName, lastName }: any) => {
        await signUp(emailAddress, password, firstName, lastName)
      },
      prepareEmailAddressVerification: async () => {},
      attemptEmailAddressVerification: async () => {
        return { createdSessionId: '1' }
      }
    },
    setActive: async () => {},
    isLoaded: true,
  }
}
