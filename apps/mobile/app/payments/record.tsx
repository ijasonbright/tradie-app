import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter, Stack } from 'expo-router'
import { useState, useEffect } from 'react'
import { apiClient } from '../../lib/api-client'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useTheme } from '../../context/ThemeContext'
import DateTimePicker from '@react-native-community/datetimepicker'

export default function RecordPaymentScreen() {
  const router = useRouter()
  const { brandColor } = useTheme()

  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Form fields
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null)
  const [amount, setAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [showInvoiceSelector, setShowInvoiceSelector] = useState(false)

  useEffect(() => {
    fetchOutstandingInvoices()
  }, [])

  const fetchOutstandingInvoices = async () => {
    try {
      setLoading(true)
      // Get invoices that are not fully paid
      const response = await apiClient.getInvoices()
      const outstanding = response.invoices.filter(
        (inv: any) => inv.status !== 'paid' && inv.status !== 'cancelled'
      )
      setInvoices(outstanding)
    } catch (err: any) {
      console.error('Failed to fetch invoices:', err)
      Alert.alert('Error', 'Failed to load invoices')
    } finally {
      setLoading(false)
    }
  }

  const handleInvoiceSelect = (invoice: any) => {
    setSelectedInvoice(invoice)
    setShowInvoiceSelector(false)

    // Set default amount to outstanding balance
    const outstanding = parseFloat(invoice.total_amount) - parseFloat(invoice.paid_amount || '0')
    setAmount(outstanding.toFixed(2))
  }

  const handleSubmit = async () => {
    // Validation
    if (!selectedInvoice) {
      Alert.alert('Invoice Required', 'Please select an invoice')
      return
    }

    const paymentAmount = parseFloat(amount)
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount')
      return
    }

    const outstanding = parseFloat(selectedInvoice.total_amount) - parseFloat(selectedInvoice.paid_amount || '0')
    if (paymentAmount > outstanding) {
      Alert.alert('Amount Exceeds Balance', `Payment amount cannot exceed outstanding balance of $${outstanding.toFixed(2)}`)
      return
    }

    try {
      setSubmitting(true)

      await apiClient.recordPayment(selectedInvoice.id, {
        amount: paymentAmount,
        payment_date: paymentDate.toISOString(),
        payment_method: paymentMethod,
        reference_number: referenceNumber || null,
        notes: notes || null,
      })

      Alert.alert('Success', 'Payment recorded successfully', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ])
    } catch (err: any) {
      console.error('Failed to record payment:', err)
      Alert.alert('Error', err.message || 'Failed to record payment')
    } finally {
      setSubmitting(false)
    }
  }

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    return `$${num.toFixed(2)}`
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const paymentMethods = [
    { value: 'bank_transfer', label: 'Bank Transfer', icon: 'bank-transfer' },
    { value: 'cash', label: 'Cash', icon: 'cash' },
    { value: 'card', label: 'Card', icon: 'credit-card' },
    { value: 'cheque', label: 'Cheque', icon: 'checkbook' },
    { value: 'other', label: 'Other', icon: 'dots-horizontal' },
  ]

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Stack.Screen options={{ title: 'Record Payment' }} />
        <ActivityIndicator size="large" color={brandColor} />
        <Text style={styles.loadingText}>Loading invoices...</Text>
      </View>
    )
  }

  if (invoices.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Stack.Screen options={{ title: 'Record Payment' }} />
        <MaterialCommunityIcons name="receipt-text-check" size={64} color="#d1d5db" />
        <Text style={styles.emptyText}>No outstanding invoices</Text>
        <Text style={styles.emptySubtext}>All invoices are paid or cancelled</Text>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: brandColor }]}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const outstanding = selectedInvoice
    ? parseFloat(selectedInvoice.total_amount) - parseFloat(selectedInvoice.paid_amount || '0')
    : 0

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <Stack.Screen options={{ title: 'Record Payment' }} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Invoice Selection */}
        <View style={styles.section}>
          <Text style={styles.inputLabel}>Select Invoice *</Text>
          {selectedInvoice ? (
            <TouchableOpacity
              style={styles.selectedInvoiceCard}
              onPress={() => setShowInvoiceSelector(true)}
            >
              <View style={styles.selectedInvoiceInfo}>
                <Text style={styles.invoiceNumber}>{selectedInvoice.invoice_number}</Text>
                <Text style={styles.clientName}>{selectedInvoice.client_name}</Text>
                <View style={styles.amountRow}>
                  <Text style={styles.amountLabel}>Outstanding:</Text>
                  <Text style={styles.amountValue}>{formatCurrency(outstanding)}</Text>
                </View>
              </View>
              <MaterialCommunityIcons name="chevron-down" size={24} color="#6b7280" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => setShowInvoiceSelector(true)}
            >
              <MaterialCommunityIcons name="receipt-text" size={20} color={brandColor} />
              <Text style={[styles.selectButtonText, { color: brandColor }]}>Select Invoice</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Invoice Selector Modal */}
        {showInvoiceSelector && (
          <View style={styles.modalOverlay}>
            <View style={styles.modal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Invoice</Text>
                <TouchableOpacity onPress={() => setShowInvoiceSelector(false)}>
                  <MaterialCommunityIcons name="close" size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.invoiceList}>
                {invoices.map((invoice) => {
                  const outstanding = parseFloat(invoice.total_amount) - parseFloat(invoice.paid_amount || '0')
                  return (
                    <TouchableOpacity
                      key={invoice.id}
                      style={styles.invoiceItem}
                      onPress={() => handleInvoiceSelect(invoice)}
                    >
                      <View style={styles.invoiceItemInfo}>
                        <Text style={styles.invoiceItemNumber}>{invoice.invoice_number}</Text>
                        <Text style={styles.invoiceItemClient}>{invoice.client_name}</Text>
                      </View>
                      <Text style={styles.invoiceItemAmount}>{formatCurrency(outstanding)}</Text>
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>
            </View>
          </View>
        )}

        {selectedInvoice && (
          <>
            {/* Payment Amount */}
            <View style={styles.section}>
              <Text style={styles.inputLabel}>Payment Amount *</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.input}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                />
              </View>
            </View>

            {/* Payment Date */}
            <View style={styles.section}>
              <Text style={styles.inputLabel}>Payment Date *</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
              >
                <MaterialCommunityIcons name="calendar" size={20} color="#6b7280" />
                <Text style={styles.dateButtonText}>{formatDate(paymentDate)}</Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={paymentDate}
                  mode="date"
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(false)
                    if (selectedDate) {
                      setPaymentDate(selectedDate)
                    }
                  }}
                />
              )}
            </View>

            {/* Payment Method */}
            <View style={styles.section}>
              <Text style={styles.inputLabel}>Payment Method *</Text>
              <View style={styles.methodGrid}>
                {paymentMethods.map((method) => (
                  <TouchableOpacity
                    key={method.value}
                    style={[
                      styles.methodButton,
                      paymentMethod === method.value && {
                        backgroundColor: brandColor,
                        borderColor: brandColor,
                      },
                    ]}
                    onPress={() => setPaymentMethod(method.value)}
                  >
                    <MaterialCommunityIcons
                      name={method.icon as any}
                      size={24}
                      color={paymentMethod === method.value ? '#fff' : '#6b7280'}
                    />
                    <Text
                      style={[
                        styles.methodButtonText,
                        paymentMethod === method.value && { color: '#fff' },
                      ]}
                    >
                      {method.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Reference Number */}
            <View style={styles.section}>
              <Text style={styles.inputLabel}>Reference Number</Text>
              <TextInput
                style={styles.textInput}
                value={referenceNumber}
                onChangeText={setReferenceNumber}
                placeholder="e.g., Transaction ID, Cheque #"
              />
            </View>

            {/* Notes */}
            <View style={styles.section}>
              <Text style={styles.inputLabel}>Notes</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Additional notes (optional)"
                multiline
                numberOfLines={4}
              />
            </View>

            {/* Action Buttons - Inside ScrollView */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => router.back()}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: brandColor }]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                <Text style={styles.submitButtonText}>
                  {submitting ? 'Recording...' : 'Record Payment'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
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
    padding: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 0,
    paddingBottom: 40,
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#fff',
    marginTop: 8,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#6b7280',
  },
  backButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 8,
  },
  selectedInvoiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#f9fafb',
  },
  selectedInvoiceInfo: {
    flex: 1,
  },
  invoiceNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  clientName: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginRight: 4,
  },
  amountValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 8,
    borderStyle: 'dashed',
  },
  selectButtonText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modal: {
    width: '90%',
    maxHeight: '70%',
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  invoiceList: {
    maxHeight: 400,
  },
  invoiceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  invoiceItemInfo: {
    flex: 1,
  },
  invoiceItemNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  invoiceItemClient: {
    fontSize: 14,
    color: '#6b7280',
  },
  invoiceItemAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginRight: 4,
  },
  input: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    paddingVertical: 12,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1f2937',
    backgroundColor: '#fff',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#1f2937',
    marginLeft: 8,
  },
  methodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  methodButton: {
    width: '48%',
    margin: '1%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  methodButtonText: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 8,
    fontWeight: '500',
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  submitButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
})
