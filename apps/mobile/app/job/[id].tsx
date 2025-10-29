import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Linking } from 'react-native'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { useState, useEffect } from 'react'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { apiClient } from '../../lib/api-client'

const STATUS_COLORS: Record<string, string> = {
  quoted: '#f59e0b',
  scheduled: '#3b82f6',
  in_progress: '#8b5cf6',
  completed: '#10b981',
  invoiced: '#06b6d4',
  cancelled: '#ef4444',
}

const PRIORITY_COLORS: Record<string, string> = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#ef4444',
  urgent: '#dc2626',
}

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams()
  const router = useRouter()
  const [job, setJob] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchJob = async () => {
    try {
      setError(null)
      const response = await apiClient.getJob(id as string)
      console.log('Fetched job details:', response)
      setJob(response.job)
    } catch (err: any) {
      console.error('Failed to fetch job:', err)
      setError(err.message || 'Failed to load job')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (id) {
      fetchJob()
    }
  }, [id])

  const onRefresh = () => {
    setRefreshing(true)
    fetchJob()
  }

  const handleCall = (phoneNumber: string) => {
    if (phoneNumber) {
      Linking.openURL(`tel:${phoneNumber}`)
    }
  }

  const handleNavigate = (address: string) => {
    if (address) {
      const encodedAddress = encodeURIComponent(address)
      // Try Google Maps first (works on both platforms)
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`)
    }
  }

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Loading...' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading job details...</Text>
        </View>
      </View>
    )
  }

  if (error || !job) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Error' }} />
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle-outline" size={64} color="#ef4444" />
          <Text style={styles.errorTitle}>Failed to Load Job</Text>
          <Text style={styles.errorText}>{error || 'Job not found'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchJob}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  // Build client name
  const clientName = job.is_company
    ? job.company_name
    : `${job.first_name || ''} ${job.last_name || ''}`.trim()

  // Build address
  const address = [
    job.site_address_line1,
    job.site_city,
    job.site_state,
    job.site_postcode
  ].filter(Boolean).join(', ')

  // Format dates
  const scheduledDate = job.scheduled_date
    ? new Date(job.scheduled_date).toLocaleDateString()
    : 'Not scheduled'

  const priority = (job.priority || 'medium') as keyof typeof PRIORITY_COLORS
  const status = (job.status || 'quoted') as keyof typeof STATUS_COLORS

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: job.job_number || 'Job Details',
          headerBackTitle: 'Back'
        }}
      />

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
        {/* Header Card */}
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.jobNumber}>{job.job_number}</Text>
              <Text style={styles.title}>{job.title}</Text>
            </View>
            <View style={styles.badges}>
              <View style={[styles.badge, { backgroundColor: PRIORITY_COLORS[priority] }]}>
                <Text style={styles.badgeText}>{priority.toUpperCase()}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: STATUS_COLORS[status] }]}>
                <Text style={styles.badgeText}>{status.replace('_', ' ').toUpperCase()}</Text>
              </View>
            </View>
          </View>

          {job.description && (
            <Text style={styles.description}>{job.description}</Text>
          )}
        </View>

        {/* Client Info Card */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="account" size={20} color="#2563eb" />
            <Text style={styles.sectionTitle}>Client</Text>
          </View>

          <Text style={styles.clientName}>{clientName}</Text>

          {job.client_email && (
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="email" size={16} color="#666" />
              <Text style={styles.infoText}>{job.client_email}</Text>
            </View>
          )}

          {(job.client_mobile || job.client_phone) && (
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="phone" size={16} color="#666" />
              <Text style={styles.infoText}>{job.client_mobile || job.client_phone}</Text>
            </View>
          )}

          <View style={styles.actionButtons}>
            {(job.client_mobile || job.client_phone) && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleCall(job.client_mobile || job.client_phone)}
              >
                <MaterialCommunityIcons name="phone" size={20} color="#2563eb" />
                <Text style={styles.actionButtonText}>Call</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Location Card */}
        {address && (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="map-marker" size={20} color="#2563eb" />
              <Text style={styles.sectionTitle}>Location</Text>
            </View>

            <Text style={styles.addressText}>{address}</Text>

            {job.site_access_notes && (
              <View style={styles.notesBox}>
                <Text style={styles.notesLabel}>Access Notes:</Text>
                <Text style={styles.notesText}>{job.site_access_notes}</Text>
              </View>
            )}

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleNavigate(address)}
              >
                <MaterialCommunityIcons name="navigation" size={20} color="#2563eb" />
                <Text style={styles.actionButtonText}>Navigate</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Schedule Card */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="calendar" size={20} color="#2563eb" />
            <Text style={styles.sectionTitle}>Schedule</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Scheduled Date:</Text>
            <Text style={styles.value}>{scheduledDate}</Text>
          </View>

          {job.scheduled_start_time && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Start Time:</Text>
              <Text style={styles.value}>{new Date(job.scheduled_start_time).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
          )}

          {job.scheduled_end_time && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>End Time:</Text>
              <Text style={styles.value}>{new Date(job.scheduled_end_time).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
          )}
        </View>

        {/* Pricing Card */}
        {(job.quoted_amount || job.actual_amount) && (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="currency-usd" size={20} color="#2563eb" />
              <Text style={styles.sectionTitle}>Pricing</Text>
            </View>

            {job.quoted_amount && (
              <View style={styles.infoRow}>
                <Text style={styles.label}>Quoted Amount:</Text>
                <Text style={styles.priceText}>${parseFloat(job.quoted_amount).toFixed(2)}</Text>
              </View>
            )}

            {job.actual_amount && (
              <View style={styles.infoRow}>
                <Text style={styles.label}>Actual Amount:</Text>
                <Text style={styles.priceText}>${parseFloat(job.actual_amount).toFixed(2)}</Text>
              </View>
            )}
          </View>
        )}

        {/* Time Logs Section */}
        {job.time_logs && job.time_logs.length > 0 && (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="clock-outline" size={20} color="#2563eb" />
              <Text style={styles.sectionTitle}>Time Logs ({job.time_logs.length})</Text>
            </View>

            {job.time_logs.map((log: any, index: number) => (
              <View key={log.id || index} style={styles.logItem}>
                <View style={styles.logHeader}>
                  <Text style={styles.logUser}>{log.user_name}</Text>
                  <Text style={styles.logHours}>{log.total_hours}h</Text>
                </View>
                <Text style={styles.logDate}>
                  {new Date(log.start_time).toLocaleDateString()} - {log.status}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Materials Section */}
        {job.materials && job.materials.length > 0 && (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="package-variant" size={20} color="#2563eb" />
              <Text style={styles.sectionTitle}>Materials ({job.materials.length})</Text>
            </View>

            {job.materials.map((material: any, index: number) => (
              <View key={material.id || index} style={styles.logItem}>
                <View style={styles.logHeader}>
                  <Text style={styles.materialDesc}>{material.description}</Text>
                  <Text style={styles.materialCost}>${parseFloat(material.total_cost).toFixed(2)}</Text>
                </View>
                <Text style={styles.logDate}>
                  Qty: {material.quantity} - {material.status}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Photos Section */}
        {job.photos && job.photos.length > 0 && (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="camera" size={20} color="#2563eb" />
              <Text style={styles.sectionTitle}>Photos ({job.photos.length})</Text>
            </View>
            <Text style={styles.comingSoonText}>Photo gallery coming soon</Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.bottomActions}>
          <TouchableOpacity style={styles.primaryButton}>
            <MaterialCommunityIcons name="check-circle" size={20} color="#fff" />
            <Text style={styles.primaryButtonText}>Complete Job</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton}>
            <MaterialCommunityIcons name="pencil" size={20} color="#2563eb" />
            <Text style={styles.secondaryButtonText}>Edit Job</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  jobNumber: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111',
  },
  badges: {
    gap: 6,
    alignItems: 'flex-end',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  clientName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
  },
  addressText: {
    fontSize: 14,
    color: '#111',
    lineHeight: 20,
    marginBottom: 12,
  },
  notesBox: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: '#111',
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    flex: 1,
  },
  value: {
    fontSize: 14,
    color: '#111',
  },
  priceText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10b981',
  },
  logItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  logUser: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },
  logHours: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  logDate: {
    fontSize: 12,
    color: '#666',
  },
  materialDesc: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
    flex: 1,
  },
  materialCost: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#10b981',
  },
  comingSoonText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  bottomActions: {
    gap: 12,
    marginTop: 8,
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  secondaryButton: {
    backgroundColor: '#eff6ff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563eb',
  },
})
