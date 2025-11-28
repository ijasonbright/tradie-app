import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useState, useEffect } from 'react'
import { apiClient } from '../../lib/api-client'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import DateTimePicker from '@react-native-community/datetimepicker'

const APPOINTMENT_TYPE_OPTIONS = [
  { value: 'job', label: 'Job' },
  { value: 'quote', label: 'Quote' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'site_visit', label: 'Site Visit' },
  { value: 'admin', label: 'Admin' },
]

export default function EditAppointmentScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [clients, setClients] = useState<any[]>([])
  const [jobs, setJobs] = useState<any[]>([])
  const [organization, setOrganization] = useState<any>(null)
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [appointment, setAppointment] = useState<any>(null)

  // Form fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [appointmentType, setAppointmentType] = useState('job')
  const [clientId, setClientId] = useState('')
  const [jobId, setJobId] = useState('')
  const [locationAddress, setLocationAddress] = useState('')

  // Date/Time fields
  const [startDate, setStartDate] = useState(new Date())
  const [endDate, setEndDate] = useState(new Date(Date.now() + 60 * 60 * 1000)) // 1 hour later
  const [showStartDatePicker, setShowStartDatePicker] = useState(false)
  const [showStartTimePicker, setShowStartTimePicker] = useState(false)
  const [showEndDatePicker, setShowEndDatePicker] = useState(false)
  const [showEndTimePicker, setShowEndTimePicker] = useState(false)

  useEffect(() => {
    fetchData()
  }, [id])

  const fetchData = async () => {
    try {
      setLoading(true)

      // Get appointment, clients, and jobs
      const [appointmentResponse, clientsResponse, jobsResponse] = await Promise.all([
        apiClient.getAppointment(id as string),
        apiClient.getClients(),
        apiClient.getJobs(),
      ])

      setClients(clientsResponse.clients || [])
      setJobs(jobsResponse.jobs || [])

      // Get organization ID from first job
      if (jobsResponse.jobs && jobsResponse.jobs.length > 0) {
        const orgId = jobsResponse.jobs[0].organization_id
        const orgName = jobsResponse.jobs[0].organization_name
        const userId = jobsResponse.jobs[0].created_by_user_id
        setOrganization({ id: orgId, name: orgName })
        setCurrentUserId(userId)
      }

      // Populate form with appointment data
      const appt = appointmentResponse.appointment
      if (!appt) {
        Alert.alert('Error', 'Appointment not found')
        router.back()
        return
      }
      setAppointment(appt)
      setTitle(appt.title || '')
      setDescription(appt.description || '')
      setAppointmentType(appt.appointment_type || 'job')
      setClientId(appt.client_id || '')
      setJobId(appt.job_id || '')
      setLocationAddress(appt.location_address || '')

      // Safely parse dates with fallback to current time
      const parsedStartDate = appt.start_time ? new Date(appt.start_time) : new Date()
      const parsedEndDate = appt.end_time ? new Date(appt.end_time) : new Date(Date.now() + 60 * 60 * 1000)

      // Validate that dates are valid before setting
      setStartDate(isNaN(parsedStartDate.getTime()) ? new Date() : parsedStartDate)
      setEndDate(isNaN(parsedEndDate.getTime()) ? new Date(Date.now() + 60 * 60 * 1000) : parsedEndDate)
    } catch (err: any) {
      console.error('Failed to fetch data:', err)
      Alert.alert('Error', 'Failed to load appointment data')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    // Validation
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Title is required')
      return
    }

    if (!organization || !currentUserId) {
      Alert.alert('Error', 'No organization found')
      return
    }

    if (endDate <= startDate) {
      Alert.alert('Validation Error', 'End time must be after start time')
      return
    }

    try {
      setSaving(true)

      const appointmentData: any = {
        title: title.trim(),
        description: description.trim() || null,
        appointment_type: appointmentType,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        all_day: false,
        client_id: clientId || null,
        job_id: jobId || null,
        assigned_to_user_id: currentUserId,
        location_address: locationAddress.trim() || null,
      }

      await apiClient.updateAppointment(id as string, appointmentData)

      Alert.alert('Success', 'Appointment updated successfully', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ])
    } catch (err: any) {
      console.error('Failed to update appointment:', err)
      Alert.alert('Error', err.message || 'Failed to update appointment')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = () => {
    Alert.alert(
      'Delete Appointment',
      'Are you sure you want to delete this appointment? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(true)
              await apiClient.deleteAppointment(id as string)
              Alert.alert('Success', 'Appointment deleted successfully', [
                {
                  text: 'OK',
                  onPress: () => router.back(),
                },
              ])
            } catch (err: any) {
              console.error('Failed to delete appointment:', err)
              Alert.alert('Error', err.message || 'Failed to delete appointment')
            } finally {
              setDeleting(false)
            }
          },
        },
      ]
    )
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-AU', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Title */}
        <View style={styles.section}>
          <Text style={styles.label}>Title *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g., Site visit with John"
            placeholderTextColor="#999"
          />
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Enter appointment details..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Appointment Type */}
        <View style={styles.section}>
          <Text style={styles.label}>Type</Text>
          <View style={styles.pickerContainer}>
            {APPOINTMENT_TYPE_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionButton,
                  appointmentType === option.value && styles.optionButtonActive,
                ]}
                onPress={() => setAppointmentType(option.value)}
              >
                <Text
                  style={[
                    styles.optionText,
                    appointmentType === option.value && styles.optionTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Start Date & Time */}
        <View style={styles.section}>
          <Text style={styles.label}>Start Date & Time *</Text>
          <View style={styles.dateTimeRow}>
            <TouchableOpacity
              style={[styles.input, styles.dateTimeButton]}
              onPress={() => setShowStartDatePicker(true)}
            >
              <MaterialCommunityIcons name="calendar" size={20} color="#666" />
              <Text style={styles.dateTimeText}>{formatDate(startDate)}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.input, styles.dateTimeButton]}
              onPress={() => setShowStartTimePicker(true)}
            >
              <MaterialCommunityIcons name="clock-outline" size={20} color="#666" />
              <Text style={styles.dateTimeText}>{formatTime(startDate)}</Text>
            </TouchableOpacity>
          </View>

          {showStartDatePicker && (
            <DateTimePicker
              value={startDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, selectedDate) => {
                setShowStartDatePicker(Platform.OS === 'ios')
                if (selectedDate) {
                  setStartDate(selectedDate)
                }
              }}
            />
          )}

          {showStartTimePicker && (
            <DateTimePicker
              value={startDate}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, selectedDate) => {
                setShowStartTimePicker(Platform.OS === 'ios')
                if (selectedDate) {
                  setStartDate(selectedDate)
                }
              }}
            />
          )}
        </View>

        {/* End Date & Time */}
        <View style={styles.section}>
          <Text style={styles.label}>End Date & Time *</Text>
          <View style={styles.dateTimeRow}>
            <TouchableOpacity
              style={[styles.input, styles.dateTimeButton]}
              onPress={() => setShowEndDatePicker(true)}
            >
              <MaterialCommunityIcons name="calendar" size={20} color="#666" />
              <Text style={styles.dateTimeText}>{formatDate(endDate)}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.input, styles.dateTimeButton]}
              onPress={() => setShowEndTimePicker(true)}
            >
              <MaterialCommunityIcons name="clock-outline" size={20} color="#666" />
              <Text style={styles.dateTimeText}>{formatTime(endDate)}</Text>
            </TouchableOpacity>
          </View>

          {showEndDatePicker && (
            <DateTimePicker
              value={endDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, selectedDate) => {
                setShowEndDatePicker(Platform.OS === 'ios')
                if (selectedDate) {
                  setEndDate(selectedDate)
                }
              }}
            />
          )}

          {showEndTimePicker && (
            <DateTimePicker
              value={endDate}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, selectedDate) => {
                setShowEndTimePicker(Platform.OS === 'ios')
                if (selectedDate) {
                  setEndDate(selectedDate)
                }
              }}
            />
          )}
        </View>

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.label}>Location</Text>
          <TextInput
            style={styles.input}
            value={locationAddress}
            onChangeText={setLocationAddress}
            placeholder="Enter location address"
            placeholderTextColor="#999"
          />
        </View>

        {/* Optional: Link to Client */}
        {clients.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.label}>Link to Client (Optional)</Text>
            <View style={styles.clientList}>
              <TouchableOpacity
                style={[
                  styles.clientOption,
                  clientId === '' && styles.clientOptionActive,
                ]}
                onPress={() => setClientId('')}
              >
                <Text
                  style={[
                    styles.clientOptionText,
                    clientId === '' && styles.clientOptionTextActive,
                  ]}
                >
                  No Client
                </Text>
              </TouchableOpacity>
              {clients.slice(0, 5).map((client) => {
                const clientName = client.is_company
                  ? client.company_name
                  : `${client.first_name} ${client.last_name}`

                return (
                  <TouchableOpacity
                    key={client.id}
                    style={[
                      styles.clientOption,
                      clientId === client.id && styles.clientOptionActive,
                    ]}
                    onPress={() => setClientId(client.id)}
                  >
                    <Text
                      style={[
                        styles.clientOptionText,
                        clientId === client.id && styles.clientOptionTextActive,
                      ]}
                    >
                      {clientName}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>
        )}

        {/* Optional: Link to Job */}
        {jobs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.label}>Link to Job (Optional)</Text>
            <View style={styles.clientList}>
              <TouchableOpacity
                style={[
                  styles.clientOption,
                  jobId === '' && styles.clientOptionActive,
                ]}
                onPress={() => setJobId('')}
              >
                <Text
                  style={[
                    styles.clientOptionText,
                    jobId === '' && styles.clientOptionTextActive,
                  ]}
                >
                  No Job
                </Text>
              </TouchableOpacity>
              {jobs.slice(0, 5).map((job) => (
                <TouchableOpacity
                  key={job.id}
                  style={[
                    styles.clientOption,
                    jobId === job.id && styles.clientOptionActive,
                  ]}
                  onPress={() => setJobId(job.id)}
                >
                  <Text
                    style={[
                      styles.clientOptionText,
                      jobId === job.id && styles.clientOptionTextActive,
                    ]}
                  >
                    {job.job_number} - {job.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Delete Button */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDelete}
            disabled={deleting}
          >
            {deleting ? (
              <ActivityIndicator color="#ef4444" />
            ) : (
              <>
                <MaterialCommunityIcons name="delete" size={20} color="#ef4444" />
                <Text style={styles.deleteButtonText}>Delete Appointment</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Save Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialCommunityIcons name="check" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111',
  },
  textArea: {
    minHeight: 80,
    paddingTop: 12,
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  optionButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  optionText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  optionTextActive: {
    color: '#fff',
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateTimeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateTimeText: {
    fontSize: 16,
    color: '#111',
  },
  clientList: {
    gap: 8,
  },
  clientOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  clientOptionActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  clientOptionText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  clientOptionTextActive: {
    color: '#fff',
  },
  deleteButton: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
    gap: 8,
  },
  deleteButtonText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
    padding: 16,
  },
  saveButton: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
})
