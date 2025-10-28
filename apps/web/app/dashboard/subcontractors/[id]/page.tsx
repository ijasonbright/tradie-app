'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

export default function SubcontractorDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [selectedTimeLogs, setSelectedTimeLogs] = useState<string[]>([])
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([])
  const [paymentData, setPaymentData] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'bank_transfer',
    reference_number: '',
    notes: '',
    sync_to_xero: false,
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (id) {
      fetchSummary()
    }
  }, [id])

  const fetchSummary = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/subcontractors/${id}/summary`)
      const result = await res.json()
      setData(result)

      // Auto-select all unpaid items
      if (result.unpaidItems) {
        setSelectedTimeLogs(result.unpaidItems.timeLogs.map((t: any) => t.id))
        setSelectedMaterials(result.unpaidItems.materials.map((m: any) => m.id))
      }
    } catch (error) {
      console.error('Error fetching summary:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePayment = async () => {
    try {
      setSubmitting(true)
      const res = await fetch(`/api/subcontractors/${id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...paymentData,
          time_log_ids: selectedTimeLogs,
          material_ids: selectedMaterials,
        }),
      })

      if (res.ok) {
        alert('Payment recorded successfully!')
        setShowPaymentForm(false)
        setSelectedTimeLogs([])
        setSelectedMaterials([])
        fetchSummary()
      } else {
        const error = await res.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error creating payment:', error)
      alert('Failed to create payment')
    } finally {
      setSubmitting(false)
    }
  }

  const downloadStatement = async (format: 'json' | 'csv') => {
    try {
      const res = await fetch(`/api/subcontractors/${id}/statement?format=${format}`)

      if (format === 'csv') {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `subcontractor-statement-${data.subcontractor.full_name}-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        const result = await res.json()
        console.log('Statement:', result)
      }
    } catch (error) {
      console.error('Error downloading statement:', error)
      alert('Failed to download statement')
    }
  }

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(parseFloat(amount || '0'))
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-AU')
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="text-4xl">👷</div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return <div>Error loading data</div>
  }

  const totalSelected =
    selectedTimeLogs.reduce((sum, id) => {
      const log = data.unpaidItems.timeLogs.find((t: any) => t.id === id)
      return sum + parseFloat(log?.labor_cost || '0')
    }, 0) +
    selectedMaterials.reduce((sum, id) => {
      const mat = data.unpaidItems.materials.find((m: any) => m.id === id)
      return sum + parseFloat(mat?.total_cost || '0')
    }, 0)

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6">
        <Link href="/dashboard/subcontractors" className="text-sm text-blue-600 hover:underline">
          ← Back to Subcontractors
        </Link>
        <h1 className="mt-2 text-3xl font-bold">{data.subcontractor.full_name}</h1>
        <p className="text-gray-600">{data.subcontractor.email}</p>
      </div>

      {/* Summary Cards */}
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-lg bg-white p-4 shadow">
          <p className="text-sm text-gray-600">Total Owed</p>
          <p className="text-2xl font-bold text-orange-600">
            {formatCurrency(data.summary.total_owed)}
          </p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <p className="text-sm text-gray-600">Labor</p>
          <p className="text-2xl font-bold">{formatCurrency(data.summary.labor_amount)}</p>
          <p className="text-xs text-gray-500">{data.summary.unpaid_time_log_count} time logs</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <p className="text-sm text-gray-600">Materials</p>
          <p className="text-2xl font-bold">{formatCurrency(data.summary.materials_amount)}</p>
          <p className="text-xs text-gray-500">{data.summary.unpaid_materials_count} items</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <p className="text-sm text-gray-600">Pending Approval</p>
          <p className="text-2xl font-bold text-yellow-600">
            {formatCurrency(data.summary.total_pending_approval)}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="mb-6 flex gap-3">
        <button
          onClick={() => setShowPaymentForm(true)}
          disabled={parseFloat(data.summary.total_owed) === 0}
          className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:bg-gray-400"
        >
          💰 Record Payment
        </button>
        <button
          onClick={() => downloadStatement('csv')}
          className="rounded border px-4 py-2 hover:bg-gray-50"
        >
          📥 Download Statement
        </button>
      </div>

      {/* Payment Form */}
      {showPaymentForm && (
        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold">Record Payment</h2>

          {/* Unpaid Items Selection */}
          <div className="mb-4">
            <h3 className="mb-2 font-medium">Select Items to Pay:</h3>

            {/* Time Logs */}
            {data.unpaidItems.timeLogs.length > 0 && (
              <div className="mb-3">
                <p className="mb-2 text-sm font-medium text-gray-700">Time Logs:</p>
                <div className="space-y-2">
                  {data.unpaidItems.timeLogs.map((log: any) => (
                    <label key={log.id} className="flex items-center gap-3 rounded border p-3">
                      <input
                        type="checkbox"
                        checked={selectedTimeLogs.includes(log.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTimeLogs([...selectedTimeLogs, log.id])
                          } else {
                            setSelectedTimeLogs(selectedTimeLogs.filter(id => id !== log.id))
                          }
                        }}
                      />
                      <div className="flex-1">
                        <div className="font-medium">
                          {log.job_number} - {log.job_title}
                        </div>
                        <div className="text-sm text-gray-600">
                          {log.total_hours}h @ {formatCurrency(log.hourly_rate)}/hr
                        </div>
                      </div>
                      <div className="font-semibold">{formatCurrency(log.labor_cost)}</div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Materials */}
            {data.unpaidItems.materials.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">Materials:</p>
                <div className="space-y-2">
                  {data.unpaidItems.materials.map((mat: any) => (
                    <label key={mat.id} className="flex items-center gap-3 rounded border p-3">
                      <input
                        type="checkbox"
                        checked={selectedMaterials.includes(mat.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedMaterials([...selectedMaterials, mat.id])
                          } else {
                            setSelectedMaterials(selectedMaterials.filter(id => id !== mat.id))
                          }
                        }}
                      />
                      <div className="flex-1">
                        <div className="font-medium">{mat.description}</div>
                        <div className="text-sm text-gray-600">
                          {mat.job_number} - Qty: {mat.quantity}
                        </div>
                      </div>
                      <div className="font-semibold">{formatCurrency(mat.total_cost)}</div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mb-4 rounded-lg bg-blue-50 p-4">
            <p className="font-semibold">Total Payment: {formatCurrency(totalSelected.toString())}</p>
          </div>

          {/* Payment Details */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Payment Date</label>
              <input
                type="date"
                value={paymentData.payment_date}
                onChange={(e) => setPaymentData({ ...paymentData, payment_date: e.target.value })}
                className="w-full rounded border px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Payment Method</label>
              <select
                value={paymentData.payment_method}
                onChange={(e) => setPaymentData({ ...paymentData, payment_method: e.target.value })}
                className="w-full rounded border px-3 py-2"
              >
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="check">Check</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Reference Number</label>
              <input
                type="text"
                value={paymentData.reference_number}
                onChange={(e) => setPaymentData({ ...paymentData, reference_number: e.target.value })}
                placeholder="Optional"
                className="w-full rounded border px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Notes</label>
              <input
                type="text"
                value={paymentData.notes}
                onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                placeholder="Optional"
                className="w-full rounded border px-3 py-2"
              />
            </div>
          </div>

          <label className="mt-4 flex items-center gap-2">
            <input
              type="checkbox"
              checked={paymentData.sync_to_xero}
              onChange={(e) => setPaymentData({ ...paymentData, sync_to_xero: e.target.checked })}
            />
            <span className="text-sm">Sync to Xero as Bill</span>
          </label>

          <div className="mt-6 flex gap-3">
            <button
              onClick={handleCreatePayment}
              disabled={submitting || totalSelected === 0}
              className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:bg-gray-400"
            >
              {submitting ? 'Recording...' : 'Record Payment'}
            </button>
            <button
              onClick={() => setShowPaymentForm(false)}
              className="rounded border px-4 py-2 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Recent Payments */}
      {data.recentPayments && data.recentPayments.length > 0 && (
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold">Recent Payments</h2>
          <div className="space-y-3">
            {data.recentPayments.map((payment: any) => (
              <div key={payment.id} className="flex items-center justify-between rounded border p-4">
                <div>
                  <div className="font-medium">
                    {formatDate(payment.paid_date || payment.created_at)}
                  </div>
                  <div className="text-sm text-gray-600">
                    {payment.payment_method} {payment.reference_number && `- ${payment.reference_number}`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-green-600">
                    {formatCurrency(payment.total_amount)}
                  </div>
                  <div className="text-xs text-gray-500">{payment.status}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
