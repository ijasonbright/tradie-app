'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface Job {
  id: string
  job_number: string
  title: string
  description: string | null
  status: string
  priority: string
  job_type: string
  client_id: string
  company_name: string | null
  first_name: string | null
  last_name: string | null
  is_company: boolean
  client_email: string | null
  client_phone: string | null
  quoted_amount: string | null
  scheduled_date: string | null
  site_address_line1: string | null
  site_city: string | null
  site_state: string | null
  site_postcode: string | null
  created_at: string
}

interface TimeLog {
  id: string
  user_name: string
  start_time: string
  end_time: string | null
  total_hours: string | null
  labor_cost: string | null
  billing_amount: string | null
  notes: string | null
  status: string
}

interface Material {
  id: string
  material_type: string
  description: string
  supplier_name: string | null
  quantity: string
  unit_price: string
  total_cost: string
  receipt_url: string | null
  status: string
  added_by_name: string
  approved_by_name: string | null
  created_at: string
}

interface Photo {
  id: string
  photo_url: string
  caption: string | null
  photo_type: string | null
  uploaded_by_name: string
  uploaded_at: string
}

interface Note {
  id: string
  note_text: string
  note_type: string
  user_name: string
  created_at: string
}

interface Assignment {
  id: string
  user_name: string
  user_email: string
  role: string
  assigned_at: string
}

interface Quote {
  id: string
  quote_number: string
  title: string
  status: string
  total_amount: string
}

interface Invoice {
  id: string
  invoice_number: string
  status: string
  total_amount: string
  paid_amount: string
}

type Tab = 'overview' | 'time' | 'materials' | 'photos' | 'notes'

export default function JobDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [job, setJob] = useState<Job | null>(null)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [photos, setPhotos] = useState<Photo[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)

  // Time log form
  const [showTimeLogForm, setShowTimeLogForm] = useState(false)
  const [timeLogForm, setTimeLogForm] = useState({
    startTime: '',
    endTime: '',
    breakDurationMinutes: '0',
    notes: '',
  })

  // Material form
  const [showMaterialForm, setShowMaterialForm] = useState(false)
  const [materialForm, setMaterialForm] = useState({
    materialType: 'product',
    description: '',
    supplierName: '',
    quantity: '1',
    unitPrice: '0',
  })

  // Photo upload
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoForm, setPhotoForm] = useState({
    caption: '',
    photoType: 'during',
  })

  // Note form
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [noteForm, setNoteForm] = useState({
    noteText: '',
    noteType: 'general',
  })

  // Timer state
  const [activeTimer, setActiveTimer] = useState<any>(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [showStopTimerModal, setShowStopTimerModal] = useState(false)
  const [stopTimerForm, setStopTimerForm] = useState({
    breakDurationMinutes: '0',
    notes: '',
  })

  // Completion modal state
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [completionNotes, setCompletionNotes] = useState('')
  const [completionPhotos, setCompletionPhotos] = useState<File[]>([])
  const [uploadingCompletionPhotos, setUploadingCompletionPhotos] = useState(false)

  useEffect(() => {
    if (params.id) {
      fetchAllData()
      fetchActiveTimer()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  // Update elapsed time every second when timer is active
  useEffect(() => {
    if (activeTimer) {
      const interval = setInterval(() => {
        const start = new Date(activeTimer.start_time).getTime()
        const now = Date.now()
        setElapsedTime(Math.floor((now - start) / 1000))
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [activeTimer])

  const fetchAllData = async () => {
    await Promise.all([
      fetchJob(),
      fetchTimeLogs(),
      fetchMaterials(),
      fetchPhotos(),
      fetchNotes(),
      fetchAssignments(),
    ])
    setLoading(false)
  }

  const fetchJob = async () => {
    try {
      const res = await fetch(`/api/jobs/${params.id}`)
      if (res.ok) {
        const data = await res.json()
        setJob(data.job)
        setQuote(data.quote || null)
        setInvoice(data.invoice || null)
      }
    } catch (error) {
      console.error('Error fetching job:', error)
    }
  }

  const fetchTimeLogs = async () => {
    try {
      const res = await fetch(`/api/jobs/${params.id}/time-logs`)
      if (res.ok) {
        const data = await res.json()
        setTimeLogs(data.timeLogs || [])
      }
    } catch (error) {
      console.error('Error fetching time logs:', error)
    }
  }

  const fetchMaterials = async () => {
    try {
      const res = await fetch(`/api/jobs/${params.id}/materials`)
      if (res.ok) {
        const data = await res.json()
        setMaterials(data.materials || [])
      }
    } catch (error) {
      console.error('Error fetching materials:', error)
    }
  }

  const fetchPhotos = async () => {
    try {
      const res = await fetch(`/api/jobs/${params.id}/photos`)
      if (res.ok) {
        const data = await res.json()
        setPhotos(data.photos || [])
      }
    } catch (error) {
      console.error('Error fetching photos:', error)
    }
  }

  const fetchNotes = async () => {
    try {
      const res = await fetch(`/api/jobs/${params.id}/notes`)
      if (res.ok) {
        const data = await res.json()
        setNotes(data.notes || [])
      }
    } catch (error) {
      console.error('Error fetching notes:', error)
    }
  }

  const fetchAssignments = async () => {
    try {
      const res = await fetch(`/api/jobs/${params.id}/assignments`)
      if (res.ok) {
        const data = await res.json()
        setAssignments(data.assignments || [])
      }
    } catch (error) {
      console.error('Error fetching assignments:', error)
    }
  }

  const fetchActiveTimer = async () => {
    try {
      const res = await fetch(`/api/jobs/${params.id}/active-timer`)
      if (res.ok) {
        const data = await res.json()
        if (data.hasActiveTimer) {
          setActiveTimer(data.activeTimer)
        }
      }
    } catch (error) {
      console.error('Error fetching active timer:', error)
    }
  }

  // Timer handlers
  const handleStartTimer = async () => {
    try {
      const res = await fetch(`/api/jobs/${params.id}/start-timer`, {
        method: 'POST',
      })
      if (res.ok) {
        const data = await res.json()
        setActiveTimer(data.timeLog)
        alert('Timer started successfully!')
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to start timer')
      }
    } catch (error) {
      console.error('Error starting timer:', error)
      alert('Failed to start timer')
    }
  }

  const handleStopTimer = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch(`/api/jobs/${params.id}/stop-timer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          breakDurationMinutes: parseInt(stopTimerForm.breakDurationMinutes),
          notes: stopTimerForm.notes,
        }),
      })
      if (res.ok) {
        setActiveTimer(null)
        setElapsedTime(0)
        setShowStopTimerModal(false)
        setStopTimerForm({ breakDurationMinutes: '0', notes: '' })
        fetchTimeLogs()
        alert('Timer stopped successfully!')
      } else {
        const error = await res.json()
        alert(error.details || error.error || 'Failed to stop timer')
      }
    } catch (error) {
      console.error('Error stopping timer:', error)
      alert('Failed to stop timer')
    }
  }

  const formatElapsedTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Job completion handler - show modal first
  const handleCompleteJob = () => {
    setShowCompletionModal(true)
  }

  const confirmCompleteJob = async () => {
    setUploadingCompletionPhotos(true)
    try {
      // Upload completion photos first
      if (completionPhotos.length > 0) {
        for (const photo of completionPhotos) {
          const formData = new FormData()
          formData.append('photo', photo)
          formData.append('photoType', 'completion')
          formData.append('caption', 'Job completion photo')

          await fetch(`/api/jobs/${params.id}/photos`, {
            method: 'POST',
            body: formData,
          })
        }
      }

      // Mark job as complete
      const res = await fetch(`/api/jobs/${params.id}/complete`, {
        method: 'POST',
      })
      if (res.ok) {
        const data = await res.json()

        // Add completion note if provided
        if (completionNotes.trim()) {
          await fetch(`/api/jobs/${params.id}/notes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              noteText: completionNotes,
              noteType: 'completion',
            }),
          })
        }

        setShowCompletionModal(false)
        setCompletionNotes('')
        setCompletionPhotos([])

        if (data.warnings && data.warnings.length > 0) {
          alert(`Job completed!\n\nWarnings:\n${data.warnings.join('\n')}`)
        } else {
          alert('Job completed successfully!')
        }
        fetchJob()
        fetchNotes()
        fetchPhotos()
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to complete job')
      }
    } catch (error) {
      console.error('Error completing job:', error)
      alert('Failed to complete job')
    } finally {
      setUploadingCompletionPhotos(false)
    }
  }

  const handleCompletionPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files)
      setCompletionPhotos(prev => [...prev, ...newFiles])
    }
  }

  const removeCompletionPhoto = (index: number) => {
    setCompletionPhotos(prev => prev.filter((_, i) => i !== index))
  }

  // Time log handlers
  const handleAddTimeLog = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch(`/api/jobs/${params.id}/time-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...timeLogForm,
          breakDurationMinutes: parseInt(timeLogForm.breakDurationMinutes),
        }),
      })
      if (res.ok) {
        setShowTimeLogForm(false)
        setTimeLogForm({ startTime: '', endTime: '', breakDurationMinutes: '0', notes: '' })
        fetchTimeLogs()
      } else {
        alert('Failed to add time log')
      }
    } catch (error) {
      console.error('Error adding time log:', error)
      alert('Failed to add time log')
    }
  }

  const handleApproveTimeLog = async (logId: string) => {
    try {
      const res = await fetch(`/api/jobs/${params.id}/time-logs/${logId}/approve`, {
        method: 'POST',
      })
      if (res.ok) {
        fetchTimeLogs()
      }
    } catch (error) {
      console.error('Error approving time log:', error)
    }
  }

  const handleRejectTimeLog = async (logId: string) => {
    try {
      const res = await fetch(`/api/jobs/${params.id}/time-logs/${logId}/reject`, {
        method: 'POST',
      })
      if (res.ok) {
        fetchTimeLogs()
      }
    } catch (error) {
      console.error('Error rejecting time log:', error)
    }
  }

  // Material handlers
  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch(`/api/jobs/${params.id}/materials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(materialForm),
      })
      if (res.ok) {
        setShowMaterialForm(false)
        setMaterialForm({ materialType: 'product', description: '', supplierName: '', quantity: '1', unitPrice: '0' })
        fetchMaterials()
      } else {
        alert('Failed to add material')
      }
    } catch (error) {
      console.error('Error adding material:', error)
      alert('Failed to add material')
    }
  }

  const handleApproveMaterial = async (materialId: string) => {
    try {
      const res = await fetch(`/api/jobs/${params.id}/materials/${materialId}/approve`, {
        method: 'POST',
      })
      if (res.ok) {
        fetchMaterials()
      }
    } catch (error) {
      console.error('Error approving material:', error)
    }
  }

  const handleRejectMaterial = async (materialId: string) => {
    try {
      const res = await fetch(`/api/jobs/${params.id}/materials/${materialId}/reject`, {
        method: 'POST',
      })
      if (res.ok) {
        fetchMaterials()
      }
    } catch (error) {
      console.error('Error rejecting material:', error)
    }
  }

  const handleDeleteMaterial = async (materialId: string) => {
    if (!confirm('Delete this material?')) return
    try {
      const res = await fetch(`/api/jobs/${params.id}/materials/${materialId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        fetchMaterials()
      }
    } catch (error) {
      console.error('Error deleting material:', error)
    }
  }

  // Photo handlers
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingPhoto(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('caption', photoForm.caption)
      formData.append('photoType', photoForm.photoType)

      const res = await fetch(`/api/jobs/${params.id}/photos`, {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        setPhotoForm({ caption: '', photoType: 'during' })
        fetchPhotos()
      } else {
        alert('Failed to upload photo')
      }
    } catch (error) {
      console.error('Error uploading photo:', error)
      alert('Failed to upload photo')
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm('Delete this photo?')) return
    try {
      const res = await fetch(`/api/jobs/${params.id}/photos/${photoId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        fetchPhotos()
      }
    } catch (error) {
      console.error('Error deleting photo:', error)
    }
  }

  // Note handlers
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch(`/api/jobs/${params.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noteForm),
      })
      if (res.ok) {
        setShowNoteForm(false)
        setNoteForm({ noteText: '', noteType: 'general' })
        fetchNotes()
      } else {
        alert('Failed to add note')
      }
    } catch (error) {
      console.error('Error adding note:', error)
      alert('Failed to add note')
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Delete this note?')) return
    try {
      const res = await fetch(`/api/jobs/${params.id}/notes/${noteId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        fetchNotes()
      }
    } catch (error) {
      console.error('Error deleting note:', error)
    }
  }

  // Status handlers
  const handleStatusChange = async (newStatus: string) => {
    try {
      const res = await fetch(`/api/jobs/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        fetchJob()
      }
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }

  const getClientName = () => {
    if (!job) return ''
    if (job.is_company) return job.company_name || 'Unnamed Company'
    return `${job.first_name || ''} ${job.last_name || ''}`.trim() || 'Unnamed Client'
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      quoted: 'bg-gray-100 text-gray-800',
      scheduled: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      invoiced: 'bg-purple-100 text-purple-800',
      cancelled: 'bg-red-100 text-red-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getStatusBadgeColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(typeof amount === 'string' ? parseFloat(amount) : amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Job not found</p>
      </div>
    )
  }

  const totalHours = timeLogs.reduce((sum, log) => sum + (parseFloat(log.total_hours || '0')), 0)
  const totalLaborCost = timeLogs.reduce((sum, log) => sum + (parseFloat(log.labor_cost || '0')), 0)
  const totalBillingAmount = timeLogs.reduce((sum, log) => sum + (parseFloat(log.billing_amount || '0')), 0)
  const totalMaterialCost = materials.reduce((sum, mat) => sum + (parseFloat(mat.total_cost || '0')), 0)
  const totalProjectCost = totalLaborCost + totalMaterialCost
  const totalProjectBilling = totalBillingAmount + totalMaterialCost
  const profitMargin = totalProjectBilling > 0 ? (((totalProjectBilling - totalProjectCost) / totalProjectBilling) * 100).toFixed(1) : '0'

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link href="/dashboard/jobs" className="text-blue-600 hover:text-blue-800">
          ← Back to Jobs
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{job.job_number}</h1>
            <h2 className="text-xl text-gray-700 mt-1">{job.title}</h2>
          </div>
          <div className="flex gap-2">
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(job.status)}`}>
              {job.status.replace('_', ' ')}
            </span>
            <span className="px-3 py-1 rounded-full text-sm font-semibold bg-gray-100 text-gray-800">
              {job.priority}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Client</p>
            <p className="font-medium text-gray-900">{getClientName()}</p>
            {job.client_email && <p className="text-gray-600">{job.client_email}</p>}
            {job.client_phone && <p className="text-gray-600">{job.client_phone}</p>}
          </div>
          <div>
            <p className="text-gray-600">Job Type</p>
            <p className="font-medium text-gray-900">{job.job_type}</p>
            {job.scheduled_date && (
              <>
                <p className="text-gray-600 mt-2">Scheduled</p>
                <p className="font-medium text-gray-900">{formatDate(job.scheduled_date)}</p>
              </>
            )}
          </div>
          <div>
            <p className="text-gray-600">Location</p>
            {job.site_address_line1 ? (
              <p className="font-medium text-gray-900">
                {job.site_address_line1}<br />
                {job.site_city}, {job.site_state} {job.site_postcode}
              </p>
            ) : (
              <p className="text-gray-500">No address set</p>
            )}
          </div>
        </div>

        {job.description && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-gray-600 text-sm">Description</p>
            <p className="text-gray-900">{job.description}</p>
          </div>
        )}

        {/* Cost & Billing Summary */}
        <div className="mt-4 pt-4 border-t">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Project Financials</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-red-50 rounded-lg p-3">
              <p className="text-xs text-red-600 font-medium uppercase">Labor Cost</p>
              <p className="text-xl font-bold text-red-700">{formatCurrency(totalLaborCost.toString())}</p>
              <p className="text-xs text-red-600 mt-1">{totalHours.toFixed(2)} hours</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-3">
              <p className="text-xs text-orange-600 font-medium uppercase">Materials</p>
              <p className="text-xl font-bold text-orange-700">{formatCurrency(totalMaterialCost.toString())}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-xs text-green-600 font-medium uppercase">Labor Billing</p>
              <p className="text-xl font-bold text-green-700">{formatCurrency(totalBillingAmount.toString())}</p>
              <p className="text-xs text-green-600 mt-1">to client</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-xs text-blue-600 font-medium uppercase">Profit Margin</p>
              <p className="text-xl font-bold text-blue-700">{profitMargin}%</p>
              <p className="text-xs text-blue-600 mt-1">
                ${(totalProjectBilling - totalProjectCost).toFixed(2)} profit
              </p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t flex justify-between items-center">
            <div>
              <span className="text-sm text-gray-600">Total Project Cost:</span>
              <span className="ml-2 text-lg font-bold text-red-700">{formatCurrency(totalProjectCost.toString())}</span>
            </div>
            <div>
              <span className="text-sm text-gray-600">Total Project Billing:</span>
              <span className="ml-2 text-lg font-bold text-green-700">{formatCurrency(totalProjectBilling.toString())}</span>
            </div>
          </div>
        </div>

        {/* Timer Widget */}
        <div className="mt-4 pt-4 border-t">
          {activeTimer ? (
            <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="font-semibold text-green-900">Timer Running</span>
                </div>
                <div className="text-3xl font-mono font-bold text-green-700">
                  {formatElapsedTime(elapsedTime)}
                </div>
              </div>
              <button
                onClick={() => setShowStopTimerModal(true)}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold"
              >
                Clock Out
              </button>
            </div>
          ) : (
            <button
              onClick={handleStartTimer}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white rounded-lg px-6 py-3 hover:bg-blue-700 font-semibold text-lg"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Clock In - Start Timer
            </button>
          )}
        </div>

        {/* Linked Quote & Invoice */}
        {(quote || invoice) && (
          <div className="mt-4 pt-4 border-t">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Related Documents</h3>
            <div className="grid grid-cols-2 gap-4">
              {quote && (
                <Link
                  href={`/dashboard/quotes/${quote.id}`}
                  className="block p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-blue-600 uppercase">Quote</span>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      quote.status === 'accepted' ? 'bg-green-100 text-green-800' :
                      quote.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {quote.status}
                    </span>
                  </div>
                  <p className="font-bold text-gray-900">{quote.quote_number}</p>
                  <p className="text-sm text-gray-600 mt-1">{quote.title}</p>
                  <p className="text-lg font-bold text-blue-600 mt-2">{formatCurrency(quote.total_amount)}</p>
                </Link>
              )}
              {invoice && (
                <Link
                  href={`/dashboard/invoices/${invoice.id}`}
                  className="block p-4 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-green-600 uppercase">Invoice</span>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      invoice.status === 'paid' ? 'bg-green-100 text-green-800' :
                      invoice.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                      invoice.status === 'overdue' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {invoice.status}
                    </span>
                  </div>
                  <p className="font-bold text-gray-900">{invoice.invoice_number}</p>
                  <p className="text-lg font-bold text-green-600 mt-2">{formatCurrency(invoice.total_amount)}</p>
                  {parseFloat(invoice.paid_amount) > 0 && (
                    <p className="text-sm text-gray-600 mt-1">
                      Paid: {formatCurrency(invoice.paid_amount)}
                    </p>
                  )}
                </Link>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          {job.status !== 'completed' && job.status !== 'cancelled' && (
            <button
              onClick={handleCompleteJob}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Complete Job
            </button>
          )}
          <Link
            href={`/dashboard/jobs/${params.id}/edit`}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
          >
            Edit Job
          </Link>
          {!invoice && job.status === 'completed' && (
            <Link
              href={`/dashboard/invoices/new?jobId=${params.id}`}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Create Invoice
            </Link>
          )}
          <Link
            href={`/dashboard/calendar?jobId=${job.id}&action=create`}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold"
          >
            📅 Create Appointment
          </Link>
          <button
            onClick={() => alert('Delete functionality coming soon')}
            className="px-6 py-3 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-semibold"
          >
            Delete Job
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'overview', label: 'Overview', count: assignments.length },
              { id: 'time', label: 'Time Tracking', count: timeLogs.length },
              { id: 'materials', label: 'Materials', count: materials.length },
              { id: 'photos', label: 'Photos', count: photos.length },
              { id: 'notes', label: 'Notes', count: notes.length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`
                  whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm
                  ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className="ml-2 py-0.5 px-2 rounded-full text-xs bg-gray-100 text-gray-900">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content - Overview */}
      {activeTab === 'overview' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Team Assignments</h3>
          {assignments.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No team members assigned</p>
          ) : (
            <div className="space-y-2">
              {assignments.map((assignment) => (
                <div key={assignment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div>
                    <p className="font-medium">{assignment.user_name}</p>
                    <p className="text-sm text-gray-600">{assignment.user_email}</p>
                  </div>
                  <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-100 text-blue-800">
                    {assignment.role}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab Content - Time Tracking */}
      {activeTab === 'time' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Time Logs</h3>
            <button
              onClick={() => setShowTimeLogForm(!showTimeLogForm)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium text-sm"
            >
              {showTimeLogForm ? 'Cancel' : '+ Add Time'}
            </button>
          </div>

          {showTimeLogForm && (
            <form onSubmit={handleAddTimeLog} className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input
                    type="datetime-local"
                    value={timeLogForm.startTime}
                    onChange={(e) => setTimeLogForm({ ...timeLogForm, startTime: e.target.value })}
                    className="w-full rounded-md border-gray-300 shadow-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <input
                    type="datetime-local"
                    value={timeLogForm.endTime}
                    onChange={(e) => setTimeLogForm({ ...timeLogForm, endTime: e.target.value })}
                    className="w-full rounded-md border-gray-300 shadow-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Break (minutes)</label>
                  <input
                    type="number"
                    value={timeLogForm.breakDurationMinutes}
                    onChange={(e) => setTimeLogForm({ ...timeLogForm, breakDurationMinutes: e.target.value })}
                    className="w-full rounded-md border-gray-300 shadow-sm"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <input
                    type="text"
                    value={timeLogForm.notes}
                    onChange={(e) => setTimeLogForm({ ...timeLogForm, notes: e.target.value })}
                    className="w-full rounded-md border-gray-300 shadow-sm"
                    placeholder="Optional notes..."
                  />
                </div>
              </div>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium">
                Add Time Log
              </button>
            </form>
          )}

          {timeLogs.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No time logs recorded</p>
          ) : (
            <div className="space-y-3">
              {timeLogs.map((log) => (
                <div key={log.id} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-medium">{log.user_name}</p>
                        <span className={`px-2 py-1 text-xs font-semibold rounded ${getStatusBadgeColor(log.status)}`}>
                          {log.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        {formatDateTime(log.start_time)} → {log.end_time ? formatDateTime(log.end_time) : 'In progress'}
                      </p>
                      {log.total_hours && (
                        <p className="text-sm text-gray-700 mt-1">
                          <strong>{parseFloat(log.total_hours).toFixed(2)} hours</strong>
                          {log.labor_cost && ` • ${formatCurrency(log.labor_cost)}`}
                        </p>
                      )}
                      {log.notes && <p className="text-sm text-gray-600 mt-1">{log.notes}</p>}
                    </div>
                    {log.status === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApproveTimeLog(log.id)}
                          className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleRejectTimeLog(log.id)}
                          className="text-xs px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab Content - Materials */}
      {activeTab === 'materials' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Materials & Equipment</h3>
            <button
              onClick={() => setShowMaterialForm(!showMaterialForm)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium text-sm"
            >
              {showMaterialForm ? 'Cancel' : '+ Add Material'}
            </button>
          </div>

          {showMaterialForm && (
            <form onSubmit={handleAddMaterial} className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={materialForm.materialType}
                    onChange={(e) => setMaterialForm({ ...materialForm, materialType: e.target.value })}
                    className="w-full rounded-md border-gray-300 shadow-sm"
                  >
                    <option value="product">Product</option>
                    <option value="part">Part</option>
                    <option value="hire_equipment">Hire Equipment</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                  <input
                    type="text"
                    value={materialForm.supplierName}
                    onChange={(e) => setMaterialForm({ ...materialForm, supplierName: e.target.value })}
                    className="w-full rounded-md border-gray-300 shadow-sm"
                    placeholder="Supplier name..."
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                  <input
                    type="text"
                    value={materialForm.description}
                    onChange={(e) => setMaterialForm({ ...materialForm, description: e.target.value })}
                    className="w-full rounded-md border-gray-300 shadow-sm"
                    placeholder="Description..."
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={materialForm.quantity}
                    onChange={(e) => setMaterialForm({ ...materialForm, quantity: e.target.value })}
                    className="w-full rounded-md border-gray-300 shadow-sm"
                    required
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={materialForm.unitPrice}
                    onChange={(e) => setMaterialForm({ ...materialForm, unitPrice: e.target.value })}
                    className="w-full rounded-md border-gray-300 shadow-sm"
                    required
                    min="0"
                  />
                </div>
              </div>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium">
                Add Material
              </button>
            </form>
          )}

          {materials.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No materials added</p>
          ) : (
            <div className="space-y-3">
              {materials.map((material) => (
                <div key={material.id} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-medium">{material.description}</p>
                        <span className={`px-2 py-1 text-xs font-semibold rounded ${getStatusBadgeColor(material.status)}`}>
                          {material.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        {material.material_type.replace('_', ' ')}
                        {material.supplier_name && ` • ${material.supplier_name}`}
                      </p>
                      <p className="text-sm text-gray-700 mt-1">
                        Qty: {parseFloat(material.quantity).toFixed(2)} @ {formatCurrency(material.unit_price)} = <strong>{formatCurrency(material.total_cost)}</strong>
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Added by {material.added_by_name}</p>
                    </div>
                    <div className="flex gap-2">
                      {material.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApproveMaterial(material.id)}
                            className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleRejectMaterial(material.id)}
                            className="text-xs px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDeleteMaterial(material.id)}
                        className="text-xs px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab Content - Photos */}
      {activeTab === 'photos' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Job Photos</h3>
            <label className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium text-sm cursor-pointer">
              {uploadingPhoto ? 'Uploading...' : '+ Upload Photo'}
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
                disabled={uploadingPhoto}
              />
            </label>
          </div>

          <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Caption</label>
              <input
                type="text"
                value={photoForm.caption}
                onChange={(e) => setPhotoForm({ ...photoForm, caption: e.target.value })}
                className="w-full rounded-md border-gray-300 shadow-sm text-sm"
                placeholder="Optional caption..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={photoForm.photoType}
                onChange={(e) => setPhotoForm({ ...photoForm, photoType: e.target.value })}
                className="w-full rounded-md border-gray-300 shadow-sm text-sm"
              >
                <option value="before">Before</option>
                <option value="during">During</option>
                <option value="after">After</option>
                <option value="issue">Issue</option>
                <option value="completion">Completion</option>
              </select>
            </div>
          </div>

          {photos.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No photos uploaded</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {photos.map((photo) => (
                <div key={photo.id} className="relative group">
                  <img
                    src={photo.photo_url}
                    alt={photo.caption || 'Job photo'}
                    className="w-full h-48 object-cover rounded-lg"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity rounded-lg flex items-center justify-center">
                    <button
                      onClick={() => handleDeletePhoto(photo.id)}
                      className="opacity-0 group-hover:opacity-100 px-3 py-1 bg-red-600 text-white rounded text-sm"
                    >
                      Delete
                    </button>
                  </div>
                  {photo.caption && (
                    <p className="mt-1 text-sm text-gray-700">{photo.caption}</p>
                  )}
                  <p className="text-xs text-gray-500">
                    {photo.photo_type} • {photo.uploaded_by_name}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab Content - Notes */}
      {activeTab === 'notes' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Job Notes</h3>
            <button
              onClick={() => setShowNoteForm(!showNoteForm)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium text-sm"
            >
              {showNoteForm ? 'Cancel' : '+ Add Note'}
            </button>
          </div>

          {showNoteForm && (
            <form onSubmit={handleAddNote} className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Note Type</label>
                <select
                  value={noteForm.noteType}
                  onChange={(e) => setNoteForm({ ...noteForm, noteType: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm"
                >
                  <option value="general">General</option>
                  <option value="issue">Issue</option>
                  <option value="client_request">Client Request</option>
                  <option value="internal">Internal</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Note *</label>
                <textarea
                  value={noteForm.noteText}
                  onChange={(e) => setNoteForm({ ...noteForm, noteText: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm"
                  rows={3}
                  placeholder="Enter your note..."
                  required
                />
              </div>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium">
                Add Note
              </button>
            </form>
          )}

          {notes.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No notes added</p>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <div key={note.id} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-medium text-sm">{note.user_name}</p>
                        <span className="px-2 py-1 text-xs font-semibold rounded bg-gray-100 text-gray-800">
                          {note.note_type.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-gray-500">{formatDateTime(note.created_at)}</span>
                      </div>
                      <p className="text-gray-700">{note.note_text}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="text-xs px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stop Timer Modal */}
      {/* Completion Modal */}
      {showCompletionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6">
            <h2 className="mb-4 text-2xl font-bold text-gray-900">Complete Job</h2>

            {/* Checklist */}
            <div className="mb-6 space-y-3">
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <p className="font-semibold text-blue-900">Before completing:</p>
                  <ul className="mt-2 space-y-1 text-sm text-blue-800">
                    <li>✓ All work has been finished</li>
                    <li>✓ Clock out if timer is running</li>
                    <li>✓ Add completion photos (recommended)</li>
                    <li>✓ Add any final notes below</li>
                  </ul>
                </div>
              </div>

              {/* Photo Upload Section */}
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-sm font-semibold text-gray-900">Completion Photos</span>
                  </div>
                  <label className="px-3 py-1 bg-blue-600 text-white text-sm rounded cursor-pointer hover:bg-blue-700">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleCompletionPhotoSelect}
                      className="hidden"
                    />
                    Add Photos
                  </label>
                </div>

                {completionPhotos.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {completionPhotos.map((photo, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={URL.createObjectURL(photo)}
                          alt={`Completion photo ${index + 1}`}
                          className="w-full h-24 object-cover rounded"
                        />
                        <button
                          onClick={() => removeCompletionPhoto(index)}
                          className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-2">
                    No photos added yet. Click "Add Photos" to upload completion photos.
                  </p>
                )}
              </div>

              {/* Timer running warning */}
              {activeTimer && (
                <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                  <svg className="w-5 h-5 text-red-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1">
                    <p className="font-semibold text-red-900">Timer Still Running</p>
                    <p className="text-sm text-red-800 mt-1">
                      You have an active timer. Please clock out before completing the job.
                    </p>
                  </div>
                </div>
              )}

              {/* Pending approvals warning */}
              {(timeLogs.some(log => log.status === 'pending') || materials.some(mat => mat.status === 'pending')) && (
                <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div className="flex-1">
                    <p className="font-semibold text-yellow-900">Pending Approvals</p>
                    <p className="text-sm text-yellow-800 mt-1">
                      You have unapproved time logs or materials. You can still complete the job.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Completion notes */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Completion Notes (optional)
              </label>
              <textarea
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                rows={3}
                placeholder="Any final notes about the completed job..."
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowCompletionModal(false)
                  setCompletionNotes('')
                  setCompletionPhotos([])
                }}
                disabled={uploadingCompletionPhotos}
                className="flex-1 rounded-md border border-gray-300 px-4 py-2 font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmCompleteJob}
                disabled={uploadingCompletionPhotos}
                className="flex-1 rounded-md bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {uploadingCompletionPhotos ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Completing...
                  </>
                ) : (
                  'Complete Job'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showStopTimerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h2 className="mb-4 text-xl font-bold">Clock Out</h2>
            <form onSubmit={handleStopTimer}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Time: {formatElapsedTime(elapsedTime)}
                </label>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Break Duration (minutes)
                </label>
                <input
                  type="number"
                  value={stopTimerForm.breakDurationMinutes}
                  onChange={(e) => setStopTimerForm({ ...stopTimerForm, breakDurationMinutes: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm"
                  min="0"
                  placeholder="0"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={stopTimerForm.notes}
                  onChange={(e) => setStopTimerForm({ ...stopTimerForm, notes: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm"
                  rows={3}
                  placeholder="Any notes about this work session..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowStopTimerModal(false)}
                  className="flex-1 rounded-md border border-gray-300 px-4 py-2 font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-md bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
                >
                  Stop Timer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
