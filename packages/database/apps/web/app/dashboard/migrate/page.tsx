'use client'

import { useState } from 'react'

export default function MigratePage() {
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const runMigration = async () => {
    try {
      setStatus('running')
      setMessage('Running migrations...')

      const response = await fetch('/api/migrate', {
        method: 'POST',
      })

      const data = await response.json()

      if (response.ok) {
        setStatus('success')
        setMessage(data.message || 'Migrations completed successfully')
      } else {
        setStatus('error')
        setMessage(data.error || 'Migration failed')
      }
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'Unknown error')
    }
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '2rem' }}>
        Database Migration
      </h1>

      <div style={{ marginBottom: '2rem' }}>
        <p style={{ marginBottom: '1rem' }}>
          Click the button below to run pending database migrations.
        </p>

        <button
          onClick={runMigration}
          disabled={status === 'running'}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: status === 'running' ? '#999' : '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: status === 'running' ? 'not-allowed' : 'pointer',
          }}
        >
          {status === 'running' ? 'Running...' : 'Run Migrations'}
        </button>
      </div>

      {status !== 'idle' && (
        <div
          style={{
            padding: '1rem',
            borderRadius: '0.5rem',
            backgroundColor:
              status === 'success' ? '#dcfce7' : status === 'error' ? '#fee2e2' : '#f3f4f6',
            border: \`1px solid \${
              status === 'success' ? '#86efac' : status === 'error' ? '#fca5a5' : '#d1d5db'
            }\`,
          }}
        >
          <p
            style={{
              color: status === 'success' ? '#166534' : status === 'error' ? '#991b1b' : '#374151',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
            }}
          >
            {message}
          </p>
        </div>
      )}
    </div>
  )
}
