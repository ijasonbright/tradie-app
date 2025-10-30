import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useAuth } from '@clerk/clerk-expo'
import apiClient from '../lib/api-client'

interface Organization {
  id: string
  name: string
  logoUrl?: string | null
  primaryColor?: string | null
  [key: string]: any
}

interface ThemeContextType {
  organization: Organization | null
  brandColor: string
  logoUrl: string | null
  loading: boolean
  refreshOrganization: () => Promise<void>
}

const DEFAULT_BRAND_COLOR = '#1E40AF' // Blue-800

const ThemeContext = createContext<ThemeContextType>({
  organization: null,
  brandColor: DEFAULT_BRAND_COLOR,
  logoUrl: null,
  loading: true,
  refreshOrganization: async () => {},
})

export const useTheme = () => useContext(ThemeContext)

interface ThemeProviderProps {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { isSignedIn } = useAuth()
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)

  const loadOrganization = async () => {
    if (!isSignedIn) {
      setOrganization(null)
      setLoading(false)
      return
    }

    try {
      const response = await apiClient.getCurrentOrganization()
      setOrganization(response.organization)
    } catch (error) {
      console.error('Error loading organization:', error)
      setOrganization(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOrganization()
  }, [isSignedIn])

  const brandColor = organization?.primaryColor || organization?.primary_color || DEFAULT_BRAND_COLOR
  const logoUrl = organization?.logoUrl || organization?.logo_url || null

  return (
    <ThemeContext.Provider
      value={{
        organization,
        brandColor,
        logoUrl,
        loading,
        refreshOrganization: loadOrganization,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}
