import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, Modal } from 'react-native'
import { useRouter } from 'expo-router'
import { useState, useEffect } from 'react'
import { apiClient } from '../../lib/api-client'
import { MaterialCommunityIcons } from '@expo/vector-icons'

const JOB_TYPE_OPTIONS = [
  { value: 'repair', label: 'Repair' },
  { value: 'installation', label: 'Installation' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'quote', label: 'Quote' },
  { value: 'emergency', label: 'Emergency' },
]

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

export default function AddJobScreen() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [clients, setClients] = useState<any[]>([])
  const [organization, setOrganization] = useState<any>(null)

  // Modal for creating new client
  const [showClientModal, setShowClientModal] = useState(false)
  const [creatingClient, setCreatingClient] = useState(false)

  // New client form fields
  const [newClientIsCompany, setNewClientIsCompany] = useState(false)
  const [newClientCompanyName, setNewClientCompanyName] = useState('')
  const [newClientFirstName, setNewClientFirstName] = useState('')
  const [newClientLastName, setNewClientLastName] = useState('')
  const [newClientEmail, setNewClientEmail] = useState('')
  const [newClientPhone, setNewClientPhone] = useState('')
  const [newClientMobile, setNewClientMobile] = useState('')

  // Job form fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [clientId, setClientId] = useState('')
  const [jobType, setJobType] = useState('repair')
  const [priority, setPriority] = useState('medium')
  const [siteAddressLine1, setSiteAddressLine1] = useState('')
  const [siteAddressLine2, setSiteAddressLine2] = useState('')
  const [siteCity, setSiteCity] = useState('')
  const [siteState, setSiteState] = useState('')
  const [sitePostcode, setSitePostcode] = useState('')
  const [siteAccessNotes, setSiteAccessNotes] = useState('')
  const [quotedAmount, setQuotedAmount] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)

      // Get clients
      const clientsResponse = await apiClient.getClients()
      setClients(clientsResponse.clients || [])

      // Get organization ID from first job (workaround until organizations endpoint is fixed)
      const jobsResponse = await apiClient.getJobs()
      if (jobsResponse.jobs && jobsResponse.jobs.length > 0) {
        // Extract organization ID from first job
        const orgId = jobsResponse.jobs[0].organization_id
        const orgName = jobsResponse.jobs[0].organization_name
        setOrganization({ id: orgId, name: orgName })
      } else {
        // If no jobs exist, try organizations endpoint as fallback
        try {
          const orgsResponse = await apiClient.getOrganizations()
          if (orgsResponse.organizations && orgsResponse.organizations.length > 0) {
            setOrganization(orgsResponse.organizations[0])
          }
        } catch (orgError) {
          console.log('Organizations endpoint not available, user needs to create a job from web first')
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch data:', err)
      Alert.alert('Error', 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateClient = async () => {
    // Validation
    if (newClientIsCompany && !newClientCompanyName.trim()) {
      Alert.alert('Validation Error', 'Company name is required')
      return
    }

    if (!newClientIsCompany && (!newClientFirstName.trim() || !newClientLastName.trim())) {
      Alert.alert('Validation Error', 'First name and last name are required')
      return
    }

    if (!organization) {
      Alert.alert('Error', 'No organization found')
      return
    }

    try {
      setCreatingClient(true)

      const clientData: any = {
        organizationId: organization.id,
        clientType: 'residential',
        isCompany: newClientIsCompany,
        companyName: newClientIsCompany ? newClientCompanyName.trim() : null,
        firstName: !newClientIsCompany ? newClientFirstName.trim() : null,
        lastName: !newClientIsCompany ? newClientLastName.trim() : null,
        email: newClientEmail.trim() || null,
        phone: newClientPhone.trim() || null,
        mobile: newClientMobile.trim() || null,
      }

      const response = await apiClient.createClient(clientData)

      // Add new client to the list and select it
      const newClient = response.client
      setClients([newClient, ...clients])
      setClientId(newClient.id)

      // Reset form and close modal
      setNewClientIsCompany(false)
      setNewClientCompanyName('')
      setNewClientFirstName('')
      setNewClientLastName('')
      setNewClientEmail('')
      setNewClientPhone('')
      setNewClientMobile('')
      setShowClientModal(false)

      Alert.alert('Success', 'Client created successfully')
    } catch (err: any) {
      console.error('Failed to create client:', err)
      Alert.alert('Error', err.message || 'Failed to create client')
    } finally {
      setCreatingClient(false)
    }
  }

  const handleSave = async () => {
    // Validation
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Job title is required')
      return
    }

    if (!clientId) {
      Alert.alert('Validation Error', 'Please select a client')
      return
    }

    if (!organization) {
      Alert.alert('Error', 'No organization found')
      return
    }

    try {
      setSaving(true)

      const jobData: any = {
        organizationId: organization.id,
        clientId,
        title: title.trim(),
        description: description.trim() || null,
        jobType,
        priority,
        status: 'scheduled',
        siteAddressLine1: siteAddressLine1.trim() || null,
        siteAddressLine2: siteAddressLine2.trim() || null,
        siteCity: siteCity.trim() || null,
        siteState: siteState.trim() || null,
        sitePostcode: sitePostcode.trim() || null,
        siteAccessNotes: siteAccessNotes.trim() || null,
        quotedAmount: quotedAmount ? parseFloat(quotedAmount) : null,
      }

      await apiClient.createJob(jobData)

      Alert.alert('Success', 'Job created successfully', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ])
    } catch (err: any) {
      console.error('Failed to create job:', err)
      Alert.alert('Error', err.message || 'Failed to create job')
    } finally {
      setSaving(false)
    }
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
        {/* Client Selection */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.label}>Client *</Text>
            <TouchableOpacity
              style={styles.addClientButton}
              onPress={() => setShowClientModal(true)}
            >
              <MaterialCommunityIcons name="plus-circle" size={20} color="#2563eb" />
              <Text style={styles.addClientText}>New Client</Text>
            </TouchableOpacity>
          </View>

          {clients.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No clients yet. Create your first client above.</Text>
            </View>
          ) : (
            <View style={styles.clientList}>
              {clients.map((client) => {
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
          )}
        </View>

        {/* Title */}
        <View style={styles.section}>
          <Text style={styles.label}>Job Title *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g., Fix leaking tap"
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
            placeholder="Enter job details..."
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
              <MaterialCommunityIcons name="check" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Create Job</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* New Client Modal */}
      <Modal
        visible={showClientModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowClientModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowClientModal(false)}>
              <MaterialCommunityIcons name="close" size={24} color="#111" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Client</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalScrollContent}>
            {/* Client Type Toggle */}
            <View style={styles.section}>
              <Text style={styles.label}>Client Type</Text>
              <View style={styles.toggleContainer}>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    !newClientIsCompany && styles.toggleButtonActive,
                  ]}
                  onPress={() => setNewClientIsCompany(false)}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      !newClientIsCompany && styles.toggleTextActive,
                    ]}
                  >
                    Individual
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    newClientIsCompany && styles.toggleButtonActive,
                  ]}
                  onPress={() => setNewClientIsCompany(true)}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      newClientIsCompany && styles.toggleTextActive,
                    ]}
                  >
                    Company
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Company Name or Individual Names */}
            {newClientIsCompany ? (
              <View style={styles.section}>
                <Text style={styles.label}>Company Name *</Text>
                <TextInput
                  style={styles.input}
                  value={newClientCompanyName}
                  onChangeText={setNewClientCompanyName}
                  placeholder="Enter company name"
                  placeholderTextColor="#999"
                />
              </View>
            ) : (
              <>
                <View style={styles.section}>
                  <Text style={styles.label}>First Name *</Text>
                  <TextInput
                    style={styles.input}
                    value={newClientFirstName}
                    onChangeText={setNewClientFirstName}
                    placeholder="Enter first name"
                    placeholderTextColor="#999"
                  />
                </View>

                <View style={styles.section}>
                  <Text style={styles.label}>Last Name *</Text>
                  <TextInput
                    style={styles.input}
                    value={newClientLastName}
                    onChangeText={setNewClientLastName}
                    placeholder="Enter last name"
                    placeholderTextColor="#999"
                  />
                </View>
              </>
            )}

            {/* Contact Details */}
            <View style={styles.section}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={newClientEmail}
                onChangeText={setNewClientEmail}
                placeholder="email@example.com"
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Phone</Text>
              <TextInput
                style={styles.input}
                value={newClientPhone}
                onChangeText={setNewClientPhone}
                placeholder="(02) 1234 5678"
                placeholderTextColor="#999"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Mobile</Text>
              <TextInput
                style={styles.input}
                value={newClientMobile}
                onChangeText={setNewClientMobile}
                placeholder="0412 345 678"
                placeholderTextColor="#999"
                keyboardType="phone-pad"
              />
            </View>
          </ScrollView>

          {/* Create Client Button */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.saveButton, creatingClient && styles.saveButtonDisabled]}
              onPress={handleCreateClient}
              disabled={creatingClient}
            >
              {creatingClient ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons name="check" size={20} color="#fff" />
                  <Text style={styles.saveButtonText}>Create Client</Text>
                </>
              )}
            </TouchableOpacity>
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
  addClientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addClientText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
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
  emptyState: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 8,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
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
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111',
  },
  modalContent: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  modalFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
    padding: 16,
  },
  toggleContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  toggleText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  toggleTextActive: {
    color: '#fff',
  },
})
