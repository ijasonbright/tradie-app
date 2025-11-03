import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal, Switch } from 'react-native'
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

export default function EditQuoteScreen() {
  const { id } = useLocalSearchParams()
  const router = useRouter()
  const { brandColor } = useTheme()

  const [quote, setQuote] = useState<any>(null)
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Quote fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [validUntilDate, setValidUntilDate] = useState('')
  const [notes, setNotes] = useState('')

  // Deposit/Part Payment fields
  const [depositRequired, setDepositRequired] = useState(false)
  const [depositType, setDepositType] = useState<'percentage' | 'amount'>('percentage')
  const [depositPercentage, setDepositPercentage] = useState('30')
  const [depositAmount, setDepositAmount] = useState('')

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
    fetchQuote()
  }, [id])

  const fetchQuote = async () => {
    try {
      setLoading(true)
      const response = await apiClient.getQuote(id as string)

      if (!response.quote) {
        throw new Error('Quote not found')
      }

      setQuote(response.quote)
      setLineItems(response.lineItems || [])
      setTitle(response.quote.title || '')
      setDescription(response.quote.description || '')
      setValidUntilDate(response.quote.valid_until_date || '')
      setNotes(response.quote.notes || '')

      // Set deposit fields
      setDepositRequired(response.quote.deposit_required || false)
      if (response.quote.deposit_percentage) {
        setDepositType('percentage')
        setDepositPercentage(response.quote.deposit_percentage.toString())
      } else if (response.quote.deposit_amount) {
        setDepositType('amount')
        setDepositAmount(response.quote.deposit_amount.toString())
      }

      // Check if quote has been sent (not draft)
      setHasBeenSent(response.quote.status !== 'draft')
    } catch (err: any) {
      console.error('Failed to fetch quote:', err)
      Alert.alert('Error', 'Failed to load quote details')
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

  const calculateDepositAmount = () => {
    const totals = calculateTotals(lineItems)
    const total = parseFloat(totals.total_amount)

    if (!depositRequired) return '0.00'

    if (depositType === 'percentage') {
      const percentage = parseFloat(depositPercentage) || 0
      return ((total * percentage) / 100).toFixed(2)
    } else {
      return parseFloat(depositAmount || '0').toFixed(2)
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
    // If quote has been sent, show variation dialog
    if (hasBeenSent) {
      setShowVariationDialog(true)
      return
    }

    // Otherwise save directly
    await saveQuote(false)
  }

  const saveQuote = async (resetToDraft: boolean) => {
    try {
      setSaving(true)

      const totals = calculateTotals(lineItems)

      // Prepare deposit data
      const depositData = depositRequired ? {
        depositRequired: true,
        depositPercentage: depositType === 'percentage' ? parseFloat(depositPercentage) : null,
        depositAmount: depositType === 'amount' ? parseFloat(depositAmount) : null,
      } : {
        depositRequired: false,
        depositPercentage: null,
        depositAmount: null,
      }

      // Update quote details
      await apiClient.updateQuote(id as string, {
        title,
        description,
        validUntilDate,
        notes,
        subtotal: totals.subtotal,
        gstAmount: totals.gst_amount,
        status: resetToDraft ? 'draft' : quote.status,
        ...depositData,
      })

      // TODO: Update line items via API
      // This requires implementing line item add/update/delete endpoints in apiClient
      // For now, we'll need to handle this on the backend or add those methods

      Alert.alert('Success', 'Quote updated successfully', [
        { text: 'OK', onPress: () => router.back() }
      ])
    } catch (err: any) {
      console.error('Failed to update quote:', err)
      Alert.alert('Error', err.message || 'Failed to update quote')
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
        <Stack.Screen options={{ title: 'Edit Quote' }} />
        <ActivityIndicator size="large" color={brandColor} />
      </View>
    )
  }

  const totals = calculateTotals(lineItems)
  const calculatedDeposit = calculateDepositAmount()

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Edit Quote',
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
        {/* Quote Number */}
        <View style={styles.section}>
          <Text style={styles.quoteNumber}>{quote.quote_number}</Text>
          <Text style={styles.clientName}>{quote.client_name}</Text>
        </View>

        {/* Quote Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quote Details</Text>

          <Text style={styles.fieldLabel}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g., Bathroom Renovation"
          />

          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the work to be done"
            multiline
            numberOfLines={4}
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

        {/* Deposit / Part Payment */}
        <View style={styles.section}>
          <View style={styles.depositHeader}>
            <Text style={styles.sectionTitle}>Deposit / Part Payment</Text>
            <Switch
              value={depositRequired}
              onValueChange={setDepositRequired}
              trackColor={{ false: '#d1d5db', true: brandColor }}
              thumbColor="#fff"
            />
          </View>

          {depositRequired && (
            <>
              <View style={styles.depositTypeContainer}>
                <TouchableOpacity
                  style={[
                    styles.depositTypeButton,
                    depositType === 'percentage' && { backgroundColor: brandColor },
                  ]}
                  onPress={() => setDepositType('percentage')}
                >
                  <Text
                    style={[
                      styles.depositTypeText,
                      depositType === 'percentage' && styles.depositTypeTextActive,
                    ]}
                  >
                    Percentage
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.depositTypeButton,
                    depositType === 'amount' && { backgroundColor: brandColor },
                  ]}
                  onPress={() => setDepositType('amount')}
                >
                  <Text
                    style={[
                      styles.depositTypeText,
                      depositType === 'amount' && styles.depositTypeTextActive,
                    ]}
                  >
                    Fixed Amount
                  </Text>
                </TouchableOpacity>
              </View>

              {depositType === 'percentage' ? (
                <>
                  <Text style={styles.fieldLabel}>Deposit Percentage</Text>
                  <TextInput
                    style={styles.input}
                    value={depositPercentage}
                    onChangeText={setDepositPercentage}
                    keyboardType="decimal-pad"
                    placeholder="30"
                  />
                </>
              ) : (
                <>
                  <Text style={styles.fieldLabel}>Deposit Amount</Text>
                  <TextInput
                    style={styles.input}
                    value={depositAmount}
                    onChangeText={setDepositAmount}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                  />
                </>
              )}

              <View style={styles.depositCalculation}>
                <Text style={styles.depositLabel}>Deposit Amount:</Text>
                <Text style={styles.depositValue}>{formatCurrency(calculatedDeposit)}</Text>
              </View>
            </>
          )}
        </View>

        {/* Additional Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Terms and conditions, payment details, etc."
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
            <Text style={styles.dialogTitle}>Quote Has Been Sent</Text>
            <Text style={styles.dialogMessage}>
              This quote has already been sent to the client. How would you like to handle this variation?
            </Text>

            <TouchableOpacity
              style={[styles.dialogButton, styles.primaryButton, { backgroundColor: brandColor }]}
              onPress={() => saveQuote(true)}
            >
              <Text style={styles.dialogButtonText}>Send for Re-Approval</Text>
              <Text style={styles.dialogButtonSubtext}>Quote will be reset to draft and require client approval</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dialogButton, styles.secondaryButton]}
              onPress={() => saveQuote(false)}
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
  quoteNumber: {
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
  depositHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  depositTypeContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  depositTypeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  depositTypeText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  depositTypeTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  depositCalculation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  depositLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  depositValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10b981',
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
