import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { useState, useEffect } from 'react'
import { apiClient } from '../../../lib/api-client'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useTheme } from '../../../context/ThemeContext'
import DateTimePicker from '@react-native-community/datetimepicker'

export default function RecordPaymentScreen() {
  const { id } = useLocalSearchParams()
  const router = useRouter()
  const { brandColor } = useTheme()

  const [invoice, setInvoice] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Form fields
  const [amount, setAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    fetchInvoice()
  }, [id])

  const fetchInvoice = async () => {
    try {
      setLoading(true)
      const response = await apiClient.getInvoice(id as string)
      setInvoice(response.invoice)

      // Set default amount to outstanding balance
      const outstanding = parseFloat(response.invoice.total_amount) - parseFloat(response.invoice.paid_amount || '0')
      setAmount(outstanding.toFixed(2))
    } catch (err: any) {
      console.error('Failed to fetch invoice:', err)
      Alert.alert('Error', 'Failed to load invoice details')
      router.back()
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    // Validation
    const paymentAmount = parseFloat(amount)
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount')
      return
    }

    const outstanding = parseFloat(invoice.total_amount) - parseFloat(invoice.paid_amount || '0')
    if (paymentAmount > outstanding) {
      Alert.alert('Amount Exceeds Balance', `Payment amount cannot exceed outstanding balance of $${outstanding.toFixed(2)}`)
      return
    }

    try {
      setSubmitting(true)

      await apiClient.recordPayment(id as string, {
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
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Record Payment' }} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    )
  }

  const outstanding = parseFloat(invoice.total_amount) - parseFloat(invoice.paid_amount || '0')

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Record Payment' }} />

      <ScrollView style={styles.scrollView}>
        {/* Invoice Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Invoice Details</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.label}>Invoice Number</Text>
            <Text style={styles.value}>{invoice.invoice_number}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.label}>Client</Text>
            <Text style={styles.value}>{invoice.client_name}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.label}>Total Amount</Text>
            <Text style={styles.value}>{formatCurrency(invoice.total_amount)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.label}>Paid Amount</Text>
            <Text style={[styles.value, { color: '#10b981' }]}>{formatCurrency(invoice.paid_amount || 0)}</Text>
          </View>
          <View style={[styles.summaryRow, styles.outstandingRow]}>
            <Text style={styles.outstandingLabel}>Outstanding</Text>
            <Text style={styles.outstandingValue}>{formatCurrency(outstanding)}</Text>
          </View>
        </View>

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
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
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
  loadingText: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
    color: '#6b7280',
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
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  outstandingRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  label: {
    fontSize: 14,
    color: '#6b7280',
  },
  value: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
  },
  outstandingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  outstandingValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ef4444',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 8,
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
  actionButtons: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 12,
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
