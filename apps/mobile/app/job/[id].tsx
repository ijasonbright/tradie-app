import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Linking, Alert, Modal, Platform } from 'react-native'
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router'
import { useState, useEffect } from 'react'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { apiClient } from '../../lib/api-client'
import DateTimePicker from '@react-native-community/datetimepicker'

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
  const navigation = useNavigation()
  const [job, setJob] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completing, setCompleting] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [scheduledDate, setScheduledDate] = useState(new Date())
  const [scheduledStartTime, setScheduledStartTime] = useState(new Date())
  const [scheduledEndTime, setScheduledEndTime] = useState(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showStartTimePicker, setShowStartTimePicker] = useState(false)
  const [showEndTimePicker, setShowEndTimePicker] = useState(false)
  const [saving, setSaving] = useState(false)

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

  // Set the header title when job is loaded
  useEffect(() => {
    if (job) {
      navigation.setOptions({
        title: job.job_number || 'Job Details',
      })
    }
  }, [job, navigation])

  // Initialize schedule date/time when modal opens with existing job data
  useEffect(() => {
    if (showScheduleModal && job) {
      if (job.scheduled_date) {
        setScheduledDate(new Date(job.scheduled_date))
      } else {
        setScheduledDate(new Date())
      }

      if (job.scheduled_start_time) {
        const timeDate = new Date(job.scheduled_start_time)
        setScheduledStartTime(timeDate)
      } else {
        // Default to 9 AM
        const defaultTime = new Date()
        defaultTime.setHours(9, 0, 0, 0)
        setScheduledStartTime(defaultTime)
      }

      if (job.scheduled_end_time) {
        const endTimeDate = new Date(job.scheduled_end_time)
        setScheduledEndTime(endTimeDate)
      } else {
        // Default to 2 hours after start (11 AM if start is 9 AM)
        const defaultEndTime = new Date()
        defaultEndTime.setHours(11, 0, 0, 0)
        setScheduledEndTime(defaultEndTime)
      }
    }
  }, [showScheduleModal, job])

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

  const handleSendInvoice = async () => {
    try {
      // Check if client has email
      if (!job.client_email) {
        Alert.alert('No Email Address', 'This client does not have an email address. Please add one before sending an invoice.')
        return
      }

      Alert.alert(
        'Send Invoice',
        `Send invoice to ${job.client_email}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Send',
            onPress: async () => {
              try {
                // First check if invoice already exists for this job
                const invoicesResponse = await apiClient.getInvoices({ jobId: id as string })

                let invoiceId: string

                if (invoicesResponse.invoices && invoicesResponse.invoices.length > 0) {
                  // Use existing invoice
                  invoiceId = invoicesResponse.invoices[0].id
                } else {
                  // Create new invoice from job
                  const invoiceData = {
                    job_id: id,
                    client_id: job.client_id,
                    organization_id: job.organization_id,
                    subtotal: parseFloat(job.quoted_amount || job.actual_amount || '0'),
                    gst_amount: parseFloat(job.quoted_amount || job.actual_amount || '0') * 0.1,
                    total_amount: parseFloat(job.quoted_amount || job.actual_amount || '0') * 1.1,
                    issue_date: new Date().toISOString().split('T')[0],
                    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    status: 'draft',
                    notes: job.description || null,
                  }

                  const createResponse = await apiClient.createInvoice(invoiceData)
                  invoiceId = createResponse.invoice.id
                }

                // Send the invoice
                await apiClient.sendInvoice(invoiceId)

                Alert.alert('Success', `Invoice sent to ${job.client_email}`)
                fetchJob() // Refresh job data
              } catch (err: any) {
                console.error('Failed to send invoice:', err)
                Alert.alert('Error', err.message || 'Failed to send invoice')
              }
            }
          }
        ]
      )
    } catch (err: any) {
      console.error('Failed to prepare invoice:', err)
      Alert.alert('Error', 'Failed to prepare invoice')
    }
  }

  const handleSendQuote = async () => {
    try {
      // Check if client has email
      if (!job.client_email) {
        Alert.alert('No Email Address', 'This client does not have an email address. Please add one before sending a quote.')
        return
      }

      Alert.alert(
        'Send Quote',
        `Send quote to ${job.client_email}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Send',
            onPress: async () => {
              try {
                // First check if quote already exists for this job
                const quotesResponse = await apiClient.getQuotes({ clientId: job.client_id })
                const existingQuote = quotesResponse.quotes?.find((q: any) => q.title === job.title)

                let quoteId: string

                if (existingQuote) {
                  // Use existing quote
                  quoteId = existingQuote.id
                } else {
                  // Create new quote from job
                  const quoteData = {
                    client_id: job.client_id,
                    organization_id: job.organization_id,
                    title: job.title,
                    description: job.description || null,
                    subtotal: parseFloat(job.quoted_amount || '0'),
                    gst_amount: parseFloat(job.quoted_amount || '0') * 0.1,
                    total_amount: parseFloat(job.quoted_amount || '0') * 1.1,
                    valid_until_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    status: 'draft',
                  }

                  const createResponse = await apiClient.createQuote(quoteData)
                  quoteId = createResponse.quote.id
                }

                // Send the quote
                await apiClient.sendQuote(quoteId)

                Alert.alert('Success', `Quote sent to ${job.client_email}`)
                fetchJob() // Refresh job data
              } catch (err: any) {
                console.error('Failed to send quote:', err)
                Alert.alert('Error', err.message || 'Failed to send quote')
              }
            }
          }
        ]
      )
    } catch (err: any) {
      console.error('Failed to prepare quote:', err)
      Alert.alert('Error', 'Failed to prepare quote')
    }
  }

  const handleCompleteJob = () => {
    // Check if job is already completed
    if (job.status === 'completed') {
      Alert.alert('Job Already Completed', 'This job has already been marked as completed.')
      return
    }

    // Show confirmation dialog
    Alert.alert(
      'Complete Job',
      'Are you sure you want to mark this job as completed? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Complete',
          style: 'default',
          onPress: async () => {
            setCompleting(true)
            try {
              const response = await apiClient.completeJob(id as string)

              // Show success message with any warnings
              let message = response.message
              if (response.warnings && response.warnings.length > 0) {
                message += '\n\nWarnings:\n' + response.warnings.join('\n')
              }

              Alert.alert('Success', message, [
                {
                  text: 'OK',
                  onPress: () => {
                    // Refresh the job data
                    fetchJob()
                  }
                }
              ])
            } catch (err: any) {
              console.error('Failed to complete job:', err)
              Alert.alert('Error', err.message || 'Failed to complete job. Please try again.')
            } finally {
              setCompleting(false)
            }
          },
        },
      ]
    )
  }

  const handleSchedule = async () => {
    try {
      setSaving(true)

      // Validate end time is after start time
      if (scheduledEndTime <= scheduledStartTime) {
        Alert.alert('Invalid Time', 'End time must be after start time')
        setSaving(false)
        return
      }

      // Format date in local timezone (YYYY-MM-DD)
      const year = scheduledDate.getFullYear()
      const month = String(scheduledDate.getMonth() + 1).padStart(2, '0')
      const day = String(scheduledDate.getDate()).padStart(2, '0')
      const dateString = `${year}-${month}-${day}`

      // Combine date and times (keep in local timezone)
      const scheduledDateTime = new Date(scheduledDate)
      scheduledDateTime.setHours(scheduledStartTime.getHours())
      scheduledDateTime.setMinutes(scheduledStartTime.getMinutes())
      scheduledDateTime.setSeconds(0)

      const scheduledEndDateTime = new Date(scheduledDate)
      scheduledEndDateTime.setHours(scheduledEndTime.getHours())
      scheduledEndDateTime.setMinutes(scheduledEndTime.getMinutes())
      scheduledEndDateTime.setSeconds(0)

      // Update the job with scheduled times
      await apiClient.updateJob(id as string, {
        scheduled_date: dateString,
        scheduled_start_time: scheduledDateTime.toISOString(),
        scheduled_end_time: scheduledEndDateTime.toISOString(),
      })

      // Build location address
      const locationAddress = [
        job.site_address_line1,
        job.site_address_line2,
        job.site_city,
        job.site_state,
        job.site_postcode
      ].filter(Boolean).join(', ')

      // Check if an appointment already exists for this job
      // Fetch all appointments and filter for this specific job
      const existingAppointments = await apiClient.getAppointments({})

      // Find if there's already an appointment for this job
      // (real appointment entry, not the UNION query result which is read-only)
      const existingAppointment = existingAppointments.appointments?.find(
        (apt: any) => apt.job_id === job.id && apt.id !== job.id
      )

      const appointmentData = {
        title: job.title,
        description: job.description,
        appointment_type: 'job',
        start_time: scheduledDateTime.toISOString(),
        end_time: scheduledEndDateTime.toISOString(),
        all_day: false,
        location_address: locationAddress || null,
      }

      if (existingAppointment) {
        // Update existing appointment
        await apiClient.updateAppointment(existingAppointment.id, appointmentData)
      } else {
        // Create new appointment
        await apiClient.createAppointment({
          ...appointmentData,
          organization_id: job.organization_id,
          job_id: job.id,
          client_id: job.client_id,
          assigned_to_user_id: job.assigned_to_user_id,
        })
      }

      setShowScheduleModal(false)
      await fetchJob()
      Alert.alert('Success', 'Job scheduled successfully')
    } catch (err: any) {
      console.error('Failed to schedule job:', err)
      Alert.alert('Error', err.message || 'Failed to schedule job')
    } finally {
      setSaving(false)
    }
  }

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false)
    if (selectedDate) {
      setScheduledDate(selectedDate)
    }
  }

  const onStartTimeChange = (event: any, selectedTime?: Date) => {
    setShowStartTimePicker(false)
    if (selectedTime) {
      setScheduledStartTime(selectedTime)
      // Auto-adjust end time to be 2 hours later
      const newEndTime = new Date(selectedTime)
      newEndTime.setHours(newEndTime.getHours() + 2)
      setScheduledEndTime(newEndTime)
    }
  }

  const onEndTimeChange = (event: any, selectedTime?: Date) => {
    setShowEndTimePicker(false)
    if (selectedTime) {
      setScheduledEndTime(selectedTime)
    }
  }

  // Calculate duration in hours and minutes
  const calculateDuration = () => {
    const diffMs = scheduledEndTime.getTime() - scheduledStartTime.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const hours = Math.floor(diffMins / 60)
    const mins = diffMins % 60
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  }

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
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
  const scheduledDateDisplay = job.scheduled_date
    ? new Date(job.scheduled_date).toLocaleDateString()
    : 'Not scheduled'

  const priority = (job.priority || 'medium') as keyof typeof PRIORITY_COLORS
  const status = (job.status || 'quoted') as keyof typeof STATUS_COLORS

  return (
    <View style={styles.container}>
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
            <Text style={styles.value}>{scheduledDateDisplay}</Text>
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

          {job.scheduled_start_time && job.scheduled_end_time && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Duration:</Text>
              <Text style={styles.value}>
                {(() => {
                  const start = new Date(job.scheduled_start_time)
                  const end = new Date(job.scheduled_end_time)
                  const diffMs = end.getTime() - start.getTime()
                  const diffMins = Math.floor(diffMs / 60000)
                  const hours = Math.floor(diffMins / 60)
                  const mins = diffMins % 60
                  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
                })()}
              </Text>
            </View>
          )}

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setShowScheduleModal(true)}
            >
              <MaterialCommunityIcons name="calendar-clock" size={20} color="#2563eb" />
              <Text style={styles.actionButtonText}>
                {job.scheduled_date ? 'Reschedule' : 'Schedule'}
              </Text>
            </TouchableOpacity>
          </View>
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

        {/* Quick Actions */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="lightning-bolt" size={20} color="#2563eb" />
            <Text style={styles.sectionTitle}>Quick Actions</Text>
          </View>

          <View style={styles.quickActionsGrid}>
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => router.push(`/job/${id}/time`)}
            >
              <MaterialCommunityIcons name="clock-outline" size={32} color="#2563eb" />
              <Text style={styles.quickActionLabel}>Time</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => router.push(`/job/${id}/materials`)}
            >
              <MaterialCommunityIcons name="package-variant" size={32} color="#2563eb" />
              <Text style={styles.quickActionLabel}>Materials</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => router.push(`/job/${id}/photos`)}
            >
              <MaterialCommunityIcons name="camera" size={32} color="#2563eb" />
              <Text style={styles.quickActionLabel}>Photos</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => router.push(`/job/${id}/notes`)}
            >
              <MaterialCommunityIcons name="note-text" size={32} color="#2563eb" />
              <Text style={styles.quickActionLabel}>Notes</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => router.push(`/job/${id}/completion-form-preview`)}
            >
              <MaterialCommunityIcons name="file-document-check" size={32} color="#2563eb" />
              <Text style={styles.quickActionLabel}>Completion Form</Text>
            </TouchableOpacity>
          </View>
        </View>

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
          {job.status !== 'completed' && (
            <TouchableOpacity
              style={[styles.primaryButton, completing && styles.disabledButton]}
              onPress={handleCompleteJob}
              disabled={completing}
            >
              {completing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons name="check-circle" size={20} color="#fff" />
                  <Text style={styles.primaryButtonText}>Complete Job</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {job.status === 'completed' && (
            <View style={styles.completedBanner}>
              <MaterialCommunityIcons name="check-circle" size={24} color="#10b981" />
              <Text style={styles.completedText}>Job Completed</Text>
              {job.completed_at && (
                <Text style={styles.completedDate}>
                  {new Date(job.completed_at).toLocaleDateString()}
                </Text>
              )}
            </View>
          )}

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push(`/job/${id}/edit`)}
          >
            <MaterialCommunityIcons name="pencil" size={20} color="#2563eb" />
            <Text style={styles.secondaryButtonText}>Edit Job</Text>
          </TouchableOpacity>

          <View style={styles.actionsRow}>
            {address && (
              <TouchableOpacity
                style={styles.actionButtonWide}
                onPress={() => handleNavigate(address)}
              >
                <MaterialCommunityIcons name="navigation" size={20} color="#2563eb" />
                <Text style={styles.actionButtonWideText}>Navigate</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.actionButtonWide}
              onPress={handleSendInvoice}
            >
              <MaterialCommunityIcons name="file-document" size={20} color="#2563eb" />
              <Text style={styles.actionButtonWideText}>Send Invoice</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButtonWide}
              onPress={handleSendQuote}
            >
              <MaterialCommunityIcons name="file-document-outline" size={20} color="#2563eb" />
              <Text style={styles.actionButtonWideText}>Send Quote</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Schedule Modal */}
      <Modal
        visible={showScheduleModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowScheduleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Schedule Job</Text>
              <TouchableOpacity onPress={() => setShowScheduleModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.label}>Scheduled Date</Text>
              <TouchableOpacity
                style={styles.dateTimeButton}
                onPress={() => setShowDatePicker(true)}
              >
                <MaterialCommunityIcons name="calendar" size={20} color="#2563eb" />
                <Text style={styles.dateTimeButtonText}>
                  {scheduledDate.toLocaleDateString('en-AU', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={scheduledDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onDateChange}
                  minimumDate={new Date()}
                />
              )}

              <Text style={styles.label}>Start Time</Text>
              <TouchableOpacity
                style={styles.dateTimeButton}
                onPress={() => setShowStartTimePicker(true)}
              >
                <MaterialCommunityIcons name="clock-outline" size={20} color="#2563eb" />
                <Text style={styles.dateTimeButtonText}>
                  {scheduledStartTime.toLocaleTimeString('en-AU', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </TouchableOpacity>

              {showStartTimePicker && (
                <DateTimePicker
                  value={scheduledStartTime}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onStartTimeChange}
                />
              )}

              <Text style={styles.label}>End Time</Text>
              <TouchableOpacity
                style={styles.dateTimeButton}
                onPress={() => setShowEndTimePicker(true)}
              >
                <MaterialCommunityIcons name="clock-outline" size={20} color="#2563eb" />
                <Text style={styles.dateTimeButtonText}>
                  {scheduledEndTime.toLocaleTimeString('en-AU', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </TouchableOpacity>

              {showEndTimePicker && (
                <DateTimePicker
                  value={scheduledEndTime}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onEndTimeChange}
                />
              )}

              <View style={styles.durationInfo}>
                <MaterialCommunityIcons name="timer-outline" size={20} color="#666" />
                <Text style={styles.durationText}>Duration: {calculateDuration()}</Text>
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowScheduleModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSchedule}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Schedule</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingBottom: 120,
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
  disabledButton: {
    opacity: 0.6,
  },
  completedBanner: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
  },
  completedText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
  },
  completedDate: {
    fontSize: 12,
    color: '#059669',
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
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  actionButtonWide: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: '#eff6ff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  actionButtonWideText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  quickActionCard: {
    width: '47%',
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 12,
    gap: 8,
  },
  quickActionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
  },
  modalBody: {
    padding: 16,
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  dateTimeButtonText: {
    fontSize: 16,
    color: '#111',
    fontWeight: '500',
  },
  durationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  durationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
})
