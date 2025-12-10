'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

interface TradieConnectStatus {
  connected: boolean
  tc_user_id?: string
  connected_at?: string
  last_synced_at?: string
}

export default function IntegrationsPage() {
  const searchParams = useSearchParams()
  const [tcStatus, setTcStatus] = useState<TradieConnectStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [validating, setValidating] = useState(false)
  const [refreshingToken, setRefreshingToken] = useState(false)
  const [testJobId, setTestJobId] = useState('')
  const [testingJob, setTestingJob] = useState(false)
  const [testJobResult, setTestJobResult] = useState<any>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Check for success/error messages from SSO callback
  useEffect(() => {
    const success = searchParams.get('success')
    const error = searchParams.get('error')

    if (success === 'connected') {
      setMessage({ type: 'success', text: 'Successfully connected to TradieConnect!' })
      // Clear the URL params
      window.history.replaceState({}, '', '/dashboard/integrations')
    } else if (error) {
      const errorMessages: Record<string, string> = {
        missing_params: 'Missing required parameters from TradieConnect',
        decryption_failed: 'Failed to decrypt TradieConnect credentials',
        user_not_found: 'Your user account was not found',
        server_error: 'An error occurred while connecting',
      }
      setMessage({ type: 'error', text: errorMessages[error] || 'An error occurred' })
      window.history.replaceState({}, '', '/dashboard/integrations')
    }
  }, [searchParams])

  // Fetch TradieConnect status on load
  useEffect(() => {
    fetchStatus()
  }, [])

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/integrations/tradieconnect/status')
      const data = await response.json()
      setTcStatus(data)
    } catch (error) {
      console.error('Failed to fetch TradieConnect status:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async () => {
    setConnecting(true)
    try {
      const response = await fetch('/api/integrations/tradieconnect/connect')
      const data = await response.json()

      if (data.authUrl) {
        // Redirect to TradieConnect SSO
        window.location.href = data.authUrl
      }
    } catch (error) {
      console.error('Failed to initiate connection:', error)
      setMessage({ type: 'error', text: 'Failed to initiate TradieConnect connection' })
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your TradieConnect account?')) {
      return
    }

    setDisconnecting(true)
    try {
      const response = await fetch('/api/integrations/tradieconnect/disconnect', {
        method: 'POST',
      })
      const data = await response.json()

      if (data.success) {
        setMessage({ type: 'success', text: 'Successfully disconnected from TradieConnect' })
        setTcStatus({ connected: false })
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to disconnect' })
      }
    } catch (error) {
      console.error('Failed to disconnect:', error)
      setMessage({ type: 'error', text: 'Failed to disconnect from TradieConnect' })
    } finally {
      setDisconnecting(false)
    }
  }

  const handleValidate = async () => {
    setValidating(true)
    try {
      const response = await fetch('/api/integrations/tradieconnect/validate', {
        method: 'POST',
      })
      const data = await response.json()

      if (data.valid) {
        setMessage({
          type: 'success',
          text: data.refreshed
            ? 'Token refreshed successfully!'
            : 'TradieConnect connection is valid!',
        })
        // Refresh status
        fetchStatus()
      } else if (data.needs_reconnect) {
        setMessage({
          type: 'error',
          text: 'Your TradieConnect session has expired. Please reconnect.',
        })
      } else {
        setMessage({ type: 'error', text: data.error || 'Validation failed' })
      }
    } catch (error) {
      console.error('Failed to validate:', error)
      setMessage({ type: 'error', text: 'Failed to validate TradieConnect connection' })
    } finally {
      setValidating(false)
    }
  }

  const handleTestRefresh = async () => {
    setRefreshingToken(true)
    try {
      const response = await fetch('/api/integrations/tradieconnect/validate?force_refresh=true', {
        method: 'POST',
      })
      const data = await response.json()

      if (data.valid && data.refreshed) {
        setMessage({
          type: 'success',
          text: 'Token refreshed successfully! New token has been stored.',
        })
        // Refresh status to show updated last_synced_at
        fetchStatus()
      } else if (data.needs_reconnect) {
        setMessage({
          type: 'error',
          text: 'Refresh token has expired. Please reconnect to TradieConnect.',
        })
      } else {
        setMessage({ type: 'error', text: data.error || 'Token refresh failed' })
      }
    } catch (error) {
      console.error('Failed to refresh token:', error)
      setMessage({ type: 'error', text: 'Failed to refresh TradieConnect token' })
    } finally {
      setRefreshingToken(false)
    }
  }

  const handleTestJob = async () => {
    if (!testJobId.trim()) {
      setMessage({ type: 'error', text: 'Please enter a job ID' })
      return
    }

    setTestingJob(true)
    setTestJobResult(null)
    try {
      const response = await fetch(`/api/integrations/tradieconnect/jobs/${testJobId}`)
      const data = await response.json()

      if (data.success) {
        setTestJobResult(data.job)
        setMessage({ type: 'success', text: 'Successfully fetched job from TradieConnect!' })
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to fetch job' })
      }
    } catch (error) {
      console.error('Failed to fetch job:', error)
      setMessage({ type: 'error', text: 'Failed to fetch job from TradieConnect' })
    } finally {
      setTestingJob(false)
    }
  }

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleString()
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Integrations</h1>

      {/* Message Banner */}
      {message && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span>{message.text}</span>
            <button
              onClick={() => setMessage(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* TradieConnect Card */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">🔗</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">TradieConnect</h2>
              <p className="text-sm text-gray-500">
                Connect your TradieConnect account to sync your assigned jobs
              </p>
            </div>
          </div>
          <div>
            {loading ? (
              <span className="text-sm text-gray-400">Loading...</span>
            ) : tcStatus?.connected ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Connected
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                Not Connected
              </span>
            )}
          </div>
        </div>

        {!loading && (
          <div className="mt-6">
            {tcStatus?.connected ? (
              <>
                {/* Connection Details */}
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">TradieConnect User ID</dt>
                      <dd className="mt-1 text-sm text-gray-900 font-mono">
                        {tcStatus.tc_user_id}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Connected</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {formatDate(tcStatus.connected_at)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Last Synced</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {formatDate(tcStatus.last_synced_at)}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleValidate}
                    disabled={validating}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {validating ? 'Validating...' : 'Test Connection'}
                  </button>
                  <button
                    onClick={handleTestRefresh}
                    disabled={refreshingToken}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
                  >
                    {refreshingToken ? 'Refreshing...' : 'Test Refresh Token'}
                  </button>
                  <button
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="px-4 py-2 bg-white border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
                  >
                    {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                  </button>
                </div>

                {/* Test Job Fetch */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Test Job Fetch</h3>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={testJobId}
                      onChange={(e) => setTestJobId(e.target.value)}
                      placeholder="Enter Job ID"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={handleTestJob}
                      disabled={testingJob || !testJobId.trim()}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                    >
                      {testingJob ? 'Fetching...' : 'Fetch Job'}
                    </button>
                  </div>

                  {/* Test Job Result */}
                  {testJobResult && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Job Data:</h4>
                      <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs">
                        {JSON.stringify(testJobResult, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Connect Button */
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                {connecting ? 'Connecting...' : 'Connect to TradieConnect'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Future Integrations Placeholder */}
      <div className="mt-6 bg-gray-50 rounded-lg border border-dashed border-gray-300 p-6">
        <div className="text-center text-gray-500">
          <span className="text-4xl mb-2 block">🔌</span>
          <p className="font-medium">More Integrations Coming Soon</p>
          <p className="text-sm mt-1">Xero, QuickBooks, and more</p>
        </div>
      </div>
    </div>
  )
}
