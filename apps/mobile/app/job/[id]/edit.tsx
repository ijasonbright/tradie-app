import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState, useEffect } from 'react'
import { apiClient } from '../../../lib/api-client'
import { MaterialCommunityIcons } from '@expo/vector-icons'

const STATUS_OPTIONS = [
  { value: 'quoted', label: 'Quoted' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'invoiced', label: 'Invoiced' },
  { value: 'cancelled', label: 'Cancelled' },
]

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

export default function EditJobScreen() {
  const { id } = useLocalSearchParams()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('scheduled')
  const [priority, setPriority] = useState('medium')
  const [siteAddressLine1, setSiteAddressLine1] = useState('')
  const [siteAddressLine2, setSiteAddressLine2] = useState('')
  const [siteCity, setSiteCity] = useState('')
  const [siteState, setSiteState] = useState('')
  const [sitePostcode, setSitePostcode] = useState('')
  const [siteAccessNotes, setSiteAccessNotes] = useState('')
  const [quotedAmount, setQuotedAmount] = useState('')

  // Fetch job data
  useEffect(() => {
    fetchJob()
  }, [id])

  const fetchJob = async () => {
    try {
      setLoading(true)
      const response = await apiClient.getJob(id as string)
      const job = response.job

      // Populate form fields
      setTitle(job.title || '')
      setDescription(job.description || '')
      setStatus(job.status || 'scheduled')
      setPriority(job.priority || 'medium')
      setSiteAddressLine1(job.site_address_line1 || '')
      setSiteAddressLine2(job.site_address_line2 || '')
      setSiteCity(job.site_city || '')
      setSiteState(job.site_state || '')
      setSitePostcode(job.site_postcode || '')
      setSiteAccessNotes(job.site_access_notes || '')
      setQuotedAmount(job.quoted_amount ? job.quoted_amount.toString() : '')
    } catch (err: any) {
      console.error('Failed to fetch job:', err)
      Alert.alert('Error', 'Failed to load job details')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    // Validation
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Job title is required')
      return
    }

    try {
      setSaving(true)

      const updateData: any = {
        title: title.trim(),
        description: description.trim() || null,
        status,
        priority,
        siteAddressLine1: siteAddressLine1.trim() || null,
        siteAddressLine2: siteAddressLine2.trim() || null,
        siteCity: siteCity.trim() || null,
        siteState: siteState.trim() || null,
        sitePostcode: sitePostcode.trim() || null,
        siteAccessNotes: siteAccessNotes.trim() || null,
        quotedAmount: quotedAmount ? parseFloat(quotedAmount) : null,
      }

      await apiClient.updateJob(id as string, updateData)

      Alert.alert('Success', 'Job updated successfully', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ])
    } catch (err: any) {
      console.error('Failed to update job:', err)
      Alert.alert('Error', err.message || 'Failed to update job')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading job details...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Title */}
        <View style={styles.section}>
          <Text style={styles.label}>Job Title *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Enter job title"
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
            placeholder="Enter job description"
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Status */}
        <View style={styles.section}>
          <Text style={styles.label}>Status</Text>
          <View style={styles.pickerContainer}>
            {STATUS_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionButton,
                  status === option.value && styles.optionButtonActive,
                ]}
                onPress={() => setStatus(option.value)}
              >
                <Text
                  style={[
                    styles.optionText,
                    status === option.value && styles.optionTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Priority */}
        <View style={styles.section}>
          <Text style={styles.label}>Priority</Text>
          <View style={styles.pickerContainer}>
            {PRIORITY_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionButton,
                  priority === option.value && styles.optionButtonActive,
                ]}
                onPress={() => setPriority(option.value)}
              >
                <Text
                  style={[
                    styles.optionText,
                    priority === option.value && styles.optionTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Site Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Site Address</Text>

          <Text style={styles.label}>Address Line 1</Text>
          <TextInput
            style={styles.input}
            value={siteAddressLine1}
            onChangeText={setSiteAddressLine1}
            placeholder="Street address"
            placeholderTextColor="#999"
          />

          <Text style={styles.label}>Address Line 2</Text>
          <TextInput
            style={styles.input}
            value={siteAddressLine2}
            onChangeText={setSiteAddressLine2}
            placeholder="Apt, suite, etc. (optional)"
            placeholderTextColor="#999"
          />

          <View style={styles.row}>
            <View style={styles.halfWidth}>
              <Text style={styles.label}>City</Text>
              <TextInput
                style={styles.input}
                value={siteCity}
                onChangeText={setSiteCity}
                placeholder="City"
                placeholderTextColor="#999"
              />
            </View>
            <View style={styles.halfWidth}>
              <Text style={styles.label}>State</Text>
              <TextInput
                style={styles.input}
                value={siteState}
                onChangeText={setSiteState}
                placeholder="State"
                placeholderTextColor="#999"
              />
            </View>
          </View>

          <Text style={styles.label}>Postcode</Text>
          <TextInput
            style={styles.input}
            value={sitePostcode}
            onChangeText={setSitePostcode}
            placeholder="Postcode"
            placeholderTextColor="#999"
            keyboardType="numeric"
          />
        </View>

        {/* Site Access Notes */}
        <View style={styles.section}>
          <Text style={styles.label}>Site Access Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={siteAccessNotes}
            onChangeText={setSiteAccessNotes}
            placeholder="Gate code, parking instructions, etc."
            placeholderTextColor="#999"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Quoted Amount */}
        <View style={styles.section}>
          <Text style={styles.label}>Quoted Amount</Text>
          <TextInput
            style={styles.input}
            value={quotedAmount}
            onChangeText={setQuotedAmount}
            placeholder="0.00"
            placeholderTextColor="#999"
            keyboardType="decimal-pad"
          />
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
              <MaterialCommunityIcons name="content-save" size={20} color="#fff" />
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 12,
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
    minHeight: 100,
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
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
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
