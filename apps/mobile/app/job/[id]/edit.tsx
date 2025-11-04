import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, Modal, FlatList } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState, useEffect } from 'react'
import { apiClient } from '../../../lib/api-client'
import { MaterialCommunityIcons } from '@expo/vector-icons'

const JOB_TYPE_OPTIONS = [
  { value: 'repair', label: 'Repair' },
  { value: 'installation', label: 'Installation' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'quote', label: 'Quote' },
  { value: 'emergency', label: 'Emergency' },
]

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
  const [jobType, setJobType] = useState('repair')
  const [status, setStatus] = useState('scheduled')
  const [priority, setPriority] = useState('medium')
  const [tradeTypeId, setTradeTypeId] = useState('')
  const [assignedToUserId, setAssignedToUserId] = useState('')
  const [siteAddressLine1, setSiteAddressLine1] = useState('')
  const [siteAddressLine2, setSiteAddressLine2] = useState('')
  const [siteCity, setSiteCity] = useState('')
  const [siteState, setSiteState] = useState('')
  const [sitePostcode, setSitePostcode] = useState('')
  const [siteAccessNotes, setSiteAccessNotes] = useState('')
  const [quotedAmount, setQuotedAmount] = useState('')

  // Trade Types and Team Members
  const [tradeTypes, setTradeTypes] = useState<any[]>([])
  const [teamMembers, setTeamMembers] = useState<any[]>([])

  // Modal states for dropdowns
  const [showTradeTypeModal, setShowTradeTypeModal] = useState(false)
  const [showAssignedToModal, setShowAssignedToModal] = useState(false)

  // Fetch job data
  useEffect(() => {
    fetchJob()
  }, [id])

  const fetchJob = async () => {
    try {
      setLoading(true)

      // Fetch job, trade types, and team members - handle each independently
      const [jobResult, tradeTypesResult, teamMembersResult] = await Promise.allSettled([
        apiClient.getJob(id as string),
        apiClient.getTradeTypes(),
        apiClient.getTeamMembers(),
      ])

      // Check if job fetch failed (critical)
      if (jobResult.status === 'rejected') {
        console.error('Failed to fetch job:', jobResult.reason)
        throw new Error('Failed to load job details')
      }

      const job = jobResult.value.job

      // Handle trade types (non-critical)
      if (tradeTypesResult.status === 'fulfilled') {
        setTradeTypes(tradeTypesResult.value.tradeTypes || [])
      } else {
        console.error('Failed to fetch trade types:', tradeTypesResult.reason)
        setTradeTypes([])
      }

      // Handle team members (non-critical)
      if (teamMembersResult.status === 'fulfilled') {
        setTeamMembers(teamMembersResult.value.members || [])
      } else {
        console.error('Failed to fetch team members:', teamMembersResult.reason)
        setTeamMembers([])
      }

      // Populate form fields
      setTitle(job.title || '')
      setDescription(job.description || '')
      setJobType(job.job_type || 'repair')
      setStatus(job.status || 'scheduled')
      setPriority(job.priority || 'medium')
      setTradeTypeId(job.trade_type_id || '')
      setAssignedToUserId(job.assigned_to_user_id || '')
      setSiteAddressLine1(job.site_address_line1 || '')
      setSiteAddressLine2(job.site_address_line2 || '')
      setSiteCity(job.site_city || '')
      setSiteState(job.site_state || '')
      setSitePostcode(job.site_postcode || '')
      setSiteAccessNotes(job.site_access_notes || '')
      setQuotedAmount(job.quoted_amount ? job.quoted_amount.toString() : '')
    } catch (err: any) {
      console.error('Failed to fetch job:', err)
      Alert.alert('Error', err.message || 'Failed to load job details')
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
        jobType,
        status,
        priority,
        tradeTypeId: tradeTypeId || null,
        assignedToUserId: assignedToUserId || null,
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

        {/* Job Type */}
        <View style={styles.section}>
          <Text style={styles.label}>Job Type</Text>
          <View style={styles.pickerContainer}>
            {JOB_TYPE_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionButton,
                  jobType === option.value && styles.optionButtonActive,
                ]}
                onPress={() => setJobType(option.value)}
              >
                <Text
                  style={[
                    styles.optionText,
                    jobType === option.value && styles.optionTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
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

        {/* Trade Type */}
        <View style={styles.section}>
          <Text style={styles.label}>Trade Type</Text>
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setShowTradeTypeModal(true)}
          >
            <Text style={styles.dropdownButtonText}>
              {tradeTypes.find(t => t.id === tradeTypeId)?.name || 'None'}
            </Text>
            <MaterialCommunityIcons name="chevron-down" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Assigned To */}
        <View style={styles.section}>
          <Text style={styles.label}>Assigned To</Text>
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setShowAssignedToModal(true)}
          >
            <Text style={styles.dropdownButtonText}>
              {teamMembers.find(m => m.user_id === assignedToUserId)?.full_name || 'Unassigned'}
            </Text>
            <MaterialCommunityIcons name="chevron-down" size={24} color="#666" />
          </TouchableOpacity>
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

      {/* Trade Type Modal */}
      <Modal
        visible={showTradeTypeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTradeTypeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Trade Type</Text>
              <TouchableOpacity onPress={() => setShowTradeTypeModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[{ id: '', name: 'None' }, ...tradeTypes]}
              keyExtractor={(item) => item.id || 'none'}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    tradeTypeId === item.id && styles.modalItemSelected
                  ]}
                  onPress={() => {
                    setTradeTypeId(item.id)
                    setShowTradeTypeModal(false)
                  }}
                >
                  <Text style={[
                    styles.modalItemText,
                    tradeTypeId === item.id && styles.modalItemTextSelected
                  ]}>
                    {item.name}
                  </Text>
                  {tradeTypeId === item.id && (
                    <MaterialCommunityIcons name="check" size={20} color="#2563eb" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Assigned To Modal */}
      <Modal
        visible={showAssignedToModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAssignedToModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign To</Text>
              <TouchableOpacity onPress={() => setShowAssignedToModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[{ user_id: '', full_name: 'Unassigned' }, ...teamMembers.filter(m => m.status === 'active')]}
              keyExtractor={(item) => item.user_id || 'unassigned'}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    assignedToUserId === item.user_id && styles.modalItemSelected
                  ]}
                  onPress={() => {
                    setAssignedToUserId(item.user_id)
                    setShowAssignedToModal(false)
                  }}
                >
                  <Text style={[
                    styles.modalItemText,
                    assignedToUserId === item.user_id && styles.modalItemTextSelected
                  ]}>
                    {item.full_name}
                  </Text>
                  {assignedToUserId === item.user_id && (
                    <MaterialCommunityIcons name="check" size={20} color="#2563eb" />
                  )}
                </TouchableOpacity>
              )}
            />
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
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 14,
    minHeight: 50,
  },
  dropdownButtonText: {
    fontSize: 16,
    color: '#111',
    flex: 1,
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
    maxHeight: '70%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalItemSelected: {
    backgroundColor: '#f0f7ff',
  },
  modalItemText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  modalItemTextSelected: {
    color: '#2563eb',
    fontWeight: '600',
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
