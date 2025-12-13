import * as SecureStore from 'expo-secure-store'
import { normalizeImageOrientation } from './image-utils'

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

  async getAppointment(id: string) {
    return this.request<{ appointment: any }>(`/appointments/${id}`)
  }

  async updateAppointment(id: string, data: any) {
    return this.request<{ success: boolean; appointment: any }>(
      `/appointments/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    )
  }

  async deleteAppointment(id: string) {
    return this.request<{ success: boolean }>(
      `/appointments/${id}`,
      {
        method: 'DELETE',
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

  async addInvoiceLineItem(invoiceId: string, data: { itemType: string; description: string; quantity: number; unitPrice: number }) {
    return this.request<{ lineItem: any }>(
      `/invoices/${invoiceId}/line-items`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    )
  }

  async deleteInvoiceLineItem(invoiceId: string, lineItemId: string) {
    return this.request<{ success: boolean }>(
      `/invoices/${invoiceId}/line-items?lineItemId=${lineItemId}`,
      {
        method: 'DELETE',
      }
    )
  }

  async updateInvoice(id: string, data: any) {
    return this.request<{ invoice: any }>(
      `/invoices/${id}`,
      {
        method: 'PUT',
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

  async recordPayment(invoiceId: string, data: any) {
    return this.request<{ success: boolean; payment: any }>(
      `/invoices/${invoiceId}/payments`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    )
  }

  async sendInvoiceEmail(id: string, data: { email: string; subject: string; message: string }) {
    return this.request<{ success: boolean }>(
      `/invoices/${id}/send`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    )
  }

  async sendInvoiceSMS(id: string, data: { phone: string; message: string }) {
    return this.request<{ success: boolean }>(
      `/invoices/${id}/send-sms`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    )
  }

  // Payments API
  async getPayments(params?: { invoiceId?: string; startDate?: string; endDate?: string }) {
    const queryParams = new URLSearchParams()
    if (params?.invoiceId) queryParams.append('invoiceId', params.invoiceId)
    if (params?.startDate) queryParams.append('startDate', params.startDate)
    if (params?.endDate) queryParams.append('endDate', params.endDate)

    const query = queryParams.toString()
    const endpoint = query ? `/payments?${query}` : '/payments'

    return this.request<{ payments: any[] }>(endpoint)
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

  async updateQuote(id: string, data: any) {
    return this.request<{ quote: any }>(
      `/quotes/${id}`,
      {
        method: 'PUT',
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

  async sendQuoteSMS(id: string, data: { phone: string; message: string }) {
    return this.request<{ success: boolean }>(
      `/quotes/${id}/send-sms`,
      {
        method: 'POST',
        body: JSON.stringify(data),
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
    // Normalize image orientation to fix EXIF rotation issues
    const normalizedUri = await normalizeImageOrientation(imageUri)

    const formData = new FormData()

    // Create file from normalized URI
    const filename = normalizedUri.split('/').pop() || 'photo.jpg'
    const match = /\.(\w+)$/.exec(filename)
    const type = match ? `image/${match[1]}` : `image/jpeg`

    formData.append('photo', {
      uri: normalizedUri,
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

  async extractLogoColors(logoUrl: string) {
    return this.request<{ colors: Array<{ hex: string; rgb: [number, number, number]; isDark: boolean; name: string }> }>(
      '/organizations/extract-logo-colors',
      {
        method: 'POST',
        body: JSON.stringify({ logoUrl }),
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

  // Trade Types API
  async getTradeTypes() {
    return this.request<{ tradeTypes: any[] }>('/mobile-auth/trade-types')
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

  // SMS API
  async getSMSBalance() {
    return this.request<{ credits: number }>('/sms/balance')
  }

  async purchaseSMSCredits(bundleSize: string) {
    return this.request<{ sessionId: string; url: string }>(
      '/sms/purchase-credits',
      {
        method: 'POST',
        body: JSON.stringify({ bundleSize }),
      }
    )
  }

  async getSMSTransactions(params?: { limit?: number; offset?: number; type?: string }) {
    const queryParams = new URLSearchParams()
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.offset) queryParams.append('offset', params.offset.toString())
    if (params?.type) queryParams.append('type', params.type)

    const query = queryParams.toString()
    const endpoint = query ? `/sms/transactions?${query}` : '/sms/transactions'

    return this.request<{
      transactions: any[]
      pagination: { total: number; limit: number; offset: number; hasMore: boolean }
    }>(endpoint)
  }

  // ==================== PAYMENT LINKS ====================

  /**
   * Create a Stripe payment link for a quote deposit
   */
  async createQuotePaymentLink(quoteId: string) {
    return this.request<{
      success: boolean
      paymentLink: {
        id: string
        url: string
      }
      publicUrl: string
      depositAmount: number
    }>(`/quotes/${quoteId}/create-payment-link`, {
      method: 'POST',
    })
  }

  /**
   * Create a Stripe payment link for an invoice
   */
  async createInvoicePaymentLink(invoiceId: string, amount?: number) {
    return this.request<{
      success: boolean
      paymentLink: {
        id: string
        url: string
      }
      publicUrl: string
      paymentAmount: number
      remainingAmount: number
      isPartialPayment: boolean
    }>(`/invoices/${invoiceId}/create-payment-link`, {
      method: 'POST',
      body: JSON.stringify(amount ? { amount } : {}),
    })
  }

  // ==================== LOCATION TRACKING ====================

  /**
   * Update current user location
   */
  async updateLocation(data: {
    latitude: number
    longitude: number
    accuracy?: number
    heading?: number
    speed?: number
    altitude?: number
    isActive?: boolean
  }) {
    return this.request<{ location: any }>('/mobile-auth/location', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  /**
   * Toggle location sharing on/off
   */
  async toggleLocationSharing(isActive: boolean) {
    return this.request<{
      success: boolean
      message: string
      location: any
    }>('/mobile-auth/location', {
      method: 'PUT',
      body: JSON.stringify({ isActive }),
    })
  }

  /**
   * Get all team member locations
   */
  async getTeamLocations(params?: { includeInactive?: boolean; maxAge?: number }) {
    const queryParams = new URLSearchParams()
    if (params?.includeInactive) queryParams.append('includeInactive', 'true')
    if (params?.maxAge) queryParams.append('maxAge', params.maxAge.toString())

    const query = queryParams.toString()
    const endpoint = query ? `/team/locations?${query}` : '/team/locations'

    return this.request<{
      locations: any[]
      count: number
      maxAgeMinutes: number
    }>(endpoint)
  }

  /**
   * Get map overview with team locations and job locations
   */
  async getMapOverview(params?: { maxAge?: number; jobStatus?: string }) {
    const queryParams = new URLSearchParams()
    if (params?.maxAge) queryParams.append('maxAge', params.maxAge.toString())
    if (params?.jobStatus) queryParams.append('jobStatus', params.jobStatus)

    const query = queryParams.toString()
    const endpoint = query ? `/mobile-auth/map-overview?${query}` : '/mobile-auth/map-overview'

    return this.request<{
      teamLocations: any[]
      jobLocations: any[]
      stats: {
        activeTeamMembers: number
        activeJobs: number
        maxAgeMinutes: number
      }
    }>(endpoint)
  }

  // ==================== REMINDERS ====================

  /**
   * Get reminder settings for current organization
   */
  async getReminderSettings() {
    return this.request<any>('/reminders/settings')
  }

  /**
   * Update reminder settings
   */
  async updateReminderSettings(data: any) {
    return this.request<any>('/reminders/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  /**
   * Get reminder history
   */
  async getReminderHistory(params?: {
    type?: string
    status?: string
    clientId?: string
    startDate?: string
    endDate?: string
    limit?: number
    offset?: number
  }) {
    const queryParams = new URLSearchParams()
    if (params?.type) queryParams.append('type', params.type)
    if (params?.status) queryParams.append('status', params.status)
    if (params?.clientId) queryParams.append('clientId', params.clientId)
    if (params?.startDate) queryParams.append('startDate', params.startDate)
    if (params?.endDate) queryParams.append('endDate', params.endDate)
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.offset) queryParams.append('offset', params.offset.toString())

    const query = queryParams.toString()
    const endpoint = query ? `/reminders/history?${query}` : '/reminders/history'

    return this.request<{
      history: any[]
      pagination: { total: number; limit: number; offset: number; hasMore: boolean }
    }>(endpoint)
  }

  /**
   * Send test reminder
   */
  async sendTestReminder(data: { type: 'email' | 'sms'; testEmail?: string; testPhone?: string }) {
    return this.request<{ success: boolean; message: string }>(
      '/reminders/test-send',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    )
  }

  /**
   * Manually send reminder for specific invoice
   */
  async sendInvoiceReminder(invoiceId: string, method: 'email' | 'sms' | 'both' = 'email') {
    return this.request<{ success: boolean }>(
      `/invoices/${invoiceId}/send-reminder`,
      {
        method: 'POST',
        body: JSON.stringify({ method }),
      }
    )
  }

  /**
   * Manually send statement to specific client
   */
  async sendClientStatement(clientId: string) {
    return this.request<{ success: boolean; message: string }>(
      `/clients/${clientId}/send-statement`,
      {
        method: 'POST',
      }
    )
  }

  // ==================== PUSH NOTIFICATIONS ====================

  /**
   * Register Expo push token for current user
   */
  async registerPushToken(expoPushToken: string) {
    return this.request<{ success: boolean; message: string; expo_push_token: string }>(
      '/users/push-token',
      {
        method: 'POST',
        body: JSON.stringify({ expo_push_token: expoPushToken }),
      }
    )
  }

  /**
   * Unregister push token (e.g., on logout)
   */
  async unregisterPushToken() {
    return this.request<{ success: boolean; message: string }>(
      '/users/push-token',
      {
        method: 'DELETE',
      }
    )
  }

  /**
   * Send a test push notification to current user
   */
  async sendTestPushNotification() {
    return this.request<{ success: boolean; message: string; tickets: any[] }>(
      '/push/test',
      {
        method: 'POST',
      }
    )
  }

  // ==================== COMPLETION FORMS ====================

  /**
   * Get all completion form templates
   */
  async getCompletionFormTemplates() {
    return this.request<{ templates: any[] }>('/completion-forms/templates')
  }

  /**
   * Get specific completion form template with groups and questions
   */
  async getCompletionFormTemplate(templateId: string) {
    return this.request<any>(`/completion-forms/templates/${templateId}`)
  }

  /**
   * Get completion form for a specific job
   */
  async getJobCompletionForm(jobId: string) {
    return this.request<{ form: any | null; templates?: any[] }>(`/jobs/${jobId}/completion-form`)
  }

  /**
   * Save completion form draft or update existing
   */
  async saveJobCompletionForm(jobId: string, data: { template_id: string; form_data: any; status: string }) {
    return this.request<{ success: boolean; form: any }>(
      `/jobs/${jobId}/completion-form`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    )
  }

  /**
   * Submit completion form (finalize)
   */
  async submitJobCompletionForm(jobId: string) {
    return this.request<{ success: boolean; form: any }>(
      `/jobs/${jobId}/completion-form/submit`,
      {
        method: 'PUT',
      }
    )
  }

  /**
   * Download completion form PDF
   */
  async downloadCompletionFormPDF(jobId: string): Promise<Blob> {
    const token = await this.getAuthToken()
    const url = `${API_URL}/jobs/${jobId}/completion-form/pdf`

    console.log(`API Request: GET ${url}`)

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`API Error: ${response.status} ${response.statusText}`, errorText)
      throw new Error(`Failed to download PDF: ${response.status} ${response.statusText}`)
    }

    return await response.blob()
  }

  /**
   * Send completion report via email to client
   */
  async sendCompletionReport(jobId: string, options?: { message?: string; recipient_email?: string }) {
    return this.request<{ success: boolean; message: string; email_id?: string }>(
      `/jobs/${jobId}/completion-form/send-report`,
      {
        method: 'POST',
        body: JSON.stringify(options || {}),
      }
    )
  }

  /**
   * Upload photo to completion form
   */
  async uploadCompletionFormPhoto(jobId: string, imageUri: string, caption: string, photoType: string, questionId?: string) {
    // Normalize image orientation to fix EXIF rotation issues
    const normalizedUri = await normalizeImageOrientation(imageUri)

    const formData = new FormData()

    // Create file from normalized URI
    const filename = normalizedUri.split('/').pop() || 'photo.jpg'
    const match = /\.(\w+)$/.exec(filename)
    const type = match ? `image/${match[1]}` : `image/jpeg`

    formData.append('file', {
      uri: normalizedUri,
      name: filename,
      type,
    } as any)
    formData.append('caption', caption || '')
    formData.append('photo_type', photoType)
    if (questionId) formData.append('question_id', questionId)

    const token = await this.getAuthToken()
    const url = `${API_URL}/jobs/${jobId}/completion-form/photos`

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

  /**
   * Upload photo to TC job completion form
   */
  async uploadTCCompletionFormPhoto(tcJobId: string, imageUri: string, caption: string, photoType: string, questionId?: string) {
    // Normalize image orientation to fix EXIF rotation issues
    const normalizedUri = await normalizeImageOrientation(imageUri)

    const formData = new FormData()

    // Create file from normalized URI
    const filename = normalizedUri.split('/').pop() || 'photo.jpg'
    const match = /\.(\w+)$/.exec(filename)
    const type = match ? `image/${match[1]}` : `image/jpeg`

    formData.append('file', {
      uri: normalizedUri,
      name: filename,
      type,
    } as any)
    formData.append('caption', caption || '')
    formData.append('photo_type', photoType)
    if (questionId) formData.append('question_id', questionId)

    const token = await this.getAuthToken()
    const url = `${API_URL}/integrations/tradieconnect/jobs/${tcJobId}/completion-form/photos`

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

  // ==================== PROPERTIES API ====================

  /**
   * Get all properties for user's organizations
   */
  async getProperties(params?: { organization_id?: string }) {
    const queryParams = new URLSearchParams()
    if (params?.organization_id) queryParams.append('organization_id', params.organization_id)

    const query = queryParams.toString()
    const endpoint = query ? `/properties?${query}` : '/properties'

    return this.request<{ properties: any[] }>(endpoint)
  }

  /**
   * Get a single property by ID
   */
  async getProperty(id: string) {
    return this.request<{ property: any }>(`/properties/${id}`)
  }

  /**
   * Create a new property
   */
  async createProperty(data: {
    organization_id: string
    external_property_id: number
    address_street?: string
    address_suburb?: string
    address_state?: string
    address_postcode?: string
    property_type?: string
    bedrooms?: number
    bathrooms?: number
    owner_name?: string
    owner_phone?: string
    owner_email?: string
    tenant_name?: string
    tenant_phone?: string
    tenant_email?: string
    access_instructions?: string
    notes?: string
  }) {
    return this.request<{ success: boolean; property: any }>(
      '/properties',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    )
  }

  /**
   * Update a property
   */
  async updateProperty(id: string, data: any) {
    return this.request<{ success: boolean; property: any }>(
      `/properties/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    )
  }

  // ==================== ASSETS API ====================

  /**
   * Get assets (optionally filtered by property or organization)
   */
  async getAssets(params?: {
    property_id?: string
    organization_id?: string
    category?: string
    condition?: string
    room?: string
  }) {
    const queryParams = new URLSearchParams()
    if (params?.property_id) queryParams.append('property_id', params.property_id)
    if (params?.organization_id) queryParams.append('organization_id', params.organization_id)
    if (params?.category) queryParams.append('category', params.category)
    if (params?.condition) queryParams.append('condition', params.condition)
    if (params?.room) queryParams.append('room', params.room)

    const query = queryParams.toString()
    const endpoint = query ? `/assets?${query}` : '/assets'

    return this.request<{ assets: any[] }>(endpoint)
  }

  /**
   * Get a single asset by ID with photos
   */
  async getAsset(id: string) {
    return this.request<{ asset: any }>(`/assets/${id}`)
  }

  /**
   * Create a new asset
   */
  async createAsset(data: {
    property_id: string
    name: string
    category?: string
    brand?: string
    model?: string
    serial_number?: string
    room?: string
    location?: string
    condition?: string
    estimated_age?: number
    warranty_status?: string
    warranty_expiry?: string
    maintenance_required?: string
    current_value?: number
    replacement_cost?: number
    expected_lifespan_years?: number
    notes?: string
  }) {
    return this.request<{ success: boolean; asset: any }>(
      '/assets',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    )
  }

  /**
   * Update an asset
   */
  async updateAsset(id: string, data: any) {
    return this.request<{ success: boolean; asset: any }>(
      `/assets/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    )
  }

  /**
   * Delete an asset
   */
  async deleteAsset(id: string) {
    return this.request<{ success: boolean }>(
      `/assets/${id}`,
      { method: 'DELETE' }
    )
  }

  /**
   * Get photos for an asset
   */
  async getAssetPhotos(assetId: string) {
    return this.request<{ photos: any[] }>(`/assets/${assetId}/photos`)
  }

  /**
   * Upload photo to an asset
   */
  async uploadAssetPhoto(assetId: string, imageUri: string, caption: string, photoType: string = 'general') {
    // Normalize image orientation to fix EXIF rotation issues
    const normalizedUri = await normalizeImageOrientation(imageUri)

    const formData = new FormData()

    // Create file from normalized URI
    const filename = normalizedUri.split('/').pop() || 'photo.jpg'
    const match = /\.(\w+)$/.exec(filename)
    const type = match ? `image/${match[1]}` : `image/jpeg`

    formData.append('file', {
      uri: normalizedUri,
      name: filename,
      type,
    } as any)
    formData.append('caption', caption || '')
    formData.append('photo_type', photoType)

    const token = await this.getAuthToken()
    const url = `${API_URL}/assets/${assetId}/photos`

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

  // ==================== ASSET REGISTER JOBS API ====================

  /**
   * Get asset register jobs for user's organizations
   */
  async getAssetRegisterJobs(params?: { status?: string; assignedToMe?: boolean }) {
    const queryParams = new URLSearchParams()
    if (params?.status) queryParams.append('status', params.status)
    if (params?.assignedToMe) queryParams.append('assignedToMe', 'true')

    const query = queryParams.toString()
    const endpoint = query ? `/asset-register-jobs?${query}` : '/asset-register-jobs'

    return this.request<{ jobs: any[] }>(endpoint)
  }

  /**
   * Get asset register jobs for a specific property
   */
  async getAssetRegisterJobsForProperty(propertyId: string) {
    return this.request<{ jobs: any[] }>(`/asset-register-jobs?property_id=${propertyId}`)
  }

  /**
   * Create a new asset register job
   */
  async createAssetRegisterJob(data: {
    property_id: number
    organization_id?: number
    scheduled_date?: string
    priority?: string
    notes?: string
  }) {
    return this.request<{ success: boolean; job: any }>(
      '/asset-register-jobs',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    )
  }

  /**
   * Get a single asset register job by ID with all related data
   */
  async getAssetRegisterJob(id: string) {
    return this.request<{
      job: any
      photos: any[]
      notes: any[]
      completionForms: any[]
    }>(`/asset-register-jobs/${id}`)
  }

  /**
   * Update an asset register job
   */
  async updateAssetRegisterJob(id: string, data: {
    status?: string
    priority?: string
    scheduled_date?: string
    assigned_to_user_id?: string
    notes?: string
    completion_notes?: string
  }) {
    return this.request<{ success: boolean; job: any }>(
      `/asset-register-jobs/${id}`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      }
    )
  }

  /**
   * Start an asset register job (set status to IN_PROGRESS)
   */
  async startAssetRegisterJob(id: string) {
    return this.updateAssetRegisterJob(id, { status: 'IN_PROGRESS' })
  }

  /**
   * Complete an asset register job with form data
   */
  async completeAssetRegisterJob(id: string, data: {
    template_id?: string
    form_data?: any
    completion_notes?: string
    report_data?: any
    client_signature_url?: string
    technician_signature_url?: string
    client_name?: string
    technician_name?: string
  }) {
    return this.request<{ success: boolean; job: any; completionForm: any }>(
      `/asset-register-jobs/${id}/complete`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    )
  }

  /**
   * Save asset register progress without completing (to prevent data loss)
   */
  async saveAssetRegisterProgress(id: string, data: {
    form_data?: any
    technician_name?: string
    report_data?: any
  }) {
    return this.request<{ success: boolean }>(
      `/asset-register-jobs/${id}/save-progress`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    )
  }

  /**
   * Reopen a completed asset register job to allow edits
   */
  async reopenAssetRegisterJob(id: string) {
    return this.request<{ success: boolean; job: any }>(
      `/asset-register-jobs/${id}/reopen`,
      {
        method: 'POST',
      }
    )
  }

  /**
   * Add a note to an asset register job
   */
  async addAssetRegisterJobNote(jobId: string, data: { note_text: string; note_type?: string }) {
    return this.request<{ success: boolean; note: any }>(
      `/asset-register-jobs/${jobId}/notes`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    )
  }

  /**
   * Upload photo to an asset register job
   */
  async uploadAssetRegisterJobPhoto(
    jobId: string,
    imageUri: string,
    caption: string,
    photoType: string = 'general',
    room?: string,
    item?: string
  ) {
    // Normalize image orientation to fix EXIF rotation issues
    const normalizedUri = await normalizeImageOrientation(imageUri)

    const formData = new FormData()

    // Create file from normalized URI
    const filename = normalizedUri.split('/').pop() || 'photo.jpg'
    const match = /\.(\w+)$/.exec(filename)
    const type = match ? `image/${match[1]}` : `image/jpeg`

    formData.append('file', {
      uri: normalizedUri,
      name: filename,
      type,
    } as any)
    formData.append('caption', caption || '')
    formData.append('photo_type', photoType)
    if (room) formData.append('room', room)
    if (item) formData.append('item', item)

    const token = await this.getAuthToken()
    const url = `${API_URL}/asset-register-jobs/${jobId}/photos`

    console.log(`API Request: POST ${url}`)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
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
  // ==================== TRADIECONNECT INTEGRATIONS ====================

  /**
   * Get TradieConnect connection status
   */
  async getTradieConnectStatus() {
    return this.request<{
      connected: boolean
      tc_user_id?: string
      connected_at?: string
      last_synced_at?: string
      error?: string
    }>('/integrations/tradieconnect/status')
  }

  /**
   * Get TradieConnect auth URL for SSO
   */
  async getTradieConnectAuthUrl() {
    return this.request<{
      authUrl: string
      message: string
    }>('/integrations/tradieconnect/connect')
  }

  /**
   * Disconnect TradieConnect account
   */
  async disconnectTradieConnect() {
    return this.request<{
      success: boolean
      message: string
    }>('/integrations/tradieconnect/disconnect', {
      method: 'POST',
    })
  }

  /**
   * Validate TradieConnect token
   */
  async validateTradieConnect() {
    return this.request<{
      valid: boolean
      message?: string
      error?: string
      refreshed?: boolean
      needs_reconnect?: boolean
    }>('/integrations/tradieconnect/validate', {
      method: 'POST',
    })
  }

  /**
   * Fetch a job from TradieConnect
   */
  async fetchTradieConnectJob(jobId: string) {
    return this.request<{
      success: boolean
      job?: any
      error?: string
      needs_connect?: boolean
    }>(`/integrations/tradieconnect/jobs/${jobId}`)
  }

  /**
   * Get completion form template by TradieConnect form ID
   * Used to find the matching completion form for a TC job
   */
  async getCompletionFormTemplateByTcFormId(tcFormId: number) {
    return this.request<{
      success: boolean
      template: {
        id: string
        organization_id: string | null
        name: string
        description: string | null
        code: string | null
        job_type: string | null
        is_global: boolean
        is_active: boolean
        tc_form_id: number
        navigation_type: string
        include_photos: boolean
        include_before_after_photos: boolean
        include_signature: boolean
        include_technician_signature: boolean
        created_at: string
        updated_at: string
        group_count: number
        question_count: number
      } | null
      tc_form_id?: number
      error?: string
    }>(`/completion-forms/templates/by-tc-form-id?tc_form_id=${tcFormId}`)
  }

  /**
   * Get full TradieConnect job details (for job view screen)
   */
  async getTCJobDetails(jobId: string) {
    return this.request<{
      success: boolean
      job?: {
        jobId: number
        code: string
        calendarLink: string
        completionFormTypeId: number | null
        lat: number
        long: number
        addressState: string | null
        addressLocality: string | null
        addressPostcode: string | null
        addressCountry: string | null
        entryNotes: string | null
        jobSourcePrettyPrint: string
        propertyMeStatus: string
        propertyMeSummary: string
        isInspection: boolean
        isEnergyUpgrade: boolean
        isRectification: boolean
        hasGas: boolean
        phone: string | null
        jobContactEmail: string | null
        jobContactFirstName: string | null
        jobContactLastName: string | null
        jobContactMobile: string | null
        pricing: {
          lotJobTypeSubscriptionId: number
          jobTypeId: number
          lotSubscriptionTypeId: number
          propertyType: string
          yearly: number
          initial: number
          currentJobCost: number
          jobTypeName: string
          initialWithGst: number
        } | null
        questions: any[]
        files: any[]
        history: {
          id: number
          jobId: number
          description: string
          timestamp: string
          statusId: number
          statusName: string
          fullname: string
          firstname: string | null
          lastname: string | null
          mobile: string | null
        }[]
        property: {
          id: number
          address: string | null
          unit: string | null
          number: string | null
          street: string | null
          suburb: string | null
          state: string | null
          postCode: string | null
          lat: number
          long: number
          tenantName: string | null
          tenantEmail: string | null
          tenantMobile: string | null
          tenantFirstname: string | null
          tenantLastname: string | null
          tenantFullname: string
          ownerName: string | null
          ownerEmail: string | null
          ownerMobile: string | null
          ownerFirstname: string | null
          ownerLastname: string | null
          ownerFullname: string
          managerName: string | null
          managerEmail: string | null
          managerMobile: string | null
          managerFirstname: string | null
          managerLastname: string | null
          managerFullname: string
          jobTypeName: string | null
          jobStatusName: string
          scheduledDate: string | null
          description: string | null
          siteAccessNotes: string | null
        } | null
      }
      error?: string
      needs_reconnection?: boolean
    }>(`/integrations/tradieconnect/job?jobId=${jobId}`)
  }

  /**
   * Get TC job completion form (if exists)
   */
  async getTCJobCompletionForm(tcJobId: string) {
    return this.request<{ form: any | null }>(`/integrations/tradieconnect/jobs/${tcJobId}/completion-form`)
  }

  /**
   * Save TC job completion form draft or update existing
   */
  async saveTCJobCompletionForm(
    tcJobId: string,
    data: { template_id: string; tc_job_code: string; form_data: any; status: string }
  ) {
    return this.request<{ success: boolean; form: any }>(
      `/integrations/tradieconnect/jobs/${tcJobId}/completion-form`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    )
  }

  // ==================== TC Live Form Sync (Dynamic Forms) ====================

  /**
   * Fetch form definition directly from TradieConnect API
   * This returns the latest form structure with all questions
   */
  async getTCLiveFormDefinition(tcJobId: string) {
    return this.request<{
      success: boolean
      form?: {
        template_id: string
        template_name: string
        tc_form_id: number
        tc_job_id: number
        groups: Array<{
          id: string
          name: string
          csv_group_id: number
          sort_order: number
          questions: Array<{
            id: string
            question_text: string
            field_type: string
            csv_question_id: number
            csv_group_id: number
            group_name?: string
            sort_order: number
            required: boolean
            answer_options?: Array<{
              id: string
              text: string
              tc_answer_id?: number
            }>
            hint?: string
          }>
        }>
        _tc_raw?: any
      }
      saved_answers?: Record<string, string> // Saved answers from TC (pre-fill form with existing data)
      saved_files?: Record<string, string> // Saved file URLs for photo fields
      error?: string
      cached?: boolean
    }>(`/integrations/tradieconnect/jobs/${tcJobId}/form-definition`)
  }

  /**
   * Sync form answers to TradieConnect in real-time
   * Called when user saves a page or completes the form
   */
  async syncTCFormAnswers(
    tcJobId: string,
    data: {
      answers: Record<string, any>
      photo_urls?: Record<string, string[]>
      group_no?: number
      is_complete: boolean
    }
  ) {
    return this.request<{
      success: boolean
      tc_response?: any
      synced_answers?: number
      is_complete?: boolean
      error?: string
    }>(
      `/integrations/tradieconnect/jobs/${tcJobId}/sync-answers`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    )
  }
}

export const apiClient = new ApiClient()
