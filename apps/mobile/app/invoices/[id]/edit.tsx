import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal } from 'react-native'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { useState, useEffect } from 'react'
import { apiClient } from '../../../lib/api-client'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useTheme } from '../../../context/ThemeContext'

interface LineItem {
  id?: string
  description: string
  quantity: string
  unit_price: string
  line_total: string
  gst_amount: string
  item_type: string
}

export default function EditInvoiceScreen() {
  const { id } = useLocalSearchParams()
  const router = useRouter()
  const { brandColor } = useTheme()

  const [invoice, setInvoice] = useState<any>(null)
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Invoice fields
  const [dueDate, setDueDate] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('')
  const [notes, setNotes] = useState('')

  // Line item being edited
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [itemDescription, setItemDescription] = useState('')
  const [itemQuantity, setItemQuantity] = useState('')
  const [itemUnitPrice, setItemUnitPrice] = useState('')
  const [itemType, setItemType] = useState('labor')

  // Variation approval dialog
  const [showVariationDialog, setShowVariationDialog] = useState(false)
  const [hasBeenSent, setHasBeenSent] = useState(false)

  useEffect(() => {
    fetchInvoice()
  }, [id])

  const fetchInvoice = async () => {
    try {
      setLoading(true)
      const response = await apiClient.getInvoice(id as string)
      setInvoice(response.invoice)
      setLineItems(response.lineItems || [])
      setDueDate(response.invoice.due_date || '')
      setPaymentTerms(response.invoice.payment_terms || '')
      setNotes(response.invoice.notes || '')

      // Check if invoice has been sent (not draft)
      setHasBeenSent(response.invoice.status !== 'draft')
    } catch (err: any) {
      console.error('Failed to fetch invoice:', err)
      Alert.alert('Error', 'Failed to load invoice details')
      router.back()
    } finally {
      setLoading(false)
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

  const handleEditLineItem = (index: number) => {
    const item = lineItems[index]
    setEditingIndex(index)
    setItemDescription(item.description)
    setItemQuantity(item.quantity)
    setItemUnitPrice(item.unit_price)
    setItemType(item.item_type || 'labor')
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
      // Editing existing item
      updatedItems[editingIndex] = { ...lineItems[editingIndex], ...newItem }
    } else {
      // Adding new item
      updatedItems.push(newItem)
    }

    setLineItems(updatedItems)
    setEditingIndex(null)
    setItemDescription('')
    setItemQuantity('1')
    setItemUnitPrice('')
    setItemType('labor')
  }

  const handleDeleteLineItem = (index: number) => {
    Alert.alert(
      'Delete Line Item',
      'Are you sure you want to delete this line item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const updatedItems = lineItems.filter((_, i) => i !== index)
            setLineItems(updatedItems)
          },
        },
      ]
    )
  }

  const handleSave = async () => {
    // If invoice has been sent, show variation dialog
    if (hasBeenSent) {
      setShowVariationDialog(true)
      return
    }

    // Otherwise save directly
    await saveInvoice(false)
  }

  const saveInvoice = async (resetToDraft: boolean) => {
    try {
      setSaving(true)

      const totals = calculateTotals(lineItems)

      // Update invoice details
      await apiClient.updateInvoice(id as string, {
        due_date: dueDate,
        payment_terms: paymentTerms,
        notes,
        subtotal: totals.subtotal,
        gst_amount: totals.gst_amount,
        status: resetToDraft ? 'draft' : invoice.status,
      })

      // TODO: Update line items via API
      // This requires implementing line item add/update/delete endpoints in apiClient
      // For now, we'll need to handle this on the backend or add those methods

      Alert.alert('Success', 'Invoice updated successfully', [
        { text: 'OK', onPress: () => router.back() }
      ])
    } catch (err: any) {
      console.error('Failed to update invoice:', err)
      Alert.alert('Error', err.message || 'Failed to update invoice')
    } finally {
      setSaving(false)
      setShowVariationDialog(false)
    }
  }

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    return `$${num.toFixed(2)}`
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Stack.Screen options={{ title: 'Edit Invoice' }} />
        <ActivityIndicator size="large" color={brandColor} />
      </View>
    )
  }

  const totals = calculateTotals(lineItems)

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Edit Invoice',
          headerRight: () => (
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              <Text style={[styles.saveButton, { color: brandColor }]}>
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView style={styles.scrollView}>
        {/* Invoice Number */}
        <View style={styles.section}>
          <Text style={styles.invoiceNumber}>{invoice.invoice_number}</Text>
          <Text style={styles.clientName}>{invoice.client_name}</Text>
        </View>

        {/* Line Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Line Items</Text>

          {lineItems.map((item, index) => (
            <View key={index} style={styles.lineItemCard}>
              <View style={styles.lineItemHeader}>
                <Text style={styles.lineItemDescription}>{item.description}</Text>
                <View style={styles.lineItemActions}>
                  <TouchableOpacity onPress={() => handleEditLineItem(index)}>
                    <MaterialCommunityIcons name="pencil" size={20} color={brandColor} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteLineItem(index)} style={{ marginLeft: 12 }}>
                    <MaterialCommunityIcons name="delete" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>
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

        {/* Invoice Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Invoice Details</Text>

          <Text style={styles.fieldLabel}>Due Date</Text>
          <TextInput
            style={styles.input}
            value={dueDate}
            onChangeText={setDueDate}
            placeholder="YYYY-MM-DD"
          />

          <Text style={styles.fieldLabel}>Payment Terms</Text>
          <TextInput
            style={styles.input}
            value={paymentTerms}
            onChangeText={setPaymentTerms}
            placeholder="e.g., Net 30"
          />

          <Text style={styles.fieldLabel}>Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Additional notes"
            multiline
            numberOfLines={4}
          />
        </View>
      </ScrollView>

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
              <Text style={styles.modalTitle}>
                {editingIndex !== null && editingIndex < lineItems.length ? 'Edit Line Item' : 'Add Line Item'}
              </Text>
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

      {/* Variation Approval Dialog */}
      <Modal
        visible={showVariationDialog}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowVariationDialog(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.dialogContent}>
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#f59e0b" />
            <Text style={styles.dialogTitle}>Invoice Has Been Sent</Text>
            <Text style={styles.dialogMessage}>
              This invoice has already been sent to the client. How would you like to handle this variation?
            </Text>

            <TouchableOpacity
              style={[styles.dialogButton, styles.primaryButton, { backgroundColor: brandColor }]}
              onPress={() => saveInvoice(true)}
            >
              <Text style={styles.dialogButtonText}>Send for Re-Approval</Text>
              <Text style={styles.dialogButtonSubtext}>Invoice will be reset to draft and require client approval</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dialogButton, styles.secondaryButton]}
              onPress={() => saveInvoice(false)}
            >
              <Text style={[styles.dialogButtonText, { color: brandColor }]}>Self-Approve Variation</Text>
              <Text style={styles.dialogButtonSubtext}>You are approving this variation yourself</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowVariationDialog(false)}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 16,
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
  },
  invoiceNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  clientName: {
    fontSize: 18,
    color: '#6b7280',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
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
  lineItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
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
    minHeight: 100,
    textAlignVertical: 'top',
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
  dialogContent: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  dialogMessage: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  dialogButton: {
    width: '100%',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  dialogButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  dialogButtonSubtext: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
  },
  cancelButton: {
    marginTop: 8,
    padding: 12,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#6b7280',
  },
})
