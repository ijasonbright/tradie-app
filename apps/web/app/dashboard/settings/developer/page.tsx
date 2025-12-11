'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface ApiKey {
  id: string
  name: string
  key_prefix: string
  key_type: string
  permissions: string[]
  is_active: boolean
  usage_count: number
  last_used_at: string | null
  expires_at: string | null
  created_at: string
}

interface WebhookSubscription {
  id: string
  subscription_id: string
  name: string | null
  event_type: string
  target_url: string
  is_active: boolean
  trigger_count: number
  failure_count: number
  last_triggered_at: string | null
  created_at: string
}

interface Organization {
  id: string
  name: string
  role: string
}

const ALL_PERMISSIONS = [
  { id: 'jobs.read', label: 'Read Jobs', category: 'Jobs' },
  { id: 'jobs.write', label: 'Create/Update Jobs', category: 'Jobs' },
  { id: 'clients.read', label: 'Read Clients', category: 'Clients' },
  { id: 'clients.write', label: 'Create/Update Clients', category: 'Clients' },
  { id: 'invoices.read', label: 'Read Invoices', category: 'Invoices' },
  { id: 'invoices.write', label: 'Create/Update Invoices', category: 'Invoices' },
  { id: 'quotes.read', label: 'Read Quotes', category: 'Quotes' },
  { id: 'quotes.write', label: 'Create/Update Quotes', category: 'Quotes' },
  { id: 'appointments.read', label: 'Read Appointments', category: 'Appointments' },
  { id: 'appointments.write', label: 'Create/Update Appointments', category: 'Appointments' },
  { id: 'completion_forms.read', label: 'Read Completion Forms', category: 'Completion Forms' },
  { id: 'tc_completion_forms.read', label: 'Read TC Job Completion Forms', category: 'TradieConnect' },
  { id: 'webhooks.manage', label: 'Manage Webhooks', category: 'Admin' },
]

const WEBHOOK_EVENT_TYPES = [
  { value: 'job.created', label: 'Job Created' },
  { value: 'job.updated', label: 'Job Updated' },
  { value: 'job.completed', label: 'Job Completed' },
  { value: 'job.status_changed', label: 'Job Status Changed' },
  { value: 'job.assigned', label: 'Job Assigned' },
  { value: 'job.deleted', label: 'Job Deleted' },
  { value: 'client.created', label: 'Client Created' },
  { value: 'client.updated', label: 'Client Updated' },
  { value: 'client.deleted', label: 'Client Deleted' },
  { value: 'invoice.created', label: 'Invoice Created' },
  { value: 'invoice.sent', label: 'Invoice Sent' },
  { value: 'invoice.paid', label: 'Invoice Paid' },
  { value: 'invoice.partially_paid', label: 'Invoice Partially Paid' },
  { value: 'invoice.overdue', label: 'Invoice Overdue' },
  { value: 'invoice.deleted', label: 'Invoice Deleted' },
  { value: 'quote.created', label: 'Quote Created' },
  { value: 'quote.sent', label: 'Quote Sent' },
  { value: 'quote.accepted', label: 'Quote Accepted' },
  { value: 'quote.rejected', label: 'Quote Rejected' },
  { value: 'quote.expired', label: 'Quote Expired' },
  { value: 'quote.deleted', label: 'Quote Deleted' },
  { value: 'appointment.created', label: 'Appointment Created' },
  { value: 'appointment.updated', label: 'Appointment Updated' },
  { value: 'appointment.cancelled', label: 'Appointment Cancelled' },
  { value: 'completion_form.submitted', label: 'Completion Form Submitted' },
  { value: 'payment.received', label: 'Payment Received' },
]

export default function DeveloperSettingsPage() {
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'api-keys' | 'webhooks'>('api-keys')
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [webhooks, setWebhooks] = useState<WebhookSubscription[]>([])
  const [loadingApiKeys, setLoadingApiKeys] = useState(false)
  const [loadingWebhooks, setLoadingWebhooks] = useState(false)

  // Modal states
  const [showCreateApiKey, setShowCreateApiKey] = useState(false)
  const [showCreateWebhook, setShowCreateWebhook] = useState(false)
  const [newApiKeyResult, setNewApiKeyResult] = useState<{ apiKey: string; keyPrefix: string } | null>(null)

  // Form states
  const [apiKeyForm, setApiKeyForm] = useState({
    name: '',
    permissions: [] as string[],
    expiresInDays: '',
  })
  const [webhookForm, setWebhookForm] = useState({
    name: '',
    eventType: '',
    targetUrl: '',
    generateSecret: true,
  })

  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    fetchOrganization()
  }, [])

  useEffect(() => {
    if (organization && (organization.role === 'owner' || organization.role === 'admin')) {
      if (activeTab === 'api-keys') {
        fetchApiKeys()
      } else {
        fetchWebhooks()
      }
    }
  }, [organization, activeTab])

  const fetchOrganization = async () => {
    try {
      const response = await fetch('/api/organizations/current')
      if (response.ok) {
        const data = await response.json()
        setOrganization(data.organization)
      }
    } catch (error) {
      console.error('Error fetching organization:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchApiKeys = async () => {
    setLoadingApiKeys(true)
    try {
      const response = await fetch('/api/developer/api-keys')
      if (response.ok) {
        const data = await response.json()
        setApiKeys(data.apiKeys || [])
      }
    } catch (error) {
      console.error('Error fetching API keys:', error)
    } finally {
      setLoadingApiKeys(false)
    }
  }

  const fetchWebhooks = async () => {
    setLoadingWebhooks(true)
    try {
      const response = await fetch('/api/developer/webhooks')
      if (response.ok) {
        const data = await response.json()
        setWebhooks(data.webhooks || [])
      }
    } catch (error) {
      console.error('Error fetching webhooks:', error)
    } finally {
      setLoadingWebhooks(false)
    }
  }

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      const response = await fetch('/api/developer/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: apiKeyForm.name,
          permissions: apiKeyForm.permissions,
          expiresInDays: apiKeyForm.expiresInDays ? parseInt(apiKeyForm.expiresInDays) : undefined,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setNewApiKeyResult({ apiKey: data.apiKey, keyPrefix: data.apiKeyData.key_prefix })
        setApiKeyForm({ name: '', permissions: [], expiresInDays: '' })
        fetchApiKeys()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to create API key')
      }
    } catch (error) {
      setError('Failed to create API key')
    }
  }

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      const response = await fetch('/api/developer/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: webhookForm.name,
          eventType: webhookForm.eventType,
          targetUrl: webhookForm.targetUrl,
          generateSecret: webhookForm.generateSecret,
        }),
      })

      if (response.ok) {
        setShowCreateWebhook(false)
        setWebhookForm({ name: '', eventType: '', targetUrl: '', generateSecret: true })
        setSuccessMessage('Webhook created successfully')
        fetchWebhooks()
        setTimeout(() => setSuccessMessage(null), 3000)
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to create webhook')
      }
    } catch (error) {
      setError('Failed to create webhook')
    }
  }

  const handleToggleApiKey = async (id: string, isActive: boolean) => {
    try {
      await fetch(`/api/developer/api-keys/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      })
      fetchApiKeys()
    } catch (error) {
      console.error('Error toggling API key:', error)
    }
  }

  const handleDeleteApiKey = async (id: string) => {
    if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) return
    try {
      await fetch(`/api/developer/api-keys/${id}`, { method: 'DELETE' })
      fetchApiKeys()
      setSuccessMessage('API key deleted successfully')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (error) {
      console.error('Error deleting API key:', error)
    }
  }

  const handleToggleWebhook = async (id: string, isActive: boolean) => {
    try {
      await fetch(`/api/developer/webhooks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      })
      fetchWebhooks()
    } catch (error) {
      console.error('Error toggling webhook:', error)
    }
  }

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm('Are you sure you want to delete this webhook? This action cannot be undone.')) return
    try {
      await fetch(`/api/developer/webhooks/${id}`, { method: 'DELETE' })
      fetchWebhooks()
      setSuccessMessage('Webhook deleted successfully')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (error) {
      console.error('Error deleting webhook:', error)
    }
  }

  const handleTestWebhook = async (id: string) => {
    try {
      const response = await fetch(`/api/developer/webhooks/${id}/test`, { method: 'POST' })
      if (response.ok) {
        setSuccessMessage('Test webhook sent successfully')
        setTimeout(() => setSuccessMessage(null), 3000)
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to send test webhook')
      }
    } catch (error) {
      setError('Failed to send test webhook')
    }
  }

  const togglePermission = (permission: string) => {
    setApiKeyForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission]
    }))
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setSuccessMessage('Copied to clipboard')
    setTimeout(() => setSuccessMessage(null), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Check if user has access (owner or admin only)
  if (!organization || (organization.role !== 'owner' && organization.role !== 'admin')) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h2 className="text-xl font-semibold text-red-800 mb-2">Access Denied</h2>
          <p className="text-red-600">
            Developer settings are only available to organization owners and administrators.
          </p>
          <Link
            href="/dashboard/settings"
            className="mt-4 inline-block text-blue-600 hover:text-blue-800"
          >
            &larr; Back to Settings
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/dashboard/settings" className="text-blue-600 hover:text-blue-800 text-sm">
          &larr; Back to Settings
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Developer Settings</h1>
        <p className="text-gray-600 mt-1">
          Manage API keys and webhook subscriptions for integrating with external services.
        </p>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
          {successMessage}
        </div>
      )}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-bold">&times;</button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('api-keys')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'api-keys'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            API Keys
          </button>
          <button
            onClick={() => setActiveTab('webhooks')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'webhooks'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Webhooks
          </button>
        </nav>
      </div>

      {/* API Keys Tab */}
      {activeTab === 'api-keys' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">API Keys</h2>
            <button
              onClick={() => setShowCreateApiKey(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Create API Key
            </button>
          </div>

          {/* New API Key Result Modal */}
          {newApiKeyResult && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
                <h3 className="text-lg font-semibold text-green-700 mb-4">API Key Created Successfully</h3>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <p className="text-yellow-800 text-sm font-medium mb-2">
                    Important: Copy this API key now. You won't be able to see it again!
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-gray-100 p-2 rounded text-sm break-all">
                      {newApiKeyResult.apiKey}
                    </code>
                    <button
                      onClick={() => copyToClipboard(newApiKeyResult.apiKey)}
                      className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setNewApiKeyResult(null)
                    setShowCreateApiKey(false)
                  }}
                  className="w-full bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* Create API Key Modal */}
          {showCreateApiKey && !newApiKeyResult && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-semibold mb-4">Create New API Key</h3>
                <form onSubmit={handleCreateApiKey}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Key Name *
                    </label>
                    <input
                      type="text"
                      value={apiKeyForm.name}
                      onChange={(e) => setApiKeyForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="e.g., Production Integration"
                      required
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Expires In (days)
                    </label>
                    <input
                      type="number"
                      value={apiKeyForm.expiresInDays}
                      onChange={(e) => setApiKeyForm(prev => ({ ...prev, expiresInDays: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="Leave empty for no expiration"
                      min="1"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Permissions
                    </label>
                    <div className="border rounded-lg p-3 max-h-48 overflow-y-auto">
                      {ALL_PERMISSIONS.map(perm => (
                        <label key={perm.id} className="flex items-center gap-2 py-1">
                          <input
                            type="checkbox"
                            checked={apiKeyForm.permissions.includes(perm.id)}
                            onChange={() => togglePermission(perm.id)}
                            className="rounded"
                          />
                          <span className="text-sm">{perm.label}</span>
                          <span className="text-xs text-gray-500">({perm.category})</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateApiKey(false)
                        setApiKeyForm({ name: '', permissions: [], expiresInDays: '' })
                      }}
                      className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Create Key
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* API Keys List */}
          {loadingApiKeys ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <p className="text-gray-600">No API keys created yet.</p>
              <p className="text-gray-500 text-sm mt-1">
                Create an API key to start integrating with external services.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Key</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usage</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Used</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {apiKeys.map((key) => (
                    <tr key={key.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{key.name}</div>
                        <div className="text-xs text-gray-500">
                          {key.permissions.length} permission{key.permissions.length !== 1 ? 's' : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-sm text-gray-600">{key.key_prefix}...</code>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                          key.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {key.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {key.usage_count.toLocaleString()} requests
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {key.last_used_at
                          ? new Date(key.last_used_at).toLocaleDateString()
                          : 'Never'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleToggleApiKey(key.id, key.is_active)}
                          className="text-blue-600 hover:text-blue-800 text-sm mr-3"
                        >
                          {key.is_active ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          onClick={() => handleDeleteApiKey(key.id)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* API Documentation Link */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-medium text-blue-800">API Documentation</h3>
            <p className="text-sm text-blue-700 mt-1">
              Learn how to use the API to integrate with your systems.
            </p>
            <a
              href="/api/docs"
              target="_blank"
              className="text-sm text-blue-600 hover:text-blue-800 mt-2 inline-block"
            >
              View API Documentation &rarr;
            </a>
          </div>
        </div>
      )}

      {/* Webhooks Tab */}
      {activeTab === 'webhooks' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Webhook Subscriptions</h2>
            <button
              onClick={() => setShowCreateWebhook(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Create Webhook
            </button>
          </div>

          {/* Create Webhook Modal */}
          {showCreateWebhook && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
                <h3 className="text-lg font-semibold mb-4">Create New Webhook</h3>
                <form onSubmit={handleCreateWebhook}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Webhook Name
                    </label>
                    <input
                      type="text"
                      value={webhookForm.name}
                      onChange={(e) => setWebhookForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="e.g., CRM Sync"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Event Type *
                    </label>
                    <select
                      value={webhookForm.eventType}
                      onChange={(e) => setWebhookForm(prev => ({ ...prev, eventType: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2"
                      required
                    >
                      <option value="">Select an event...</option>
                      {WEBHOOK_EVENT_TYPES.map(event => (
                        <option key={event.value} value={event.value}>
                          {event.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Target URL *
                    </label>
                    <input
                      type="url"
                      value={webhookForm.targetUrl}
                      onChange={(e) => setWebhookForm(prev => ({ ...prev, targetUrl: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="https://your-app.com/webhooks"
                      required
                    />
                  </div>

                  <div className="mb-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={webhookForm.generateSecret}
                        onChange={(e) => setWebhookForm(prev => ({ ...prev, generateSecret: e.target.checked }))}
                        className="rounded"
                      />
                      <span className="text-sm text-gray-700">
                        Generate signing secret (recommended for security)
                      </span>
                    </label>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateWebhook(false)
                        setWebhookForm({ name: '', eventType: '', targetUrl: '', generateSecret: true })
                      }}
                      className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Create Webhook
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Webhooks List */}
          {loadingWebhooks ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : webhooks.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <p className="text-gray-600">No webhooks configured yet.</p>
              <p className="text-gray-500 text-sm mt-1">
                Create a webhook to receive real-time notifications when events occur.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name/Event</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target URL</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deliveries</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {webhooks.map((webhook) => (
                    <tr key={webhook.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">
                          {webhook.name || webhook.event_type}
                        </div>
                        <div className="text-xs text-gray-500">{webhook.event_type}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-600 truncate max-w-xs" title={webhook.target_url}>
                          {webhook.target_url}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                          webhook.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {webhook.is_active ? 'Active' : 'Inactive'}
                        </span>
                        {webhook.failure_count > 0 && (
                          <span className="ml-2 inline-flex px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">
                            {webhook.failure_count} failures
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {webhook.trigger_count.toLocaleString()} sent
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleTestWebhook(webhook.id)}
                          className="text-green-600 hover:text-green-800 text-sm mr-3"
                        >
                          Test
                        </button>
                        <button
                          onClick={() => handleToggleWebhook(webhook.id, webhook.is_active)}
                          className="text-blue-600 hover:text-blue-800 text-sm mr-3"
                        >
                          {webhook.is_active ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          onClick={() => handleDeleteWebhook(webhook.id)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Webhook Documentation */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-medium text-blue-800">Webhook Security</h3>
            <p className="text-sm text-blue-700 mt-1">
              When you create a webhook with a signing secret, each request includes an
              <code className="bg-blue-100 px-1 rounded mx-1">X-Webhook-Signature</code>
              header containing an HMAC-SHA256 signature of the payload.
            </p>
            <p className="text-sm text-blue-600 mt-2">
              Verify this signature to ensure requests are authentic.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
