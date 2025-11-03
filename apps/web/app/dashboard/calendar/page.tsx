'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
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
  const searchParams = useSearchParams()
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
    jobId: '',
    clientId: '',
  })

  // Separate state for the new date/time picker
  const [appointmentDate, setAppointmentDate] = useState('')
  const [appointmentTime, setAppointmentTime] = useState('')
  const [appointmentDuration, setAppointmentDuration] = useState('120') // default 2 hours in minutes

  useEffect(() => {
    fetchOrganizations()
    fetchTeamMembers()
    fetchAppointments()

    // Check if we're creating an appointment from a job
    const jobId = searchParams.get('jobId')
    const action = searchParams.get('action')
    if (jobId && action === 'create') {
      fetchJobAndPrefillForm(jobId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetchAppointments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const fetchJobAndPrefillForm = async (jobId: string) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`)
      if (res.ok) {
        const data = await res.json()
        const job = data.job

        // Set date/time fields if job has scheduled date
        if (job.scheduled_date) {
          const scheduledDate = new Date(job.scheduled_date)
          const year = scheduledDate.getFullYear()
          const month = String(scheduledDate.getMonth() + 1).padStart(2, '0')
          const day = String(scheduledDate.getDate()).padStart(2, '0')
          const hours = String(scheduledDate.getHours()).padStart(2, '0')
          const minutes = String(scheduledDate.getMinutes()).padStart(2, '0')

          setAppointmentDate(`${year}-${month}-${day}`)
          setAppointmentTime(`${hours}:${minutes}`)
          setAppointmentDuration('120') // default 2 hours
        }

        // Pre-fill form with job details
        setFormData(prev => ({
          ...prev,
          title: job.title || 'Job Appointment',
          description: job.description || '',
          appointmentType: 'job',
          locationAddress: [job.site_address_line1, job.site_city, job.site_state, job.site_postcode]
            .filter(Boolean)
            .join(', '),
          jobId: job.id,
          clientId: job.client_id || '',
          // Set default times if job has scheduled date
          startTime: job.scheduled_date
            ? new Date(job.scheduled_date).toISOString().slice(0, 16)
            : '',
          endTime: job.scheduled_date
            ? new Date(new Date(job.scheduled_date).getTime() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16)
            : '',
        }))

        // Open the form
        setShowAddForm(true)
      }
    } catch (error) {
      console.error('Error fetching job:', error)
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

  // Generate time options in 15-minute increments
  const generateTimeOptions = () => {
    const times = []
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const hourStr = hour.toString().padStart(2, '0')
        const minStr = minute.toString().padStart(2, '0')
        const timeValue = `${hourStr}:${minStr}`
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
        const ampm = hour >= 12 ? 'PM' : 'AM'
        const displayMinute = minStr
        const label = `${displayHour}:${displayMinute} ${ampm}`
        times.push({ value: timeValue, label })
      }
    }
    return times
  }

  // Generate duration options
  const generateDurationOptions = () => {
    const durations = []

    // 15-minute increments for first 2 hours (0-120 minutes)
    for (let minutes = 15; minutes <= 120; minutes += 15) {
      const hours = Math.floor(minutes / 60)
      const mins = minutes % 60
      let label = ''
      if (hours > 0) label += `${hours}h `
      if (mins > 0) label += `${mins}m`
      durations.push({ value: minutes.toString(), label: label.trim() })
    }

    // 30-minute increments from 2.5 hours to 8 hours (150-480 minutes)
    for (let minutes = 150; minutes <= 480; minutes += 30) {
      const hours = Math.floor(minutes / 60)
      const mins = minutes % 60
      let label = `${hours}h`
      if (mins > 0) label += ` ${mins}m`
      durations.push({ value: minutes.toString(), label })
    }

    return durations
  }

  // Update form data when date/time/duration changes
  useEffect(() => {
    if (appointmentDate && appointmentTime && appointmentDuration) {
      // Create datetime-local strings (YYYY-MM-DDTHH:MM format)
      // These represent LOCAL time, not UTC
      const startTimeLocal = `${appointmentDate}T${appointmentTime}`

      // Calculate end time by parsing as local, adding duration, then formatting back
      const startDateTime = new Date(`${appointmentDate}T${appointmentTime}`)
      const endDateTime = new Date(startDateTime.getTime() + parseInt(appointmentDuration) * 60000)

      // Format end time as datetime-local string (still in local timezone)
      const endYear = endDateTime.getFullYear()
      const endMonth = String(endDateTime.getMonth() + 1).padStart(2, '0')
      const endDay = String(endDateTime.getDate()).padStart(2, '0')
      const endHours = String(endDateTime.getHours()).padStart(2, '0')
      const endMinutes = String(endDateTime.getMinutes()).padStart(2, '0')
      const endTimeLocal = `${endYear}-${endMonth}-${endDay}T${endHours}:${endMinutes}`

      setFormData(prev => ({
        ...prev,
        startTime: startTimeLocal,
        endTime: endTimeLocal,
      }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentDate, appointmentTime, appointmentDuration])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const url = editingAppointment
        ? `/api/appointments/${editingAppointment.id}`
        : '/api/appointments'

      const method = editingAppointment ? 'PUT' : 'POST'

      // Convert local datetime strings to ISO strings (UTC) for database storage
      // The datetime-local input gives us a string like "2025-10-26T16:00"
      // We need to explicitly parse it as local time and convert to UTC
      const convertLocalToUTC = (localDateTimeString: string) => {
        if (!localDateTimeString) return ''
        const date = new Date(localDateTimeString)
        return date.toISOString()
      }

      const submitData = {
        ...formData,
        startTime: convertLocalToUTC(formData.startTime),
        endTime: convertLocalToUTC(formData.endTime),
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
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
          jobId: '',
          clientId: '',
        })
        // Reset new date/time/duration fields
        setAppointmentDate('')
        setAppointmentTime('')
        setAppointmentDuration('120')
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

    // Convert UTC times to local timezone
    const startDate = new Date(appointment.start_time)
    const endDate = new Date(appointment.end_time)

    // Extract date in YYYY-MM-DD format
    const year = startDate.getFullYear()
    const month = String(startDate.getMonth() + 1).padStart(2, '0')
    const day = String(startDate.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`

    // Extract time in HH:MM format
    const hours = String(startDate.getHours()).padStart(2, '0')
    const minutes = String(startDate.getMinutes()).padStart(2, '0')
    const timeStr = `${hours}:${minutes}`

    // Calculate duration in minutes
    const durationMs = endDate.getTime() - startDate.getTime()
    const durationMinutes = Math.round(durationMs / 60000)

    // Set the separate fields
    setAppointmentDate(dateStr)
    setAppointmentTime(timeStr)
    setAppointmentDuration(durationMinutes.toString())

    // Format for datetime-local input (backup)
    const formatDateTimeLocal = (dateString: string) => {
      const date = new Date(dateString)
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      const h = String(date.getHours()).padStart(2, '0')
      const min = String(date.getMinutes()).padStart(2, '0')
      return `${y}-${m}-${d}T${h}:${min}`
    }

    setFormData({
      organizationId: formData.organizationId,
      title: appointment.title,
      description: appointment.description || '',
      appointmentType: appointment.appointment_type,
      startTime: formatDateTimeLocal(appointment.start_time),
      endTime: formatDateTimeLocal(appointment.end_time),
      allDay: appointment.all_day,
      assignedToUserId: appointment.assigned_to_user_id || '',
      locationAddress: appointment.location_address || '',
      jobId: '',
      clientId: '',
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

  // Get appointments for a specific team member
  const getAppointmentsForMember = (userId: string) => {
    return appointments.filter(apt => apt.assigned_to_user_id === userId)
  }

  // Calculate position and height for timeline view
  const getAppointmentStyle = (startTime: string, endTime: string) => {
    const start = new Date(startTime)
    const end = new Date(endTime)
    const startHour = start.getHours() + start.getMinutes() / 60
    const endHour = end.getHours() + end.getMinutes() / 60

    const top = ((startHour - 6) * 60) // 60px per hour, starting at 6 AM
    const height = (endHour - startHour) * 60

    return {
      top: `${Math.max(0, top)}px`,
      height: `${Math.max(30, height)}px`,
    }
  }

  // Generate hour labels for timeline
  const getHourLabels = () => {
    const hours = []
    for (let i = 6; i <= 22; i++) { // 6 AM to 10 PM
      hours.push(i)
    }
    return hours
  }

  // Get team member color
  const getMemberColor = (index: number) => {
    const colors = [
      'bg-blue-100 border-blue-400 text-blue-800',
      'bg-green-100 border-green-400 text-green-800',
      'bg-purple-100 border-purple-400 text-purple-800',
      'bg-orange-100 border-orange-400 text-orange-800',
      'bg-pink-100 border-pink-400 text-pink-800',
      'bg-indigo-100 border-indigo-400 text-indigo-800',
    ]
    return colors[index % colors.length]
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

      {/* Calendar View */}
      {view === 'day' && selectedUserId !== 'all' ? (
        /* Timeline View for Single Team Member */
        <div className="rounded-lg bg-white shadow overflow-hidden">
          <div className="p-4 border-b bg-gray-50">
            <h3 className="text-lg font-semibold">
              {teamMembers.find(m => m.user_id === selectedUserId)?.full_name}&apos;s Schedule
            </h3>
          </div>
          <div className="p-6 overflow-x-auto">
            <div className="relative" style={{ minHeight: '1020px' }}>
              {/* Hour labels and grid lines */}
              {getHourLabels().map((hour, index) => (
                <div
                  key={hour}
                  className="absolute left-0 right-0 border-t border-gray-200"
                  style={{ top: `${index * 60}px` }}
                >
                  <span className="inline-block w-16 text-xs text-gray-500 -mt-2 bg-white px-1">
                    {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                  </span>
                </div>
              ))}

              {/* Appointments */}
              <div className="absolute left-20 right-0">
                {getAppointmentsForMember(selectedUserId).map((apt) => {
                  const style = getAppointmentStyle(apt.start_time, apt.end_time)
                  return (
                    <div
                      key={apt.id}
                      className={`absolute left-0 right-2 rounded-lg border-l-4 p-2 cursor-pointer hover:shadow-lg transition-shadow ${getAppointmentTypeColor(apt.appointment_type)}`}
                      style={style}
                      onClick={() => handleEdit(apt)}
                    >
                      <div className="text-sm font-semibold truncate">{apt.title}</div>
                      <div className="text-xs truncate">
                        {new Date(apt.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        {' - '}
                        {new Date(apt.end_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </div>
                      {apt.location_address && (
                        <div className="text-xs truncate mt-1">📍 {apt.location_address}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      ) : view === 'day' ? (
        /* Timeline View for All Team Members */
        <div className="rounded-lg bg-white shadow overflow-hidden">
          <div className="p-4 border-b bg-gray-50">
            <h3 className="text-lg font-semibold">Team Schedule</h3>
          </div>
          <div className="overflow-x-auto">
            <div className="inline-flex min-w-full">
              {/* Time column */}
              <div className="w-20 flex-shrink-0 border-r bg-gray-50">
                <div className="h-16"></div>
                {getHourLabels().map((hour) => (
                  <div key={hour} className="h-[60px] border-t border-gray-200 text-xs text-gray-500 px-2 pt-1">
                    {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                  </div>
                ))}
              </div>

              {/* Team member columns */}
              {teamMembers.map((member, memberIndex) => (
                <div key={member.user_id} className="flex-1 min-w-[200px] border-r relative">
                  {/* Header */}
                  <div className={`h-16 border-b px-3 py-2 ${getMemberColor(memberIndex)} bg-opacity-30`}>
                    <div className="font-semibold text-sm">{member.full_name}</div>
                    <div className="text-xs">
                      {getAppointmentsForMember(member.user_id).length} appointments
                    </div>
                  </div>

                  {/* Grid lines */}
                  <div className="relative" style={{ height: '1020px' }}>
                    {getHourLabels().map((hour, index) => (
                      <div
                        key={hour}
                        className="absolute left-0 right-0 border-t border-gray-100"
                        style={{ top: `${index * 60}px` }}
                      />
                    ))}

                    {/* Appointments */}
                    {getAppointmentsForMember(member.user_id).map((apt) => {
                      const style = getAppointmentStyle(apt.start_time, apt.end_time)
                      return (
                        <div
                          key={apt.id}
                          className={`absolute left-1 right-1 rounded border-l-4 p-1.5 cursor-pointer hover:shadow-md transition-shadow text-xs ${getAppointmentTypeColor(apt.appointment_type)}`}
                          style={style}
                          onClick={() => handleEdit(apt)}
                        >
                          <div className="font-semibold truncate">{apt.title}</div>
                          <div className="truncate opacity-75">
                            {new Date(apt.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* List View for Week/Month */
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
      )}

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
                  // Reset date/time/duration fields
                  setAppointmentDate('')
                  setAppointmentTime('')
                  setAppointmentDuration('120')
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

              {/* Date Picker */}
              <div>
                <label className="block text-sm font-medium">Date *</label>
                <input
                  type="date"
                  required
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </div>

              {/* Time and Duration */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium">Start Time *</label>
                  <select
                    required
                    value={appointmentTime}
                    onChange={(e) => setAppointmentTime(e.target.value)}
                    className="mt-1 w-full rounded border px-3 py-2"
                  >
                    <option value="">Select time</option>
                    {generateTimeOptions().map((time) => (
                      <option key={time.value} value={time.value}>
                        {time.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium">Duration *</label>
                  <select
                    required
                    value={appointmentDuration}
                    onChange={(e) => setAppointmentDuration(e.target.value)}
                    className="mt-1 w-full rounded border px-3 py-2"
                  >
                    {generateDurationOptions().map((duration) => (
                      <option key={duration.value} value={duration.value}>
                        {duration.label}
                      </option>
                    ))}
                  </select>
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
