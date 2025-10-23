'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function MigratePage() {
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const runMigration = async () => {
    setRunning(true)
    setError(null)
    setResults(null)

    try {
      const res = await fetch('/api/migrate', {
        method: 'POST',
      })

      const data = await res.json()

      if (res.ok) {
        setResults(data)
      } else {
        setError(data.error || 'Migration failed')
      }
    } catch (err) {
      setError('Failed to run migration: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <Link href="/dashboard" className="text-blue-600 hover:text-blue-800">
          ← Back to Dashboard
        </Link>
      </div>

      <div className="rounded-lg bg-white p-8 shadow">
        <h1 className="mb-4 text-3xl font-bold">Database Migration</h1>
        <p className="mb-6 text-gray-600">
          This will update your database schema to support the latest features including:
        </p>

        <ul className="mb-6 space-y-2 text-sm text-gray-700">
          <li>✓ Business hourly rates (billing vs cost rates)</li>
          <li>✓ Employee vs Subcontractor distinction</li>
          <li>✓ Leave balance tracking</li>
          <li>✓ Job duration and geolocation fields</li>
          <li>✓ Team member unavailability system</li>
          <li>✓ Comprehensive pricing fields - First hour rates, callout fees, after hours pricing</li>
          <li>✓ <strong className="text-green-600">NEW: Calendar & Appointments</strong> - Schedule jobs, meetings, and site visits</li>
          <li>✓ <strong className="text-green-600">NEW: Expense Management</strong> - Submit, track, and approve business expenses</li>
        </ul>

        <div className="mb-6 rounded-lg bg-yellow-50 p-4">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> This migration is safe to run multiple times. It will only add new
            columns and tables if they don&apos;t already exist.
          </p>
        </div>

        {!results && !error && (
          <button
            onClick={runMigration}
            disabled={running}
            className="rounded bg-blue-600 px-6 py-3 text-white hover:bg-blue-700 disabled:bg-blue-300"
          >
            {running ? 'Running Migration...' : 'Run Migration Now'}
          </button>
        )}

        {error && (
          <div className="mt-6 rounded-lg bg-red-50 p-4">
            <h3 className="mb-2 font-semibold text-red-900">Error</h3>
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {results && (
          <div className="mt-6 rounded-lg bg-green-50 p-4">
            <h3 className="mb-4 font-semibold text-green-900">
              ✓ Migration Completed Successfully
            </h3>

            <div className="space-y-2">
              {results.results?.map((result: any, index: number) => (
                <div
                  key={index}
                  className={`rounded p-2 text-sm ${
                    result.status === 'success'
                      ? 'bg-green-100 text-green-800'
                      : result.status.includes('skipped')
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  <div className="font-medium">{result.status}</div>
                  <div className="text-xs">{result.statement}</div>
                  {result.error && <div className="mt-1 text-xs">Error: {result.error}</div>}
                </div>
              ))}
            </div>

            <div className="mt-6">
              <Link
                href="/dashboard/settings"
                className="inline-block rounded bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
              >
                Go to Settings →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
