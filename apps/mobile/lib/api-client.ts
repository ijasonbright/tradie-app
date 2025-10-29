import * as SecureStore from 'expo-secure-store'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://tradie-app-web.vercel.app/api'

/**
 * API Client for making authenticated requests to the backend
 */
class ApiClient {
  private async getAuthToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync('session_token')
    } catch (error) {
      console.error('Failed to get auth token:', error)
      return null
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getAuthToken()

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    }

    // Add authorization header if token exists
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const url = `${API_URL}${endpoint}`
    console.log(`API Request: ${options.method || 'GET'} ${url}`)

    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`API Error: ${response.status} ${response.statusText}`, errorText)
      throw new Error(`API request failed: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return data as T
  }

  // Jobs API
  async getJobs(params?: { status?: string; assigned_to_me?: boolean }) {
    const queryParams = new URLSearchParams()
    if (params?.status) queryParams.append('status', params.status)
    if (params?.assigned_to_me) queryParams.append('assigned_to_me', 'true')

    const query = queryParams.toString()
    const endpoint = query ? `/jobs?${query}` : '/jobs'

    return this.request<{ jobs: any[] }>(endpoint)
  }

  async getJob(id: string) {
    return this.request<{ job: any }>(`/jobs/${id}`)
  }

  async completeJob(id: string) {
    return this.request<{ success: boolean; job: any; warnings: string[] | null; message: string }>(
      `/jobs/${id}/complete`,
      {
        method: 'POST',
      }
    )
  }

  async updateJob(id: string, data: any) {
    return this.request<{ success: boolean; job: any }>(
      `/jobs/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    )
  }

  async createJob(data: any) {
    return this.request<{ success: boolean; job: any }>(
      '/jobs',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    )
  }

  // Clients API
  async getClients(params?: { search?: string }) {
    const queryParams = new URLSearchParams()
    if (params?.search) queryParams.append('search', params.search)

    const query = queryParams.toString()
    const endpoint = query ? `/clients?${query}` : '/clients'

    return this.request<{ clients: any[] }>(endpoint)
  }

  async getClient(id: string) {
    return this.request<{ client: any }>(`/clients/${id}`)
  }

  // Appointments API
  async getAppointments(params?: { start_date?: string; end_date?: string }) {
    const queryParams = new URLSearchParams()
    if (params?.start_date) queryParams.append('start_date', params.start_date)
    if (params?.end_date) queryParams.append('end_date', params.end_date)

    const query = queryParams.toString()
    const endpoint = query ? `/appointments?${query}` : '/appointments'

    return this.request<{ appointments: any[] }>(endpoint)
  }

  // Organizations API
  async getOrganizations() {
    return this.request<{ organizations: any[] }>('/organizations')
  }

  // User/Profile API
  async getCurrentUser() {
    return this.request<{ user: any }>('/users/me')
  }
}

export const apiClient = new ApiClient()
