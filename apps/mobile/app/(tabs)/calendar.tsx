import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native'
import { FAB } from 'react-native-paper'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useState, useEffect } from 'react'
import { useRouter } from 'expo-router'
import { useAuth } from '../../lib/auth'
import { apiClient } from '../../lib/api-client'

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
}

export default function CalendarScreen() {
  const router = useRouter()
  const { isSignedIn } = useAuth()
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const today = new Date().toLocaleDateString('en-AU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // Fetch today's appointments from API
  const fetchAppointments = async () => {
    try {
      setError(null)
      // Get today's date range (start and end of day)
      const now = new Date()
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

      const response = await apiClient.getAppointments({
        start_date: startOfDay.toISOString(),
        end_date: endOfDay.toISOString()
      })
      console.log('Fetched appointments:', response)
      setAppointments(response.appointments || [])
    } catch (err: any) {
      console.error('Failed to fetch appointments:', err)
      setError(err.message || 'Failed to load appointments')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Load appointments on mount
  useEffect(() => {
    if (isSignedIn) {
      fetchAppointments()
    }
  }, [isSignedIn])

  // Pull to refresh
  const onRefresh = () => {
    setRefreshing(true)
    fetchAppointments()
  }

  const renderAppointment = (appointment: any) => {
    // Format times from database
    const formatTime = (dateStr: string) => {
      if (!dateStr) return ''
      const date = new Date(dateStr)
      return date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
    }

    // Build client name
    const clientName = appointment.is_company
      ? appointment.company_name
      : `${appointment.first_name || ''} ${appointment.last_name || ''}`.trim()

    // Get appointment type
    const appointmentType = appointment.appointment_type || 'job'

    const startTime = formatTime(appointment.start_time)
    const endTime = formatTime(appointment.end_time)

    return (
      <TouchableOpacity key={appointment.id} style={styles.appointmentCard}>
        <View style={styles.timeColumn}>
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
            <Text style={styles.title}>{appointment.title || 'Untitled Appointment'}</Text>
            <View
              style={[
                styles.typeChip,
                { backgroundColor: TYPE_COLORS[appointmentType] || TYPE_COLORS.job },
              ]}
            >
              <Text style={styles.chipText}>
                {appointmentType.replace('_', ' ').toUpperCase()}
              </Text>
            </View>
          </View>

          {clientName && (
            <View style={styles.row}>
              <MaterialCommunityIcons name="account" size={14} color="#666" />
              <Text style={styles.info}>{clientName}</Text>
            </View>
          )}

          {appointment.location_address && (
            <View style={styles.row}>
              <MaterialCommunityIcons name="map-marker" size={14} color="#666" />
              <Text style={styles.info}>{appointment.location_address}</Text>
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionButton}>
              <MaterialCommunityIcons name="phone" size={18} color="#2563eb" />
              <Text style={styles.actionText}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <MaterialCommunityIcons name="navigation" size={18} color="#2563eb" />
              <Text style={styles.actionText}>Navigate</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  // Show loading spinner while fetching appointments
  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <View style={styles.dateHeader}>
          <Text style={styles.todayLabel}>Today</Text>
          <Text style={styles.dateText}>{today}</Text>
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
      <View style={styles.dateHeader}>
        <Text style={styles.todayLabel}>Today</Text>
        <Text style={styles.dateText}>{today}</Text>
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
  dateHeader: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  todayLabel: {
    fontSize: 12,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  dateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111',
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
