'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface TradeType {
  id: string
  name: string
  client_hourly_rate: string
  default_employee_hourly_rate: string
  client_callout_fee: string
  is_active: boolean
}

export default function TradeRatesPage() {
  const [trades, setTrades] = useState<TradeType[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [editingTrade, setEditingTrade] = useState<TradeType | null>(null)

  useEffect(() => {
    fetchTrades()
  }, [])

  const fetchTrades = async () => {
    try {
      const res = await fetch('/api/trade-types')
      const data = await res.json()
      setTrades(data.tradeTypes || [])
    } catch (error) {
      console.error('Error fetching trades:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (trade: TradeType) => {
    setSaving(trade.id)
    try {
      const res = await fetch('/api/trade-types', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: trade.id,
          clientHourlyRate: parseFloat(trade.client_hourly_rate),
          defaultEmployeeHourlyRate: parseFloat(trade.default_employee_hourly_rate),
          clientCalloutFee: parseFloat(trade.client_callout_fee),
        }),
      })

      if (res.ok) {
        alert('Trade rates updated successfully!')
        setEditingTrade(null)
        fetchTrades()
      } else {
        alert('Failed to update trade rates')
      }
    } catch (error) {
      console.error('Error saving:', error)
      alert('Failed to update trade rates')
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <p>Loading trade rates...</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          <Link href="/dashboard/settings" className="text-blue-600 hover:text-blue-700">
            ← Back to Settings
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Trade Rates</h1>
        <p className="text-gray-600 mt-2">
          Configure hourly rates for each trade type. These rates will be used when tracking time on jobs.
        </p>
      </div>

      {/* Rate Explanation */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">Understanding Rates:</h3>
        <ul className="space-y-1 text-sm text-blue-800">
          <li><strong>Employee Hourly Rate (Cost):</strong> What you pay your workers per hour - this is your cost</li>
          <li><strong>Client Hourly Rate (Billing):</strong> What you charge customers per hour - this is your revenue</li>
          <li><strong>Callout Fee:</strong> Fixed fee charged when attending a job (optional)</li>
        </ul>
      </div>

      {/* Trades Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Trade Type
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Employee Rate (Cost)
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Client Rate (Billing)
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Markup
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Callout Fee
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {trades.map((trade) => {
              const isEditing = editingTrade?.id === trade.id
              const currentTrade = isEditing ? editingTrade : trade
              const employeeRate = parseFloat(currentTrade.default_employee_hourly_rate || '0')
              const clientRate = parseFloat(currentTrade.client_hourly_rate || '0')
              const markup = employeeRate > 0 ? (((clientRate - employeeRate) / employeeRate) * 100).toFixed(0) : '0'

              return (
                <tr key={trade.id} className={isEditing ? 'bg-blue-50' : ''}>
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {trade.name}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.01"
                        value={currentTrade.default_employee_hourly_rate}
                        onChange={(e) => setEditingTrade({
                          ...currentTrade,
                          default_employee_hourly_rate: e.target.value
                        })}
                        className="w-24 px-2 py-1 text-right border border-gray-300 rounded"
                      />
                    ) : (
                      <span className="text-gray-900">
                        ${parseFloat(trade.default_employee_hourly_rate || '0').toFixed(2)}/hr
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.01"
                        value={currentTrade.client_hourly_rate}
                        onChange={(e) => setEditingTrade({
                          ...currentTrade,
                          client_hourly_rate: e.target.value
                        })}
                        className="w-24 px-2 py-1 text-right border border-gray-300 rounded"
                      />
                    ) : (
                      <span className="text-green-600 font-semibold">
                        ${parseFloat(trade.client_hourly_rate || '0').toFixed(2)}/hr
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`font-semibold ${parseFloat(markup) > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                      {markup}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.01"
                        value={currentTrade.client_callout_fee}
                        onChange={(e) => setEditingTrade({
                          ...currentTrade,
                          client_callout_fee: e.target.value
                        })}
                        className="w-24 px-2 py-1 text-right border border-gray-300 rounded"
                      />
                    ) : (
                      <span className="text-gray-900">
                        ${parseFloat(trade.client_callout_fee || '0').toFixed(2)}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {isEditing ? (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleSave(currentTrade)}
                          disabled={saving === trade.id}
                          className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
                        >
                          {saving === trade.id ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditingTrade(null)}
                          disabled={saving === trade.id}
                          className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingTrade(trade)}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {trades.length === 0 && (
        <div className="mt-6 p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800">
            No trade types found. Trade types should be automatically created for your organization.
          </p>
        </div>
      )}
    </div>
  )
}
