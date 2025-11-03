import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal } from 'react-native'
import { useRouter, Stack } from 'expo-router'
import { useState, useEffect } from 'react'
import { apiClient } from '../../lib/api-client'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useTheme } from '../../context/ThemeContext'

interface LineItem {
  description: string
  quantity: string
  unit_price: string
  line_total: string
  gst_amount: string
  item_type: string
}

export default function NewQuoteScreen() {
  const router = useRouter()
  const { brandColor } = useTheme()

  const [clients, setClients] = useState<any[]>([])
  const [loadingClients, setLoadingClients] = useState(true)
  const [saving, setSaving] = useState(false)

  // Quote fields
  const [selectedClient, setSelectedClient] = useState<any>(null)
  const [validUntilDate, setValidUntilDate] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [lineItems, setLineItems] = useState<LineItem[]>([])

  // Modal states
  const [showClientPicker, setShowClientPicker] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [itemDescription, setItemDescription] = useState('')
  const [itemQuantity, setItemQuantity] = useState('1')
  const [itemUnitPrice, setItemUnitPrice] = useState('')
  const [itemType, setItemType] = useState('labor')

  useEffect(() => {
    fetchClients()
    // Set default valid until date (30 days from now)
    const date = new Date()
    date.setDate(date.getDate() + 30)
    setValidUntilDate(date.toISOString().split('T')[0])
  }, [])

  const fetchClients = async () => {
    try {
      const response = await apiClient.getClients()

      // Build client_name for each client
      const clientsWithName = (response.clients || []).map((client: any) => {
        const clientName = client.is_company && client.company_name
          ? client.company_name
          : [client.first_name, client.last_name].filter(Boolean).join(' ') || 'Unknown Client'
        return { ...client, client_name: clientName }
      })

      setClients(clientsWithName)
    } catch (err) {
      console.error('Failed to fetch clients:', err)
    } finally {
      setLoadingClients(false)
    }
  }

  const calculateLineTotal = (quantity: string, unitPrice: string) => {
    const qty = parseFloat(quantity) || 0
    const price = parseFloat(unitPrice) || 0
    const subtotal = qty * price
    const gst = subtotal * 0.1
    return {
      line_total: (subtotal + gst).toFixed(2),
      gst_amount: gst.toFixed(2),
    }
  }

  const calculateTotals = (items: LineItem[]) => {
    let subtotal = 0
    let gstAmount = 0

    items.forEach(item => {
      const qty = parseFloat(item.quantity) || 0
      const price = parseFloat(item.unit_price) || 0
      const itemSubtotal = qty * price
      subtotal += itemSubtotal
      gstAmount += itemSubtotal * 0.1
    })

    return {
      subtotal: subtotal.toFixed(2),
      gst_amount: gstAmount.toFixed(2),
      total_amount: (subtotal + gstAmount).toFixed(2),
    }
  }

  const handleAddLineItem = () => {
    setEditingIndex(lineItems.length)
    setItemDescription('')
    setItemQuantity('1')
    setItemUnitPrice('')
    setItemType('labor')
  }

  const handleSaveLineItem = () => {
    if (!itemDescription || !itemQuantity || !itemUnitPrice) {
      Alert.alert('Error', 'Please fill in all line item fields')
      return
    }

    const { line_total, gst_amount } = calculateLineTotal(itemQuantity, itemUnitPrice)

    const newItem: LineItem = {
      description: itemDescription,
      quantity: itemQuantity,
      unit_price: itemUnitPrice,
      line_total,
      gst_amount,
      item_type: itemType,
    }

    const updatedItems = [...lineItems]
    if (editingIndex !== null && editingIndex < lineItems.length) {
      updatedItems[editingIndex] = newItem
    } else {
      updatedItems.push(newItem)
    }

    setLineItems(updatedItems)
    setEditingIndex(null)
  }

  const handleDeleteLineItem = (index: number) => {
    Alert.alert('Delete Line Item', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => setLineItems(lineItems.filter((_, i) => i !== index)),
      },
    ])
  }

  const handleCreate = async () => {
    if (!selectedClient) {
      Alert.alert('Error', 'Please select a client')
      return
    }

    if (!title) {
      Alert.alert('Error', 'Please enter a quote title')
      return
    }

    if (lineItems.length === 0) {
      Alert.alert('Error', 'Please add at least one line item')
      return
    }

    try {
      setSaving(true)
      const totals = calculateTotals(lineItems)

      const quoteData = {
        clientId: selectedClient.id,
        title,
        description,
        validUntilDate,
        subtotal: totals.subtotal,
        gstAmount: totals.gst_amount,
        totalAmount: totals.total_amount,
        status: 'draft',
        lineItems: lineItems.map((item, index) => ({
          ...item,
          lineOrder: index,
        })),
      }

      const response = await apiClient.createQuote(quoteData)
      Alert.alert('Success', 'Quote created successfully', [
        { text: 'OK', onPress: () => router.push(`/quotes/${response.quote.id}`) }
      ])
    } catch (err: any) {
      console.error('Failed to create quote:', err)
      Alert.alert('Error', err.message || 'Failed to create quote')
    } finally {
      setSaving(false)
    }
  }

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    return `$${num.toFixed(2)}`
  }

  const totals = calculateTotals(lineItems)

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'New Quote',
          headerRight: () => (
            <TouchableOpacity onPress={handleCreate} disabled={saving}>
              <Text style={[styles.createButton, { color: brandColor }]}>
                {saving ? 'Creating...' : 'Create'}
              </Text>
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView style={styles.scrollView}>
        {/* Client Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Client</Text>
          <TouchableOpacity
            style={styles.clientPicker}
            onPress={() => setShowClientPicker(true)}
          >
            <Text style={selectedClient ? styles.clientSelected : styles.clientPlaceholder}>
              {selectedClient ? selectedClient.client_name : 'Select a client'}
            </Text>
            <MaterialCommunityIcons name="chevron-down" size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>

        {/* Quote Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quote Details</Text>

          <Text style={styles.fieldLabel}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g., Kitchen Renovation"
          />

          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Additional details"
            multiline
            numberOfLines={3}
          />

          <Text style={styles.fieldLabel}>Valid Until</Text>
          <TextInput
            style={styles.input}
            value={validUntilDate}
            onChangeText={setValidUntilDate}
            placeholder="YYYY-MM-DD"
          />
        </View>

        {/* Line Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Line Items</Text>

          {lineItems.map((item, index) => (
            <View key={index} style={styles.lineItemCard}>
              <View style={styles.lineItemHeader}>
                <Text style={styles.lineItemDescription}>{item.description}</Text>
                <TouchableOpacity onPress={() => handleDeleteLineItem(index)}>
                  <MaterialCommunityIcons name="delete" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
              <View style={styles.lineItemDetails}>
                <Text style={styles.lineItemQuantity}>
                  {parseFloat(item.quantity).toFixed(2)} × {formatCurrency(item.unit_price)}
                </Text>
                <Text style={styles.lineItemTotal}>{formatCurrency(item.line_total)}</Text>
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={[styles.addButton, { borderColor: brandColor }]}
            onPress={handleAddLineItem}
          >
            <MaterialCommunityIcons name="plus" size={20} color={brandColor} />
            <Text style={[styles.addButtonText, { color: brandColor }]}>Add Line Item</Text>
          </TouchableOpacity>
        </View>

        {/* Totals */}
        {lineItems.length > 0 && (
          <View style={styles.section}>
            <View style={styles.totalRow}>
              <Text style={styles.label}>Subtotal</Text>
              <Text style={styles.value}>{formatCurrency(totals.subtotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.label}>GST (10%)</Text>
              <Text style={styles.value}>{formatCurrency(totals.gst_amount)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatCurrency(totals.total_amount)}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Client Picker Modal */}
      <Modal
        visible={showClientPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowClientPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Client</Text>
              <TouchableOpacity onPress={() => setShowClientPicker(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {loadingClients ? (
              <ActivityIndicator size="large" color={brandColor} style={{ marginVertical: 40 }} />
            ) : (
              <ScrollView style={styles.modalBody}>
                {clients.map((client) => (
                  <TouchableOpacity
                    key={client.id}
                    style={styles.clientOption}
                    onPress={() => {
                      setSelectedClient(client)
                      setShowClientPicker(false)
                    }}
                  >
                    <Text style={styles.clientOptionName}>{client.client_name}</Text>
                    {client.email && <Text style={styles.clientOptionEmail}>{client.email}</Text>}
                  </TouchableOpacity>
                ))}

                {/* Create New Client Option */}
                <TouchableOpacity
                  style={[styles.clientOption, styles.createClientOption]}
                  onPress={() => {
                    setShowClientPicker(false)
                    router.push('/clients/new?returnTo=/quotes/new')
                  }}
                >
                  <View style={styles.createClientContent}>
                    <MaterialCommunityIcons name="plus-circle" size={24} color={brandColor} />
                    <Text style={[styles.clientOptionName, { color: brandColor, marginLeft: 12 }]}>
                      Create New Client
                    </Text>
                  </View>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Line Item Edit Modal */}
      <Modal
        visible={editingIndex !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditingIndex(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Line Item</Text>
              <TouchableOpacity onPress={() => setEditingIndex(null)}>
                <MaterialCommunityIcons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={styles.input}
                value={itemDescription}
                onChangeText={setItemDescription}
                placeholder="e.g., Labor, Materials"
              />

              <Text style={styles.fieldLabel}>Quantity</Text>
              <TextInput
                style={styles.input}
                value={itemQuantity}
                onChangeText={setItemQuantity}
                keyboardType="decimal-pad"
                placeholder="0.00"
              />

              <Text style={styles.fieldLabel}>Unit Price</Text>
              <TextInput
                style={styles.input}
                value={itemUnitPrice}
                onChangeText={setItemUnitPrice}
                keyboardType="decimal-pad"
                placeholder="0.00"
              />

              <TouchableOpacity
                style={[styles.saveItemButton, { backgroundColor: brandColor }]}
                onPress={handleSaveLineItem}
              >
                <Text style={styles.saveItemButtonText}>Save Item</Text>
              </TouchableOpacity>
            </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  createButton: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 16,
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  clientPicker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
  },
  clientPlaceholder: {
    fontSize: 16,
    color: '#9ca3af',
  },
  clientSelected: {
    fontSize: 16,
    color: '#1f2937',
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  lineItemCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  lineItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  lineItemDescription: {
    fontSize: 15,
    color: '#1f2937',
    fontWeight: '500',
    flex: 1,
  },
  lineItemDetails: {
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
    color: '#1f2937',
    fontWeight: '600',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    marginTop: 8,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    color: '#6b7280',
  },
  value: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 8,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  modalBody: {
    padding: 20,
  },
  clientOption: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  clientOptionName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
  },
  clientOptionEmail: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  createClientOption: {
    borderBottomWidth: 0,
    borderTopWidth: 2,
    borderTopColor: '#e5e7eb',
    paddingTop: 20,
    marginTop: 12,
  },
  createClientContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  saveItemButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  saveItemButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
})
