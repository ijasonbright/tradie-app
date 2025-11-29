import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, Modal, Platform, KeyboardAvoidingView } from 'react-native'
import { useRouter, Stack } from 'expo-router'
import { useState, useEffect } from 'react'
import { apiClient } from '../../lib/api-client'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useTheme } from '../../context/ThemeContext'
import DateTimePicker from '@react-native-community/datetimepicker'

const PAYMENT_TERMS_OPTIONS = [
  { value: 'Due on Receipt', label: 'Due on Receipt' },
  { value: 'Net 7', label: 'Net 7 days' },
  { value: 'Net 14', label: 'Net 14 days' },
  { value: 'Net 30', label: 'Net 30 days' },
]

const ITEM_TYPE_OPTIONS = [
  { value: 'labor', label: 'Labor' },
  { value: 'material', label: 'Material' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'fee', label: 'Fee' },
  { value: 'other', label: 'Other' },
]

interface LineItem {
  id: string
  itemType: string
  description: string
  quantity: string
  unitPrice: string
}

export default function AddInvoiceScreen() {
  const router = useRouter()
  const { brandColor } = useTheme()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [clients, setClients] = useState<any[]>([])
  const [jobs, setJobs] = useState<any[]>([])
  const [organization, setOrganization] = useState<any>(null)

  // Form fields
  const [clientId, setClientId] = useState('')
  const [jobId, setJobId] = useState('')
  const [issueDate, setIssueDate] = useState(new Date())
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)) // 14 days from now
  const [paymentTerms, setPaymentTerms] = useState('Net 14')
  const [notes, setNotes] = useState('')
  const [footerText, setFooterText] = useState('')

  // Line items
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [showLineItemModal, setShowLineItemModal] = useState(false)
  const [editingLineItem, setEditingLineItem] = useState<LineItem | null>(null)
  const [newItemType, setNewItemType] = useState('labor')
  const [newItemDescription, setNewItemDescription] = useState('')
  const [newItemQuantity, setNewItemQuantity] = useState('1')
  const [newItemUnitPrice, setNewItemUnitPrice] = useState('')

  // Date picker state
  const [showIssueDatePicker, setShowIssueDatePicker] = useState(false)
  const [showDueDatePicker, setShowDueDatePicker] = useState(false)

  // Client selection modal
  const [showClientModal, setShowClientModal] = useState(false)
  const [clientSearch, setClientSearch] = useState('')

  // Job selection modal
  const [showJobModal, setShowJobModal] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)

      // Get clients
      const clientsResponse = await apiClient.getClients()
      setClients(clientsResponse.clients || [])

      // Get jobs (for linking invoice to job)
      const jobsResponse = await apiClient.getJobs()
      setJobs(jobsResponse.jobs || [])

      // Get organization ID from first job
      if (jobsResponse.jobs && jobsResponse.jobs.length > 0) {
        const orgId = jobsResponse.jobs[0].organization_id
        const orgName = jobsResponse.jobs[0].organization_name
        setOrganization({ id: orgId, name: orgName })
      }
    } catch (err: any) {
      console.error('Failed to fetch data:', err)
      Alert.alert('Error', 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const generateTempId = () => `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const handleAddLineItem = () => {
    setEditingLineItem(null)
    setNewItemType('labor')
    setNewItemDescription('')
    setNewItemQuantity('1')
    setNewItemUnitPrice('')
    setShowLineItemModal(true)
  }

  const handleEditLineItem = (item: LineItem) => {
    setEditingLineItem(item)
    setNewItemType(item.itemType)
    setNewItemDescription(item.description)
    setNewItemQuantity(item.quantity)
    setNewItemUnitPrice(item.unitPrice)
    setShowLineItemModal(true)
  }

  const handleSaveLineItem = () => {
    if (!newItemDescription.trim()) {
      Alert.alert('Validation Error', 'Description is required')
      return
    }
    if (!newItemQuantity || parseFloat(newItemQuantity) <= 0) {
      Alert.alert('Validation Error', 'Quantity must be greater than 0')
      return
    }
    if (!newItemUnitPrice || parseFloat(newItemUnitPrice) < 0) {
      Alert.alert('Validation Error', 'Unit price is required')
      return
    }

    if (editingLineItem) {
      // Update existing
      setLineItems(lineItems.map(item =>
        item.id === editingLineItem.id
          ? {
              ...item,
              itemType: newItemType,
              description: newItemDescription.trim(),
              quantity: newItemQuantity,
              unitPrice: newItemUnitPrice,
            }
          : item
      ))
    } else {
      // Add new
      setLineItems([...lineItems, {
        id: generateTempId(),
        itemType: newItemType,
        description: newItemDescription.trim(),
        quantity: newItemQuantity,
        unitPrice: newItemUnitPrice,
      }])
    }

    setShowLineItemModal(false)
  }

  const handleDeleteLineItem = (id: string) => {
    Alert.alert(
      'Delete Line Item',
      'Are you sure you want to delete this line item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => setLineItems(lineItems.filter(item => item.id !== id)),
        },
      ]
    )
  }

  const calculateSubtotal = () => {
    return lineItems.reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || 0
      const price = parseFloat(item.unitPrice) || 0
      return sum + (qty * price)
    }, 0)
  }

  const calculateGST = () => {
    return calculateSubtotal() * 0.1
  }

  const calculateTotal = () => {
    return calculateSubtotal() + calculateGST()
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(amount)
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const getClientName = (client: any) => {
    return client.is_company
      ? client.company_name
      : `${client.first_name || ''} ${client.last_name || ''}`.trim()
  }

  const handleSelectClient = (client: any) => {
    setClientId(client.id)
    setShowClientModal(false)
    setClientSearch('')
  }

  const handleSelectJob = (job: any) => {
    setJobId(job.id)
    // Auto-fill client if job has a client
    if (job.client_id && !clientId) {
      setClientId(job.client_id)
    }
    setShowJobModal(false)
  }

  const filteredClients = clients.filter(client => {
    if (!clientSearch) return true
    const name = getClientName(client).toLowerCase()
    return name.includes(clientSearch.toLowerCase())
  })

  const handleSave = async () => {
    // Validation
    if (!clientId) {
      Alert.alert('Validation Error', 'Please select a client')
      return
    }

    if (!organization) {
      Alert.alert('Error', 'No organization found')
      return
    }

    if (lineItems.length === 0) {
      Alert.alert('Validation Error', 'Please add at least one line item')
      return
    }

    try {
      setSaving(true)

      const subtotal = calculateSubtotal()
      const gstAmount = calculateGST()

      // Create invoice
      const invoiceData = {
        organization_id: organization.id,
        client_id: clientId,
        job_id: jobId || null,
        issue_date: issueDate.toISOString().split('T')[0],
        due_date: dueDate.toISOString().split('T')[0],
        payment_terms: paymentTerms,
        notes: notes.trim() || null,
        footer_text: footerText.trim() || null,
        subtotal: subtotal,
        gst_amount: gstAmount,
        status: 'draft',
      }

      const response = await apiClient.createInvoice(invoiceData)
      const invoiceId = response.invoice.id

      // Add line items
      for (const item of lineItems) {
        await apiClient.addInvoiceLineItem(invoiceId, {
          itemType: item.itemType,
          description: item.description,
          quantity: parseFloat(item.quantity),
          unitPrice: parseFloat(item.unitPrice),
        })
      }

      Alert.alert('Success', 'Invoice created successfully', [
        {
          text: 'View Invoice',
          onPress: () => router.replace(`/invoices/${invoiceId}`),
        },
        {
          text: 'Back to List',
          onPress: () => router.back(),
        },
      ])
    } catch (err: any) {
      console.error('Failed to create invoice:', err)
      Alert.alert('Error', err.message || 'Failed to create invoice')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ title: 'Create Invoice' }} />
        <ActivityIndicator size="large" color={brandColor} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    )
  }

  const selectedClient = clients.find(c => c.id === clientId)
  const selectedJob = jobs.find(j => j.id === jobId)

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <Stack.Screen options={{ title: 'Create Invoice' }} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Client Selection */}
        <View style={styles.section}>
          <Text style={styles.label}>Client *</Text>
          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => setShowClientModal(true)}
          >
            <Text style={selectedClient ? styles.selectButtonTextSelected : styles.selectButtonText}>
              {selectedClient ? getClientName(selectedClient) : 'Select a client'}
            </Text>
            <MaterialCommunityIcons name="chevron-down" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Job Selection (Optional) */}
        <View style={styles.section}>
          <Text style={styles.label}>Link to Job (Optional)</Text>
          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => setShowJobModal(true)}
          >
            <Text style={selectedJob ? styles.selectButtonTextSelected : styles.selectButtonText}>
              {selectedJob ? `${selectedJob.job_number} - ${selectedJob.title}` : 'Select a job'}
            </Text>
            <MaterialCommunityIcons name="chevron-down" size={20} color="#666" />
          </TouchableOpacity>
          {jobId && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => setJobId('')}
            >
              <Text style={styles.clearButtonText}>Clear job selection</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Dates */}
        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.halfWidth}>
              <Text style={styles.label}>Issue Date *</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowIssueDatePicker(true)}
              >
                <MaterialCommunityIcons name="calendar" size={20} color="#666" />
                <Text style={styles.dateButtonText}>{formatDate(issueDate)}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.halfWidth}>
              <Text style={styles.label}>Due Date *</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowDueDatePicker(true)}
              >
                <MaterialCommunityIcons name="calendar" size={20} color="#666" />
                <Text style={styles.dateButtonText}>{formatDate(dueDate)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Payment Terms */}
        <View style={styles.section}>
          <Text style={styles.label}>Payment Terms</Text>
          <View style={styles.pickerContainer}>
            {PAYMENT_TERMS_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionButton,
                  paymentTerms === option.value && { backgroundColor: brandColor, borderColor: brandColor },
                ]}
                onPress={() => setPaymentTerms(option.value)}
              >
                <Text
                  style={[
                    styles.optionText,
                    paymentTerms === option.value && styles.optionTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Line Items */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Line Items *</Text>
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: brandColor }]}
              onPress={handleAddLineItem}
            >
              <MaterialCommunityIcons name="plus" size={18} color="#fff" />
              <Text style={styles.addButtonText}>Add Item</Text>
            </TouchableOpacity>
          </View>

          {lineItems.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="receipt-text-outline" size={40} color="#ccc" />
              <Text style={styles.emptyText}>No line items yet</Text>
              <Text style={styles.emptySubtext}>Tap "Add Item" to add your first item</Text>
            </View>
          ) : (
            <View style={styles.lineItemsList}>
              {lineItems.map((item) => {
                const qty = parseFloat(item.quantity) || 0
                const price = parseFloat(item.unitPrice) || 0
                const lineTotal = qty * price

                return (
                  <View key={item.id} style={styles.lineItemCard}>
                    <View style={styles.lineItemContent}>
                      <View style={styles.lineItemHeader}>
                        <Text style={styles.lineItemType}>
                          {ITEM_TYPE_OPTIONS.find(o => o.value === item.itemType)?.label || item.itemType}
                        </Text>
                        <View style={styles.lineItemActions}>
                          <TouchableOpacity
                            onPress={() => handleEditLineItem(item)}
                            style={styles.lineItemActionButton}
                          >
                            <MaterialCommunityIcons name="pencil" size={18} color="#666" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleDeleteLineItem(item.id)}
                            style={styles.lineItemActionButton}
                          >
                            <MaterialCommunityIcons name="trash-can-outline" size={18} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                      </View>
                      <Text style={styles.lineItemDescription}>{item.description}</Text>
                      <View style={styles.lineItemFooter}>
                        <Text style={styles.lineItemQuantity}>
                          {qty} × {formatCurrency(price)}
                        </Text>
                        <Text style={styles.lineItemTotal}>{formatCurrency(lineTotal)}</Text>
                      </View>
                    </View>
                  </View>
                )
              })}
            </View>
          )}
        </View>

        {/* Totals */}
        {lineItems.length > 0 && (
          <View style={styles.totalsSection}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>{formatCurrency(calculateSubtotal())}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>GST (10%)</Text>
              <Text style={styles.totalValue}>{formatCurrency(calculateGST())}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.totalRow}>
              <Text style={styles.grandTotalLabel}>Total</Text>
              <Text style={styles.grandTotalValue}>{formatCurrency(calculateTotal())}</Text>
            </View>
          </View>
        )}

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.label}>Notes (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Additional notes for the client..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Footer Text */}
        <View style={styles.section}>
          <Text style={styles.label}>Footer Text (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={footerText}
            onChangeText={setFooterText}
            placeholder="e.g., Thank you for your business!"
            placeholderTextColor="#999"
            multiline
            numberOfLines={2}
            textAlignVertical="top"
          />
        </View>

        {/* Save Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: brandColor }, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <MaterialCommunityIcons name="check" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>Create Invoice</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Date Pickers */}
      {showIssueDatePicker && (
        <DateTimePicker
          value={issueDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            setShowIssueDatePicker(Platform.OS === 'ios')
            if (selectedDate) {
              setIssueDate(selectedDate)
            }
          }}
        />
      )}

      {showDueDatePicker && (
        <DateTimePicker
          value={dueDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            setShowDueDatePicker(Platform.OS === 'ios')
            if (selectedDate) {
              setDueDate(selectedDate)
            }
          }}
        />
      )}

      {/* Client Selection Modal */}
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
            <Text style={styles.modalTitle}>Select Client</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.searchContainer}>
            <MaterialCommunityIcons name="magnify" size={20} color="#666" />
            <TextInput
              style={styles.searchInput}
              value={clientSearch}
              onChangeText={setClientSearch}
              placeholder="Search clients..."
              placeholderTextColor="#999"
            />
          </View>

          <ScrollView style={styles.modalContent}>
            {filteredClients.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No clients found</Text>
              </View>
            ) : (
              filteredClients.map((client) => (
                <TouchableOpacity
                  key={client.id}
                  style={[
                    styles.clientOption,
                    clientId === client.id && { borderColor: brandColor, backgroundColor: `${brandColor}10` },
                  ]}
                  onPress={() => handleSelectClient(client)}
                >
                  <Text style={styles.clientOptionName}>{getClientName(client)}</Text>
                  {client.email && <Text style={styles.clientOptionEmail}>{client.email}</Text>}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Job Selection Modal */}
      <Modal
        visible={showJobModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowJobModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowJobModal(false)}>
              <MaterialCommunityIcons name="close" size={24} color="#111" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Job</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            {jobs.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No jobs found</Text>
              </View>
            ) : (
              jobs.map((job) => (
                <TouchableOpacity
                  key={job.id}
                  style={[
                    styles.jobOption,
                    jobId === job.id && { borderColor: brandColor, backgroundColor: `${brandColor}10` },
                  ]}
                  onPress={() => handleSelectJob(job)}
                >
                  <Text style={styles.jobOptionNumber}>{job.job_number}</Text>
                  <Text style={styles.jobOptionTitle}>{job.title}</Text>
                  {job.client_name && <Text style={styles.jobOptionClient}>{job.client_name}</Text>}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Line Item Modal */}
      <Modal
        visible={showLineItemModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowLineItemModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowLineItemModal(false)}>
              <MaterialCommunityIcons name="close" size={24} color="#111" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingLineItem ? 'Edit Line Item' : 'Add Line Item'}
            </Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.section}>
              <Text style={styles.label}>Item Type</Text>
              <View style={styles.pickerContainer}>
                {ITEM_TYPE_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.optionButton,
                      newItemType === option.value && { backgroundColor: brandColor, borderColor: brandColor },
                    ]}
                    onPress={() => setNewItemType(option.value)}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        newItemType === option.value && styles.optionTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Description *</Text>
              <TextInput
                style={styles.input}
                value={newItemDescription}
                onChangeText={setNewItemDescription}
                placeholder="e.g., Plumbing repair labor"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.row}>
              <View style={styles.halfWidth}>
                <Text style={styles.label}>Quantity *</Text>
                <TextInput
                  style={styles.input}
                  value={newItemQuantity}
                  onChangeText={setNewItemQuantity}
                  placeholder="1"
                  placeholderTextColor="#999"
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.halfWidth}>
                <Text style={styles.label}>Unit Price *</Text>
                <TextInput
                  style={styles.input}
                  value={newItemUnitPrice}
                  onChangeText={setNewItemUnitPrice}
                  placeholder="0.00"
                  placeholderTextColor="#999"
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            {newItemQuantity && newItemUnitPrice && (
              <View style={styles.linePreview}>
                <Text style={styles.linePreviewLabel}>Line Total (excl. GST):</Text>
                <Text style={styles.linePreviewValue}>
                  {formatCurrency((parseFloat(newItemQuantity) || 0) * (parseFloat(newItemUnitPrice) || 0))}
                </Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: brandColor }]}
              onPress={handleSaveLineItem}
            >
              <MaterialCommunityIcons name="check" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>
                {editingLineItem ? 'Update Item' : 'Add Item'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
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
    backgroundColor: '#f5f5f5',
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
    paddingBottom: 40,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
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
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
  },
  selectButtonText: {
    fontSize: 16,
    color: '#999',
  },
  selectButtonTextSelected: {
    fontSize: 16,
    color: '#111',
  },
  clearButton: {
    marginTop: 8,
  },
  clearButtonText: {
    fontSize: 14,
    color: '#ef4444',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#111',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  optionText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  optionTextActive: {
    color: '#fff',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  emptyState: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  emptySubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  lineItemsList: {
    gap: 8,
  },
  lineItemCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  lineItemContent: {
    padding: 12,
  },
  lineItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  lineItemType: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  lineItemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  lineItemActionButton: {
    padding: 4,
  },
  lineItemDescription: {
    fontSize: 15,
    color: '#111',
    marginBottom: 8,
  },
  lineItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lineItemQuantity: {
    fontSize: 13,
    color: '#6b7280',
  },
  lineItemTotal: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
  },
  totalsSection: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  totalValue: {
    fontSize: 14,
    color: '#111',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 8,
  },
  grandTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111',
  },
  buttonContainer: {
    padding: 16,
    paddingTop: 0,
  },
  saveButton: {
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
    paddingBottom: 32,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111',
    padding: 8,
  },
  clientOption: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  clientOptionName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111',
  },
  clientOptionEmail: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  jobOption: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  jobOptionNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 2,
  },
  jobOptionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111',
  },
  jobOptionClient: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  linePreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  linePreviewLabel: {
    fontSize: 14,
    color: '#0369a1',
  },
  linePreviewValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0369a1',
  },
})
