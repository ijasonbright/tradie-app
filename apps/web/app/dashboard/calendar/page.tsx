'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Appointment {
  id: string
  title: string
  description: string | null
  appointment_type: string
  start_time: string
  end_time: string
  all_day: boolean
  assigned_to_user_id: string
  assigned_to_name: string
  client_company_name: string | null
  client_first_name: string | null
  client_last_name: string | null
  is_company: boolean
  job_number: string | null
  job_title: string | null
  location_address: string | null
}

interface Organization {
  id: string
  name: string
}

interface TeamMember {
  user_id: string
  full_name: string
}

export default function CalendarPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'week' | 'day' | 'month'>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedUserId, setSelectedUserId] = useState<string>('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null)

  const [formData, setFormData] = useState({
    organizationId: '',
    title: '',
    description: '',
    appointmentType: 'job',
    startTime: '',
    endTime: '',
    allDay: false,
    assignedToUserId: '',
    locationAddress: '',
  })

  useEffect(() => {
    fetchOrganizations()
    fetchTeamMembers()
    fetchAppointments()
  }, [])

  useEffect(() => {
    fetchAppointments()
  }, [currentDate, view, selectedUserId])

  const fetchOrganizations = async () => {
    try {
      const res = await fetch('/api/organizations')
      const data = await res.json()
      setOrganizations(data.organizations || [])
      if (data.organizations?.length > 0) {
        setFormData(prev => ({ ...prev, organizationId: data.organizations[0].id }))
      }
    } catch (error) {
      console.error('Error fetching organizations:', error)
    }
  }

  const fetchTeamMembers = async () => {
    try {
      const res = await fetch('/api/organizations/members')
      const data = await res.json()
      setTeamMembers(data.members || [])
    } catch (error) {
      console.error('Error fetching team members:', error)
    }
  }

  const fetchAppointments = async () => {
    try {
      setLoading(true)
      const startDate = getViewStartDate()
      const endDate = getViewEndDate()

      let url = `/api/appointments?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
      if (selectedUserId !== 'all') {
        url += `&assignedToUserId=${selectedUserId}`
      }

      const res = await fetch(url)
      const data = await res.json()
      setAppointments(data.appointments || [])
    } catch (error) {
      console.error('Error fetching appointments:', error)
    } finally {
      setLoading(false)
    }
  }

  const getViewStartDate = () => {
    const date = new Date(currentDate)
    if (view === 'week') {
      const day = date.getDay()
      const diff = date.getDate() - day + (day === 0 ? -6 : 1)
      date.setDate(diff)
    } else if (view === 'month') {
      date.setDate(1)
    }
    date.setHours(0, 0, 0, 0)
    return date
  }

  const getViewEndDate = () => {
    const date = new Date(currentDate)
    if (view === 'week') {
      const day = date.getDay()
      const diff = date.getDate() - day + (day === 0 ? -6 : 1) + 6
      date.setDate(diff)
    } else if (view === 'month') {
      date.setMonth(date.getMonth() + 1)
      date.setDate(0)
    }
    date.setHours(23, 59, 59, 999)
    return date
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const url = editingAppointment
        ? `/api/appointments/${editingAppointment.id}`
        : '/api/appointments'

      const method = editingAppointment ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        setShowAddForm(false)
        setEditingAppointment(null)
        fetchAppointments()
        // Reset form
        setFormData({
          organizationId: formData.organizationId,
          title: '',
          description: '',
          appointmentType: 'job',
          startTime: '',
          endTime: '',
          allDay: false,
          assignedToUserId: '',
          locationAddress: '',
        })
      } else {
        const error = await res.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error saving appointment:', error)
      alert('Failed to save appointment')
    }
  }

  const handleEdit = (appointment: Appointment) => {
    setEditingAppointment(appointment)
    setFormData({
      organizationId: formData.organizationId,
      title: appointment.title,
      description: appointment.description || '',
      appointmentType: appointment.appointment_type,
      startTime: new Date(appointment.start_time).toISOString().slice(0, 16),
      endTime: new Date(appointment.end_time).toISOString().slice(0, 16),
      allDay: appointment.all_day,
      assignedToUserId: appointment.assigned_to_user_id || '',
      locationAddress: appointment.location_address || '',
    })
    setShowAddForm(true)
  }

  const handleDelete = async (appointmentId: string) => {
    if (!confirm('Are you sure you want to delete this appointment?')) return

    try {
      const res = await fetch(`/api/appointments/${appointmentId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        fetchAppointments()
      } else {
        const error = await res.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error deleting appointment:', error)
      alert('Failed to delete appointment')
    }
  }

  const getClientName = (apt: Appointment) => {
    if (apt.is_company && apt.client_company_name) {
      return apt.client_company_name
    }
    return [apt.client_first_name, apt.client_last_name].filter(Boolean).join(' ') || 'No client'
  }

  const getAppointmentTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      job: 'bg-blue-100 text-blue-800 border-blue-300',
      quote: 'bg-purple-100 text-purple-800 border-purple-300',
      meeting: 'bg-green-100 text-green-800 border-green-300',
      site_visit: 'bg-orange-100 text-orange-800 border-orange-300',
      admin: 'bg-gray-100 text-gray-800 border-gray-300',
      personal: 'bg-pink-100 text-pink-800 border-pink-300',
    }
    return colors[type] || 'bg-gray-100 text-gray-800 border-gray-300'
  }

  const goToPrevious = () => {
    const date = new Date(currentDate)
    if (view === 'day') {
      date.setDate(date.getDate() - 1)
    } else if (view === 'week') {
      date.setDate(date.getDate() - 7)
    } else {
      date.setMonth(date.getMonth() - 1)
    }
    setCurrentDate(date)
  }

  const goToNext = () => {
    const date = new Date(currentDate)
    if (view === 'day') {
      date.setDate(date.getDate() + 1)
    } else if (view === 'week') {
      date.setDate(date.getDate() + 7)
    } else {
      date.setMonth(date.getMonth() + 1)
    }
    setCurrentDate(date)
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const formatHeaderDate = () => {
    if (view === 'day') {
      return currentDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    } else if (view === 'week') {
      const start = getViewStartDate()
      const end = getViewEndDate()
      return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    } else {
      return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    }
  }

  if (loading && appointments.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading calendar...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Calendar</h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          + New Appointment
        </button>
      </div>

      {/* Controls */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevious}
            className="rounded border px-3 py-1 hover:bg-gray-100"
          >
            ←
          </button>
          <button
            onClick={goToToday}
            className="rounded border px-3 py-1 hover:bg-gray-100"
          >
            Today
          </button>
          <button
            onClick={goToNext}
            className="rounded border px-3 py-1 hover:bg-gray-100"
          >
            →
          </button>
          <span className="ml-4 font-semibold">{formatHeaderDate()}</span>
        </div>

        <div className="flex items-center gap-4">
          {/* Team Member Filter */}
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="rounded border px-3 py-1"
          >
            <option value="all">All Team Members</option>
            {teamMembers.map((member) => (
              <option key={member.user_id} value={member.user_id}>
                {member.full_name}
              </option>
            ))}
          </select>

          {/* View Selector */}
          <div className="flex rounded border">
            <button
              onClick={() => setView('day')}
              className={`px-3 py-1 ${view === 'day' ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'}`}
            >
              Day
            </button>
            <button
              onClick={() => setView('week')}
              className={`border-x px-3 py-1 ${view === 'week' ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'}`}
            >
              Week
            </button>
            <button
              onClick={() => setView('month')}
              className={`px-3 py-1 ${view === 'month' ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'}`}
            >
              Month
            </button>
          </div>
        </div>
      </div>

      {/* Calendar View - Simple List for now */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="mb-4 text-lg font-semibold">Upcoming Appointments</h3>
        {appointments.length === 0 ? (
          <p className="text-gray-500">No appointments scheduled for this period</p>
        ) : (
          <div className="space-y-3">
            {appointments.map((apt) => (
              <div
                key={apt.id}
                className={`rounded-lg border-l-4 p-4 ${getAppointmentTypeColor(apt.appointment_type)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{apt.title}</h4>
                      <span className="rounded bg-white px-2 py-0.5 text-xs">
                        {apt.appointment_type}
                      </span>
                    </div>
                    <p className="mt-1 text-sm">
                      {new Date(apt.start_time).toLocaleString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                      {' - '}
                      {new Date(apt.end_time).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-600">
                      <span>👤 {apt.assigned_to_name}</span>
                      {apt.job_number && <span>📋 Job #{apt.job_number}</span>}
                      {(apt.client_first_name || apt.client_company_name) && (
                        <span>👥 {getClientName(apt)}</span>
                      )}
                      {apt.location_address && <span>📍 {apt.location_address}</span>}
                    </div>
                    {apt.description && (
                      <p className="mt-2 text-sm text-gray-600">{apt.description}</p>
                    )}
                  </div>
                  <div className="ml-4 flex gap-2">
                    <button
                      onClick={() => handleEdit(apt)}
                      className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(apt.id)}
                      className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
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

      {/* Add Appointment Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold">
                {editingAppointment ? 'Edit Appointment' : 'New Appointment'}
              </h2>
              <button
                onClick={() => {
                  setShowAddForm(false)
                  setEditingAppointment(null)
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium">Title *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium">Type *</label>
                  <select
                    required
                    value={formData.appointmentType}
                    onChange={(e) => setFormData({ ...formData, appointmentType: e.target.value })}
                    className="mt-1 w-full rounded border px-3 py-2"
                  >
                    <option value="job">Job</option>
                    <option value="quote">Quote</option>
                    <option value="meeting">Meeting</option>
                    <option value="site_visit">Site Visit</option>
                    <option value="admin">Admin</option>
                    <option value="personal">Personal</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium">Assign To *</label>
                  <select
                    required
                    value={formData.assignedToUserId}
                    onChange={(e) => setFormData({ ...formData, assignedToUserId: e.target.value })}
                    className="mt-1 w-full rounded border px-3 py-2"
                  >
                    <option value="">Select team member</option>
                    {teamMembers.map((member) => (
                      <option key={member.user_id} value={member.user_id}>
                        {member.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium">Start Time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="mt-1 w-full rounded border px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium">End Time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="mt-1 w-full rounded border px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium">Location</label>
                <input
                  type="text"
                  value={formData.locationAddress}
                  onChange={(e) => setFormData({ ...formData, locationAddress: e.target.value })}
                  className="mt-1 w-full rounded border px-3 py-2"
                  placeholder="Address or meeting location"
                />
              </div>

              <div>
                <label className="block text-sm font-medium">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="mt-1 w-full rounded border px-3 py-2"
                  rows={3}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="allDay"
                  checked={formData.allDay}
                  onChange={(e) => setFormData({ ...formData, allDay: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="allDay" className="text-sm">
                  All day event
                </label>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 rounded bg-blue-600 py-2 text-white hover:bg-blue-700"
                >
                  {editingAppointment ? 'Update Appointment' : 'Create Appointment'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false)
                    setEditingAppointment(null)
                  }}
                  className="rounded border px-6 py-2 hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
