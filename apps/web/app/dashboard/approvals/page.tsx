'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface TimeLog {
  id: string
  job_id: string
  user_id: string
  log_type: string
  start_time: string
  end_time: string
  total_hours: string
  hourly_rate: string
  labor_cost: string
  notes: string | null
  status: string
  user_name: string
  job_title: string
  job_number: string
  created_at: string
}

interface Material {
  id: string
  job_id: string
  added_by_user_id: string
  material_type: string
  description: string
  supplier_name: string | null
  quantity: string
  unit_price: string
  total_cost: string
  receipt_url: string | null
  status: string
  added_by_name: string
  job_title: string
  job_number: string
  created_at: string
}

export default function ApprovalsPage() {
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'time' | 'materials'>('time')

  useEffect(() => {
    fetchPendingApprovals()
  }, [])

  const fetchPendingApprovals = async () => {
    try {
      setLoading(true)
      const [timeRes, materialsRes] = await Promise.all([
        fetch('/api/approvals/time-logs'),
        fetch('/api/approvals/materials'),
      ])

      if (timeRes.ok) {
        const timeData = await timeRes.json()
        setTimeLogs(timeData.timeLogs || [])
      }

      if (materialsRes.ok) {
        const materialsData = await materialsRes.json()
        setMaterials(materialsData.materials || [])
      }
    } catch (error) {
      console.error('Error fetching approvals:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApproveTimeLog = async (logId: string, jobId: string) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}/time-logs/${logId}/approve`, {
        method: 'POST',
      })

      if (res.ok) {
        setTimeLogs((prev) => prev.filter((log) => log.id !== logId))
      } else {
        const error = await res.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error approving time log:', error)
      alert('Failed to approve time log')
    }
  }

  const handleRejectTimeLog = async (logId: string, jobId: string) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}/time-logs/${logId}/reject`, {
        method: 'POST',
      })

      if (res.ok) {
        setTimeLogs((prev) => prev.filter((log) => log.id !== logId))
      } else {
        const error = await res.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error rejecting time log:', error)
      alert('Failed to reject time log')
    }
  }

  const handleApproveMaterial = async (materialId: string, jobId: string) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}/materials/${materialId}/approve`, {
        method: 'POST',
      })

      if (res.ok) {
        setMaterials((prev) => prev.filter((mat) => mat.id !== materialId))
      } else {
        const error = await res.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error approving material:', error)
      alert('Failed to approve material')
    }
  }

  const handleRejectMaterial = async (materialId: string, jobId: string) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}/materials/${materialId}/reject`, {
        method: 'POST',
      })

      if (res.ok) {
        setMaterials((prev) => prev.filter((mat) => mat.id !== materialId))
      } else {
        const error = await res.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error rejecting material:', error)
      alert('Failed to reject material')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-AU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(typeof amount === 'string' ? parseFloat(amount) : amount)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading approvals...</p>
      </div>
    )
  }

  const pendingTimeCount = timeLogs.length
  const pendingMaterialsCount = materials.length
  const totalPending = pendingTimeCount + pendingMaterialsCount

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Pending Approvals</h1>
        <p className="mt-1 text-gray-600">
          Review and approve time logs and materials from your team
        </p>
      </div>

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="text-sm font-medium text-gray-600">Total Pending</div>
          <div className="mt-2 text-3xl font-bold">{totalPending}</div>
        </div>
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="text-sm font-medium text-gray-600">Time Logs</div>
          <div className="mt-2 text-3xl font-bold">{pendingTimeCount}</div>
        </div>
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="text-sm font-medium text-gray-600">Materials</div>
          <div className="mt-2 text-3xl font-bold">{pendingMaterialsCount}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('time')}
            className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium ${
              activeTab === 'time'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Time Logs ({pendingTimeCount})
          </button>
          <button
            onClick={() => setActiveTab('materials')}
            className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium ${
              activeTab === 'materials'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Materials ({pendingMaterialsCount})
          </button>
        </nav>
      </div>

      {/* Time Logs Tab */}
      {activeTab === 'time' && (
        <div className="space-y-4">
          {pendingTimeCount === 0 ? (
            <div className="rounded-lg bg-white p-8 text-center shadow">
              <p className="text-gray-600">No time logs pending approval</p>
            </div>
          ) : (
            timeLogs.map((log) => (
              <div key={log.id} className="rounded-lg bg-white p-6 shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/dashboard/jobs/${log.job_id}`}
                        className="text-lg font-semibold text-blue-600 hover:text-blue-800"
                      >
                        {log.job_number}
                      </Link>
                      <span className="text-gray-400">•</span>
                      <span className="text-gray-700">{log.job_title}</span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                      <div>
                        <div className="text-gray-600">Team Member</div>
                        <div className="font-medium">{log.user_name}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Hours</div>
                        <div className="font-medium">{log.total_hours}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Rate</div>
                        <div className="font-medium">{formatCurrency(log.hourly_rate)}/hr</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Labor Cost</div>
                        <div className="font-medium">{formatCurrency(log.labor_cost)}</div>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-gray-600">Start Time</div>
                        <div className="font-medium">{formatDate(log.start_time)}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">End Time</div>
                        <div className="font-medium">{formatDate(log.end_time)}</div>
                      </div>
                    </div>

                    {log.notes && (
                      <div className="mt-3">
                        <div className="text-sm text-gray-600">Notes</div>
                        <div className="text-sm">{log.notes}</div>
                      </div>
                    )}

                    <div className="mt-2 text-xs text-gray-500">
                      Submitted {formatDate(log.created_at)}
                    </div>
                  </div>

                  <div className="ml-4 flex flex-col gap-2">
                    <button
                      onClick={() => handleApproveTimeLog(log.id, log.job_id)}
                      className="rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleRejectTimeLog(log.id, log.job_id)}
                      className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Materials Tab */}
      {activeTab === 'materials' && (
        <div className="space-y-4">
          {pendingMaterialsCount === 0 ? (
            <div className="rounded-lg bg-white p-8 text-center shadow">
              <p className="text-gray-600">No materials pending approval</p>
            </div>
          ) : (
            materials.map((material) => (
              <div key={material.id} className="rounded-lg bg-white p-6 shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/dashboard/jobs/${material.job_id}`}
                        className="text-lg font-semibold text-blue-600 hover:text-blue-800"
                      >
                        {material.job_number}
                      </Link>
                      <span className="text-gray-400">•</span>
                      <span className="text-gray-700">{material.job_title}</span>
                    </div>

                    <div className="mt-3">
                      <div className="text-lg font-medium">{material.description}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="inline-flex items-center rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                          {material.material_type}
                        </span>
                        {material.supplier_name && (
                          <span className="text-sm text-gray-600">
                            from {material.supplier_name}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                      <div>
                        <div className="text-gray-600">Added By</div>
                        <div className="font-medium">{material.added_by_name}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Quantity</div>
                        <div className="font-medium">{material.quantity}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Unit Price</div>
                        <div className="font-medium">{formatCurrency(material.unit_price)}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Total Cost</div>
                        <div className="font-medium">{formatCurrency(material.total_cost)}</div>
                      </div>
                    </div>

                    {material.receipt_url && (
                      <div className="mt-3">
                        <a
                          href={material.receipt_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          View Receipt →
                        </a>
                      </div>
                    )}

                    <div className="mt-2 text-xs text-gray-500">
                      Submitted {formatDate(material.created_at)}
                    </div>
                  </div>

                  <div className="ml-4 flex flex-col gap-2">
                    <button
                      onClick={() => handleApproveMaterial(material.id, material.job_id)}
                      className="rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleRejectMaterial(material.id, material.job_id)}
                      className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
