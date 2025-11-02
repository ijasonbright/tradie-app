import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Switch, KeyboardAvoidingView, Platform } from 'react-native'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { useState, useEffect } from 'react'
import { apiClient } from '../../../lib/api-client'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useTheme } from '../../../context/ThemeContext'

export default function SendInvoiceScreen() {
  const { id } = useLocalSearchParams()
  const router = useRouter()
  const { brandColor } = useTheme()

  const [invoice, setInvoice] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Form fields
  const [sendViaEmail, setSendViaEmail] = useState(true)
  const [sendViaSMS, setSendViaSMS] = useState(false)
  const [emailAddress, setEmailAddress] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailMessage, setEmailMessage] = useState('')
  const [smsMessage, setSmsMessage] = useState('')

  useEffect(() => {
    fetchInvoice()
  }, [id])

  const fetchInvoice = async () => {
    try {
      setLoading(true)
      const response = await apiClient.getInvoice(id as string)
      setInvoice(response.invoice)

      // Pre-fill email and phone from client
      setEmailAddress(response.invoice.client_email || '')
      setPhoneNumber(response.invoice.client_phone || response.invoice.client_mobile || '')

      // Default email subject and message
      setEmailSubject(`Invoice ${response.invoice.invoice_number} from ${response.invoice.organization_name}`)
      setEmailMessage(
        `Hi ${response.invoice.client_name},\n\n` +
        `Please find attached your invoice ${response.invoice.invoice_number} for $${parseFloat(response.invoice.total_amount).toFixed(2)}.\n\n` +
        `Due date: ${new Date(response.invoice.due_date).toLocaleDateString('en-AU')}\n\n` +
        `Thank you for your business!\n\n` +
        `${response.invoice.organization_name}`
      )

      // Default SMS message
      setSmsMessage(
        `Hi ${response.invoice.client_name}, your invoice ${response.invoice.invoice_number} for $${parseFloat(response.invoice.total_amount).toFixed(2)} is ready. View it here: [link]`
      )
    } catch (err: any) {
      console.error('Failed to fetch invoice:', err)
      Alert.alert('Error', 'Failed to load invoice details')
      router.back()
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async () => {
    // Validation
    if (!sendViaEmail && !sendViaSMS) {
      Alert.alert('Select Method', 'Please select at least one method to send the invoice')
      return
    }

    if (sendViaEmail && !emailAddress) {
      Alert.alert('Email Required', 'Please enter an email address')
      return
    }

    if (sendViaSMS && !phoneNumber) {
      Alert.alert('Phone Required', 'Please enter a phone number')
      return
    }

    try {
      setSubmitting(true)

      // Update invoice status to 'sent' if it's currently draft
      if (invoice.status === 'draft') {
        await apiClient.updateInvoice(id as string, { status: 'sent' })
      }

      // Send via email
      if (sendViaEmail) {
        await apiClient.sendInvoiceEmail(id as string, {
          email: emailAddress,
          subject: emailSubject,
          message: emailMessage,
        })
      }

      // Send via SMS
      if (sendViaSMS) {
        await apiClient.sendInvoiceSMS(id as string, {
          phone: phoneNumber,
          message: smsMessage,
        })
      }

      Alert.alert(
        'Success',
        `Invoice sent successfully via ${sendViaEmail && sendViaSMS ? 'email and SMS' : sendViaEmail ? 'email' : 'SMS'}`,
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      )
    } catch (err: any) {
      console.error('Failed to send invoice:', err)
      Alert.alert('Error', err.message || 'Failed to send invoice')
    } finally {
      setSubmitting(false)
    }
  }

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    return `$${num.toFixed(2)}`
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Send Invoice' }} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    )
  }

  const smsCharCount = smsMessage.length
  const smsCredits = Math.ceil(smsCharCount / 160)

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <Stack.Screen options={{ title: 'Send Invoice' }} />

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
            <Text style={styles.label}>Amount</Text>
            <Text style={styles.value}>{formatCurrency(invoice.total_amount)}</Text>
          </View>
        </View>

        {/* Send Method Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Send Via</Text>

          <View style={styles.methodRow}>
            <View style={styles.methodInfo}>
              <MaterialCommunityIcons name="email" size={24} color={brandColor} />
              <Text style={styles.methodLabel}>Email (Free)</Text>
            </View>
            <Switch
              value={sendViaEmail}
              onValueChange={setSendViaEmail}
              trackColor={{ false: '#d1d5db', true: brandColor }}
            />
          </View>

          <View style={styles.methodRow}>
            <View style={styles.methodInfo}>
              <MaterialCommunityIcons name="message-text" size={24} color={brandColor} />
              <Text style={styles.methodLabel}>SMS ({smsCredits} credit{smsCredits !== 1 ? 's' : ''})</Text>
            </View>
            <Switch
              value={sendViaSMS}
              onValueChange={setSendViaSMS}
              trackColor={{ false: '#d1d5db', true: brandColor }}
            />
          </View>
        </View>

        {/* Email Section */}
        {sendViaEmail && (
          <>
            <View style={styles.section}>
              <Text style={styles.inputLabel}>Email Address *</Text>
              <TextInput
                style={styles.textInput}
                value={emailAddress}
                onChangeText={setEmailAddress}
                placeholder="client@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.inputLabel}>Subject *</Text>
              <TextInput
                style={styles.textInput}
                value={emailSubject}
                onChangeText={setEmailSubject}
                placeholder="Invoice subject"
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.inputLabel}>Message *</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={emailMessage}
                onChangeText={setEmailMessage}
                placeholder="Email message"
                multiline
                numberOfLines={6}
              />
            </View>
          </>
        )}

        {/* SMS Section */}
        {sendViaSMS && (
          <View style={styles.section}>
            <Text style={styles.inputLabel}>Phone Number *</Text>
            <TextInput
              style={styles.textInput}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="+61 400 000 000"
              keyboardType="phone-pad"
            />

            <Text style={[styles.inputLabel, { marginTop: 16 }]}>SMS Message *</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={smsMessage}
              onChangeText={setSmsMessage}
              placeholder="SMS message"
              multiline
              numberOfLines={4}
            />
            <Text style={styles.charCount}>
              {smsCharCount} characters ({smsCredits} SMS credit{smsCredits !== 1 ? 's' : ''})
            </Text>
          </View>
        )}

        {/* Note */}
        <View style={styles.noteContainer}>
          <MaterialCommunityIcons name="information" size={20} color="#3b82f6" />
          <Text style={styles.noteText}>
            {invoice.status === 'draft'
              ? 'The invoice status will be updated to "Sent" after sending.'
              : 'A copy of the invoice will be sent to the recipient(s).'}
          </Text>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: brandColor }]}
          onPress={handleSend}
          disabled={submitting}
        >
          <MaterialCommunityIcons name="send" size={20} color="#fff" />
          <Text style={styles.submitButtonText}>
            {submitting ? 'Sending...' : 'Send Invoice'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
  label: {
    fontSize: 14,
    color: '#6b7280',
  },
  value: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
  },
  methodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  methodInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  methodLabel: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 8,
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
  charCount: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'right',
  },
  noteContainer: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
    gap: 8,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    color: '#3b82f6',
    lineHeight: 18,
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
    flex: 2,
    flexDirection: 'row',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
})
