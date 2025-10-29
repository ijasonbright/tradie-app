import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native'
import { useRouter } from 'expo-router'
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

export default function AddAppointmentScreen() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [clients, setClients] = useState<any[]>([])
  const [jobs, setJobs] = useState<any[]>([])
  const [organization, setOrganization] = useState<any>(null)
  const [currentUserId, setCurrentUserId] = useState<string>('')

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
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)

      // Get clients and jobs
      const [clientsResponse, jobsResponse] = await Promise.all([
        apiClient.getClients(),
        apiClient.getJobs(),
      ])

      setClients(clientsResponse.clients || [])
      setJobs(jobsResponse.jobs || [])

      // Get organization ID from first job
      if (jobsResponse.jobs && jobsResponse.jobs.length > 0) {
        const orgId = jobsResponse.jobs[0].organization_id
        const orgName = jobsResponse.jobs[0].organization_name
        const userId = jobsResponse.jobs[0].created_by_user_id // Get current user's ID
        setOrganization({ id: orgId, name: orgName })
        setCurrentUserId(userId)
      }
    } catch (err: any) {
      console.error('Failed to fetch data:', err)
      Alert.alert('Error', 'Failed to load data')
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
        organizationId: organization.id,
        title: title.trim(),
        description: description.trim() || null,
        appointmentType,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        allDay: false,
        clientId: clientId || null,
        jobId: jobId || null,
        assignedToUserId: currentUserId, // Assign to current user
        locationAddress: locationAddress.trim() || null,
      }

      await apiClient.createAppointment(appointmentData)

      Alert.alert('Success', 'Appointment created successfully', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ])
    } catch (err: any) {
      console.error('Failed to create appointment:', err)
      Alert.alert('Error', err.message || 'Failed to create appointment')
    } finally {
      setSaving(false)
    }
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
              <Text style={styles.saveButtonText}>Create Appointment</Text>
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
