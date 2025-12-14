import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Linking, Platform } from 'react-native'
import { FAB } from 'react-native-paper'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'expo-router'
import { useAuth } from '../../lib/auth'
import { apiClient } from '../../lib/api-client'

// Type for TC calendar details
interface TCCalendarDetails {
  firstname: string | null
  lastname: string | null
  mobile: string | null
  email: string | null
  tfname: string | null
  additionaljobtype: string | null
  statusName: string | null
  statusId: number | null
  address1: string | null
  fullAddress: string | null
  lat: number | null
  long: number | null
  prettyPrintDate: string | null
  description: string | null
  entryNotes: string | null
}

// Mock data for today's schedule
const MOCK_APPOINTMENTS = [
  {
    id: '1',
    time: '09:00 AM',
    endTime: '11:00 AM',
    title: 'Kitchen Renovation',
    client: 'John Smith',
    address: '123 Main St, Sydney',
    type: 'job',
    status: 'confirmed',
  },
  {
    id: '2',
    time: '01:00 PM',
    endTime: '03:00 PM',
    title: 'Bathroom Plumbing',
    client: 'Jane Doe',
    address: '456 Oak Ave, Melbourne',
    type: 'job',
    status: 'confirmed',
  },
  {
    id: '3',
    time: '04:00 PM',
    endTime: '05:00 PM',
    title: 'Quote Meeting - Office Fit-out',
    client: 'ABC Company',
    address: '789 Pine Rd, Brisbane',
    type: 'quote',
    status: 'confirmed',
  },
]

const TYPE_COLORS: Record<string, string> = {
  job: '#2563eb',
  quote: '#9333ea',
  meeting: '#0891b2',
  site_visit: '#ea580c',
  asset_register: '#16a34a',
  tradieconnect: '#7c3aed', // Purple for TradieConnect jobs
}

type ViewMode = 'day' | 'week' | 'month'

export default function CalendarScreen() {
  const router = useRouter()
  const { isSignedIn } = useAuth()
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('day')
  // Cache for TC job details (keyed by tc_job_id)
  const [tcDetailsCache, setTcDetailsCache] = useState<Record<string, TCCalendarDetails>>({})
  const [loadingTcDetails, setLoadingTcDetails] = useState<Set<string>>(new Set())

  const formatHeaderDate = () => {
    if (viewMode === 'day') {
      return selectedDate.toLocaleDateString('en-AU', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    } else if (viewMode === 'week') {
      const startOfWeek = new Date(selectedDate)
      startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay())
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6)
      return `${startOfWeek.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} - ${endOfWeek.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`
    } else {
      return selectedDate.toLocaleDateString('en-AU', {
        year: 'numeric',
        month: 'long',
      })
    }
  }

  const isToday = () => {
    const today = new Date()
    return (
      selectedDate.getDate() === today.getDate() &&
      selectedDate.getMonth() === today.getMonth() &&
      selectedDate.getFullYear() === today.getFullYear()
    )
  }

  // Fetch TC job details for calendar display
  const fetchTCJobDetails = useCallback(async (tcJobId: number | string) => {
    const jobIdStr = String(tcJobId)

    // Skip if already cached or currently loading
    if (tcDetailsCache[jobIdStr] || loadingTcDetails.has(jobIdStr)) {
      return
    }

    // Mark as loading
    setLoadingTcDetails(prev => new Set(prev).add(jobIdStr))

    try {
      const response = await apiClient.getTCJobCalendarDetails(tcJobId)
      if (response.success && response.job) {
        setTcDetailsCache(prev => ({
          ...prev,
          [jobIdStr]: response.job as TCCalendarDetails
        }))
      }
    } catch (err) {
      console.error(`Failed to fetch TC job details for ${tcJobId}:`, err)
    } finally {
      setLoadingTcDetails(prev => {
        const newSet = new Set(prev)
        newSet.delete(jobIdStr)
        return newSet
      })
    }
  }, [tcDetailsCache, loadingTcDetails])

  // Fetch TC details for all TradieConnect appointments
  const fetchAllTCDetails = useCallback(async (apps: any[]) => {
    const tcApps = apps.filter(app => app.appointment_type === 'tradieconnect' && app.tc_job_id)
    for (const app of tcApps) {
      fetchTCJobDetails(app.tc_job_id)
    }
  }, [fetchTCJobDetails])

  // Fetch appointments based on selected date and view mode
  const fetchAppointments = async () => {
    try {
      setError(null)
      let startDate: Date, endDate: Date

      if (viewMode === 'day') {
        // Single day
        startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate())
        endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59)
      } else if (viewMode === 'week') {
        // Week view (Sunday to Saturday)
        startDate = new Date(selectedDate)
        startDate.setDate(selectedDate.getDate() - selectedDate.getDay())
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(startDate)
        endDate.setDate(startDate.getDate() + 6)
        endDate.setHours(23, 59, 59, 999)
      } else {
        // Month view
        startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
        endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59)
      }

      const response = await apiClient.getAppointments({
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString()
      })
      console.log('Fetched appointments:', response)
      const apps = response.appointments || []
      setAppointments(apps)

      // Fetch TC job details for TradieConnect appointments
      fetchAllTCDetails(apps)
    } catch (err: any) {
      console.error('Failed to fetch appointments:', err)
      setError(err.message || 'Failed to load appointments')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Load appointments when date, viewMode, or auth changes
  useEffect(() => {
    if (isSignedIn) {
      setLoading(true)
      fetchAppointments()
    }
  }, [isSignedIn, selectedDate, viewMode])

  // Pull to refresh
  const onRefresh = () => {
    setRefreshing(true)
    fetchAppointments()
  }

  // Navigate to previous period
  const goToPrevious = () => {
    const newDate = new Date(selectedDate)
    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() - 1)
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7)
    } else {
      newDate.setMonth(newDate.getMonth() - 1)
    }
    setSelectedDate(newDate)
  }

  // Navigate to next period
  const goToNext = () => {
    const newDate = new Date(selectedDate)
    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() + 1)
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7)
    } else {
      newDate.setMonth(newDate.getMonth() + 1)
    }
    setSelectedDate(newDate)
  }

  // Go to today
  const goToToday = () => {
    setSelectedDate(new Date())
  }

  // Handle phone call
  const handleCall = (phoneNumber: string | null | undefined) => {
    if (!phoneNumber) {
      alert('No phone number available')
      return
    }
    const url = `tel:${phoneNumber}`
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(url)
        } else {
          alert('Unable to make phone call')
        }
      })
      .catch((err) => console.error('Error making phone call:', err))
  }

  // Handle navigation to address
  const handleNavigate = (address: string | null | undefined) => {
    if (!address) {
      alert('No address available')
      return
    }

    const encodedAddress = encodeURIComponent(address)
    const url = Platform.select({
      ios: `maps://app?daddr=${encodedAddress}`,
      android: `google.navigation:q=${encodedAddress}`,
    }) || `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`

    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(url)
        } else {
          // Fallback to browser-based Google Maps
          return Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`)
        }
      })
      .catch((err) => console.error('Error opening maps:', err))
  }

  const renderAppointment = (appointment: any) => {
    // Safety check - skip rendering if appointment is null/undefined or missing id
    if (!appointment || !appointment.id) {
      console.warn('Skipping invalid appointment:', appointment)
      return null
    }

    // Format times from database
    const formatTime = (dateStr: string | null | undefined) => {
      if (!dateStr) return ''
      try {
        const date = new Date(dateStr)
        if (isNaN(date.getTime())) return ''
        return date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
      } catch (e) {
        return ''
      }
    }

    // Calculate end time for TC jobs (30 min duration)
    const getEndTimeFor30Min = (startDateStr: string | null | undefined) => {
      if (!startDateStr) return ''
      try {
        const date = new Date(startDateStr)
        if (isNaN(date.getTime())) return ''
        date.setMinutes(date.getMinutes() + 30)
        return date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
      } catch (e) {
        return ''
      }
    }

    // Determine what type of item this is
    const isTradieConnect = appointment.appointment_type === 'tradieconnect'
    const isAssetRegister = appointment.appointment_type === 'asset_register'
    const isJob = appointment.job_id && appointment.job_id === appointment.id

    // Get TC details from cache if this is a TradieConnect appointment
    const tcJobId = appointment.tc_job_id ? String(appointment.tc_job_id) : null
    const tcDetails = tcJobId ? tcDetailsCache[tcJobId] : null
    const isLoadingTcDetails = tcJobId ? loadingTcDetails.has(tcJobId) : false

    // Build client name - use TC details for TradieConnect appointments
    let clientName = ''
    if (isTradieConnect && tcDetails) {
      const firstName = tcDetails.firstname || ''
      const lastName = tcDetails.lastname || ''
      clientName = `${firstName} ${lastName}`.trim()
    } else if (appointment.is_company && appointment.company_name) {
      clientName = appointment.company_name
    } else {
      const firstName = appointment.first_name || ''
      const lastName = appointment.last_name || ''
      clientName = `${firstName} ${lastName}`.trim()
    }

    // Get appointment type with fallback
    const appointmentType = appointment.appointment_type || 'job'

    const startTime = formatTime(appointment.start_time)
    // For TC jobs, use 30 min duration; otherwise use actual end time
    const endTime = isTradieConnect
      ? getEndTimeFor30Min(appointment.start_time)
      : formatTime(appointment.end_time)

    // Format the date for week view - safely handle null/invalid dates
    let dateLabel = ''
    if (appointment.start_time) {
      try {
        const appointmentDate = new Date(appointment.start_time)
        if (!isNaN(appointmentDate.getTime())) {
          dateLabel = appointmentDate.toLocaleDateString('en-AU', {
            weekday: 'short',
            day: 'numeric',
            month: 'short'
          })
        }
      } catch (e) {
        // Ignore date parsing errors
      }
    }

    // Get phone number - prefer TC details mobile for TC appointments
    const clientPhone = isTradieConnect && tcDetails?.mobile
      ? tcDetails.mobile
      : (appointment.client_phone || appointment.client_mobile || null)

    // Get address - prefer TC details for TC appointments
    const displayAddress = isTradieConnect && tcDetails?.address1
      ? tcDetails.address1
      : appointment.location_address

    // Get navigation address - prefer full address from TC details
    const navigationAddress = isTradieConnect && tcDetails?.fullAddress
      ? tcDetails.fullAddress
      : (isTradieConnect && tcDetails?.address1 ? tcDetails.address1 : appointment.location_address)

    // Get job type from TC details
    const tcJobType = tcDetails?.tfname || null
    const tcAdditionalJobType = tcDetails?.additionaljobtype || null
    const tcStatusName = tcDetails?.statusName || null

    // Build title - use TC job type for TradieConnect appointments
    const displayTitle = isTradieConnect && tcJobType
      ? tcJobType
      : (appointment.title || 'Untitled Appointment')

    const handlePress = () => {
      if (!appointment.id) return // Safety check
      if (isTradieConnect && appointment.tc_job_id) {
        // Navigate to TradieConnect job view
        router.push(`/tc-job/${appointment.tc_job_id}`)
      } else if (isAssetRegister) {
        router.push(`/asset-register/${appointment.id}`)
      } else if (isJob) {
        router.push(`/job/${appointment.id}`)
      } else {
        router.push(`/appointment/${appointment.id}`)
      }
    }

    return (
      <TouchableOpacity
        key={appointment.id}
        style={styles.appointmentCard}
        onPress={handlePress}
      >
        <View style={styles.timeColumn}>
          {viewMode === 'week' && <Text style={styles.dateLabel}>{dateLabel}</Text>}
          <Text style={styles.time}>{startTime || 'TBD'}</Text>
          <Text style={styles.endTime}>{endTime || ''}</Text>
        </View>

        <View
          style={[
            styles.colorBar,
            { backgroundColor: TYPE_COLORS[appointmentType] || TYPE_COLORS.job },
          ]}
        />

        <View style={styles.detailsColumn}>
          <View style={styles.header}>
            <Text style={styles.title}>{displayTitle}</Text>
            <View
              style={[
                styles.typeChip,
                { backgroundColor: TYPE_COLORS[appointmentType] || TYPE_COLORS.job },
              ]}
            >
              <Text style={styles.chipText}>
                {isTradieConnect ? 'TC' : (appointmentType || 'job').replace('_', ' ').toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Additional Job Type - highlighted if present (TC only) */}
          {isTradieConnect && tcAdditionalJobType && (
            <View style={styles.additionalJobTypeRow}>
              <MaterialCommunityIcons name="alert-circle" size={14} color="#ea580c" />
              <Text style={styles.additionalJobTypeText}>{tcAdditionalJobType}</Text>
            </View>
          )}

          {/* Status (TC only) */}
          {isTradieConnect && tcStatusName && (
            <View style={styles.row}>
              <MaterialCommunityIcons name="flag" size={14} color="#666" />
              <Text style={styles.info}>{tcStatusName}</Text>
            </View>
          )}

          {/* Contact name */}
          {clientName && (
            <View style={styles.row}>
              <MaterialCommunityIcons name="account" size={14} color="#666" />
              <Text style={styles.info}>{clientName}</Text>
            </View>
          )}

          {/* Address */}
          {displayAddress && (
            <View style={styles.row}>
              <MaterialCommunityIcons name="map-marker" size={14} color="#666" />
              <Text style={styles.info}>{displayAddress}</Text>
            </View>
          )}

          {/* Loading indicator for TC details */}
          {isTradieConnect && isLoadingTcDetails && (
            <View style={styles.row}>
              <ActivityIndicator size="small" color="#7c3aed" />
              <Text style={styles.loadingDetailsText}>Loading details...</Text>
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={(e) => {
                e.stopPropagation() // Prevent navigating to edit screen
                handleCall(clientPhone)
              }}
            >
              <MaterialCommunityIcons name="phone" size={18} color="#2563eb" />
              <Text style={styles.actionText}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={(e) => {
                e.stopPropagation() // Prevent navigating to edit screen
                handleNavigate(navigationAddress)
              }}
            >
              <MaterialCommunityIcons name="navigation" size={18} color="#2563eb" />
              <Text style={styles.actionText}>Navigate</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  // Show loading spinner while fetching appointments (only on first load)
  if (loading && !refreshing && appointments.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.viewModeSwitcher}>
          <TouchableOpacity style={[styles.viewModeButton, viewMode === 'day' && styles.viewModeButtonActive]} onPress={() => setViewMode('day')}>
            <Text style={[styles.viewModeText, viewMode === 'day' && styles.viewModeTextActive]}>Day</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.viewModeButton, viewMode === 'week' && styles.viewModeButtonActive]} onPress={() => setViewMode('week')}>
            <Text style={[styles.viewModeText, viewMode === 'week' && styles.viewModeTextActive]}>Week</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.viewModeButton, viewMode === 'month' && styles.viewModeButtonActive]} onPress={() => setViewMode('month')}>
            <Text style={[styles.viewModeText, viewMode === 'month' && styles.viewModeTextActive]}>Month</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.dateHeader}>
          <TouchableOpacity onPress={goToPrevious} style={styles.navButton}>
            <MaterialCommunityIcons name="chevron-left" size={28} color="#2563eb" />
          </TouchableOpacity>
          <View style={styles.dateInfo}>
            <Text style={styles.dateText}>{formatHeaderDate()}</Text>
          </View>
          <TouchableOpacity onPress={goToNext} style={styles.navButton}>
            <MaterialCommunityIcons name="chevron-right" size={28} color="#2563eb" />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading appointments...</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* View Mode Switcher */}
      <View style={styles.viewModeSwitcher}>
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'day' && styles.viewModeButtonActive]}
          onPress={() => setViewMode('day')}
        >
          <Text style={[styles.viewModeText, viewMode === 'day' && styles.viewModeTextActive]}>Day</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'week' && styles.viewModeButtonActive]}
          onPress={() => setViewMode('week')}
        >
          <Text style={[styles.viewModeText, viewMode === 'week' && styles.viewModeTextActive]}>Week</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'month' && styles.viewModeButtonActive]}
          onPress={() => setViewMode('month')}
        >
          <Text style={[styles.viewModeText, viewMode === 'month' && styles.viewModeTextActive]}>Month</Text>
        </TouchableOpacity>
      </View>

      {/* Date Header with Navigation */}
      <View style={styles.dateHeader}>
        <TouchableOpacity onPress={goToPrevious} style={styles.navButton}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#2563eb" />
        </TouchableOpacity>

        <View style={styles.dateInfo}>
          {!isToday() && (
            <TouchableOpacity onPress={goToToday} style={styles.todayButton}>
              <Text style={styles.todayButtonText}>Today</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.dateText}>{formatHeaderDate()}</Text>
        </View>

        <TouchableOpacity onPress={goToNext} style={styles.navButton}>
          <MaterialCommunityIcons name="chevron-right" size={28} color="#2563eb" />
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <MaterialCommunityIcons name="alert-circle" size={20} color="#fff" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2563eb']}
            tintColor="#2563eb"
          />
        }
      >
        {appointments.length > 0 ? (
          appointments.map(renderAppointment)
        ) : (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="calendar-blank"
              size={64}
              color="#ccc"
            />
            <Text style={styles.emptyText}>
              {error ? 'Failed to load appointments' : 'No appointments today'}
            </Text>
            {error && (
              <Text style={styles.emptySubtext}>Pull down to retry</Text>
            )}
          </View>
        )}
      </ScrollView>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => router.push('/appointment/add')}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
  },
  errorBanner: {
    backgroundColor: '#ef4444',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  errorText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  viewModeSwitcher: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    padding: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  viewModeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  viewModeButtonActive: {
    backgroundColor: '#2563eb',
  },
  viewModeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  viewModeTextActive: {
    color: '#fff',
  },
  dateHeader: {
    backgroundColor: '#fff',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  navButton: {
    padding: 4,
  },
  dateInfo: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  todayButton: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  todayButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563eb',
  },
  todayLabel: {
    fontSize: 12,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  dateText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111',
    textAlign: 'center',
  },
  scrollContent: {
    padding: 16,
  },
  appointmentCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  timeColumn: {
    marginRight: 12,
    alignItems: 'flex-end',
    width: 70,
  },
  time: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },
  endTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  dateLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2563eb',
    marginBottom: 4,
    textAlign: 'right',
  },
  colorBar: {
    width: 4,
    borderRadius: 2,
    marginRight: 12,
  },
  detailsColumn: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111',
    flex: 1,
    marginRight: 8,
  },
  typeChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#fff',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  info: {
    fontSize: 13,
    color: '#666',
  },
  additionalJobTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
    backgroundColor: '#fff7ed',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
    alignSelf: 'flex-start',
  },
  additionalJobTypeText: {
    fontSize: 13,
    color: '#ea580c',
    fontWeight: '600',
  },
  loadingDetailsText: {
    fontSize: 12,
    color: '#7c3aed',
    marginLeft: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontSize: 13,
    color: '#2563eb',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#bbb',
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#2563eb',
  },
})
