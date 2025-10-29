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

  async createClient(data: any) {
    return this.request<{ success: boolean; client: any }>(
      '/clients',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    )
  }

  async getClient(id: string) {
    return this.request<{ client: any }>(`/clients/${id}`)
  }

  async updateClient(id: string, data: any) {
    return this.request<{ success: boolean; client: any }>(
      `/clients/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    )
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

  async createAppointment(data: any) {
    return this.request<{ success: boolean; appointment: any }>(
      '/appointments',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    )
  }

  // Organizations API
  async getOrganizations() {
    return this.request<{ organizations: any[] }>('/organizations')
  }

  // Invoices API
  async getInvoices(params?: { status?: string; clientId?: string; jobId?: string }) {
    const queryParams = new URLSearchParams()
    if (params?.status) queryParams.append('status', params.status)
    if (params?.clientId) queryParams.append('clientId', params.clientId)
    if (params?.jobId) queryParams.append('jobId', params.jobId)

    const query = queryParams.toString()
    const endpoint = query ? `/invoices?${query}` : '/invoices'

    return this.request<{ invoices: any[] }>(endpoint)
  }

  async getInvoice(id: string) {
    return this.request<{ invoice: any }>(`/invoices/${id}`)
  }

  async createInvoice(data: any) {
    return this.request<{ success: boolean; invoice: any }>(
      '/invoices',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    )
  }

  async sendInvoice(id: string) {
    return this.request<{ success: boolean; message: string }>(
      `/invoices/${id}/send`,
      {
        method: 'POST',
      }
    )
  }

  // Quotes API
  async getQuotes(params?: { status?: string; clientId?: string }) {
    const queryParams = new URLSearchParams()
    if (params?.status) queryParams.append('status', params.status)
    if (params?.clientId) queryParams.append('clientId', params.clientId)

    const query = queryParams.toString()
    const endpoint = query ? `/quotes?${query}` : '/quotes'

    return this.request<{ quotes: any[] }>(endpoint)
  }

  async getQuote(id: string) {
    return this.request<{ quote: any }>(`/quotes/${id}`)
  }

  async createQuote(data: any) {
    return this.request<{ success: boolean; quote: any }>(
      '/quotes',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    )
  }

  async sendQuote(id: string) {
    return this.request<{ success: boolean; message: string }>(
      `/quotes/${id}/send`,
      {
        method: 'POST',
      }
    )
  }

  // Time Tracking API
  async getTimeLogs(jobId: string) {
    return this.request<{ timeLogs: any[] }>(`/jobs/${jobId}/time-logs`)
  }

  async startTimer(jobId: string) {
    return this.request<{ success: boolean; timeLog: any }>(
      `/jobs/${jobId}/start-timer`,
      { method: 'POST' }
    )
  }

  async stopTimer(jobId: string, breakDurationMinutes = 0, notes = '') {
    return this.request<{ success: boolean; timeLog: any }>(
      `/jobs/${jobId}/stop-timer`,
      {
        method: 'POST',
        body: JSON.stringify({ breakDurationMinutes, notes }),
      }
    )
  }

  async getActiveTimer(jobId: string) {
    return this.request<{ timeLog: any | null }>(`/jobs/${jobId}/active-timer`)
  }

  async addManualTimeLog(jobId: string, data: any) {
    return this.request<{ success: boolean; timeLog: any }>(
      `/jobs/${jobId}/time-logs`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    )
  }

  // Materials API
  async getMaterials(jobId: string) {
    return this.request<{ materials: any[] }>(`/jobs/${jobId}/materials`)
  }

  async addMaterial(jobId: string, data: any) {
    return this.request<{ success: boolean; material: any }>(
      `/jobs/${jobId}/materials`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    )
  }

  async deleteMaterial(jobId: string, materialId: string) {
    return this.request<{ success: boolean }>(
      `/jobs/${jobId}/materials/${materialId}`,
      { method: 'DELETE' }
    )
  }

  // Photos API
  async getPhotos(jobId: string) {
    return this.request<{ photos: any[] }>(`/jobs/${jobId}/photos`)
  }

  async uploadPhoto(jobId: string, imageUri: string, caption: string, photoType: string) {
    const formData = new FormData()

    // Create file from URI
    const filename = imageUri.split('/').pop() || 'photo.jpg'
    const match = /\.(\w+)$/.exec(filename)
    const type = match ? `image/${match[1]}` : `image/jpeg`

    formData.append('photo', {
      uri: imageUri,
      name: filename,
      type,
    } as any)
    formData.append('caption', caption || '')
    formData.append('photoType', photoType)

    const token = await this.getAuthToken()
    const url = `${API_URL}/jobs/${jobId}/photos`

    console.log(`API Request: POST ${url}`)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        // Don't set Content-Type - let the browser set it with boundary
      },
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`API Error: ${response.status} ${response.statusText}`, errorText)
      throw new Error(`API request failed: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  }

  async deletePhoto(jobId: string, photoId: string) {
    return this.request<{ success: boolean }>(
      `/jobs/${jobId}/photos/${photoId}`,
      { method: 'DELETE' }
    )
  }

  // Notes API
  async getNotes(jobId: string) {
    return this.request<{ notes: any[] }>(`/jobs/${jobId}/notes`)
  }

  async addNote(jobId: string, data: any) {
    return this.request<{ success: boolean; note: any }>(
      `/jobs/${jobId}/notes`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    )
  }

  async deleteNote(jobId: string, noteId: string) {
    return this.request<{ success: boolean }>(
      `/jobs/${jobId}/notes/${noteId}`,
      { method: 'DELETE' }
    )
  }

  // User/Profile API
  async getCurrentUser() {
    return this.request<{ user: any }>('/users/me')
  }

  async updateUserProfile(data: any) {
    return this.request<{ success: boolean; user: any }>(
      '/users/me',
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    )
  }

  // Organization API
  async getCurrentOrganization() {
    return this.request<{ organization: any }>('/organizations/current')
  }

  async updateOrganization(data: any) {
    return this.request<{ success: boolean; organization: any }>(
      '/organizations/current',
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    )
  }

  // Team Members API
  async getTeamMembers() {
    return this.request<{ members: any[] }>('/organizations/members')
  }

  async inviteTeamMember(data: any) {
    return this.request<{ success: boolean; invitation: any }>(
      '/organizations/members/invite',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    )
  }

  async getTeamMember(memberId: string) {
    return this.request<{ member: any }>(`/organizations/members/${memberId}`)
  }

  async updateTeamMember(memberId: string, data: any) {
    return this.request<{ success: boolean; member: any }>(
      `/organizations/members/${memberId}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    )
  }

  async removeTeamMember(memberId: string) {
    return this.request<{ success: boolean }>(
      `/organizations/members/${memberId}`,
      { method: 'DELETE' }
    )
  }

  // Documents API
  async getUserDocuments() {
    return this.request<{ documents: any[] }>('/docs/user')
  }

  async getOrganizationDocuments() {
    return this.request<{ documents: any[] }>('/docs/organization')
  }

  async uploadUserDocument(data: any) {
    const formData = new FormData()
    formData.append('title', data.title)
    formData.append('documentType', data.documentType)
    if (data.documentNumber) formData.append('documentNumber', data.documentNumber)
    if (data.issuingAuthority) formData.append('issuingAuthority', data.issuingAuthority)
    formData.append('issueDate', data.issueDate)
    if (data.expiryDate) formData.append('expiryDate', data.expiryDate)

    const filename = data.fileUri.split('/').pop() || 'document.pdf'
    formData.append('file', {
      uri: data.fileUri,
      name: filename,
      type: data.fileType || 'application/pdf',
    } as any)

    const token = await this.getAuthToken()
    const response = await fetch(`${API_URL}/docs/user`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`)
    }

    return await response.json()
  }

  async uploadOrganizationDocument(data: any) {
    const formData = new FormData()
    formData.append('title', data.title)
    formData.append('documentType', data.documentType)
    if (data.documentNumber) formData.append('documentNumber', data.documentNumber)
    if (data.issuingAuthority) formData.append('issuingAuthority', data.issuingAuthority)
    formData.append('issueDate', data.issueDate)
    if (data.expiryDate) formData.append('expiryDate', data.expiryDate)

    const filename = data.fileUri.split('/').pop() || 'document.pdf'
    formData.append('file', {
      uri: data.fileUri,
      name: filename,
      type: data.fileType || 'application/pdf',
    } as any)

    const token = await this.getAuthToken()
    const response = await fetch(`${API_URL}/docs/organization`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`)
    }

    return await response.json()
  }

  async deleteUserDocument(docId: string) {
    return this.request<{ success: boolean }>(
      `/docs/user/${docId}`,
      { method: 'DELETE' }
    )
  }

  async deleteOrganizationDocument(docId: string) {
    return this.request<{ success: boolean }>(
      `/docs/organization/${docId}`,
      { method: 'DELETE' }
    )
  }
}

export const apiClient = new ApiClient()
