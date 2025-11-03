import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Switch, KeyboardAvoidingView, Platform } from 'react-native'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { useState, useEffect } from 'react'
import { apiClient } from '../../../lib/api-client'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useTheme } from '../../../context/ThemeContext'

export default function SendQuoteScreen() {
  const { id } = useLocalSearchParams()
  const router = useRouter()
  const { brandColor } = useTheme()

  const [quote, setQuote] = useState<any>(null)
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

  const formatPhoneNumber = (phone: string): string => {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '')

    // If starts with 0, assume Australian number and add country code
    if (cleaned.startsWith('0')) {
      cleaned = '61' + cleaned.substring(1)
    }

    // Add + prefix if not present
    if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned
    }

    return cleaned
  }

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

      // Build client name
      const clientName = response.quote.is_company && response.quote.company_name
        ? response.quote.company_name
        : [response.quote.first_name, response.quote.last_name].filter(Boolean).join(' ') || 'Unknown Client'

      // Pre-fill email and phone from client
      setEmailAddress(response.quote.client_email || '')
      const rawPhone = response.quote.client_phone || response.quote.client_mobile || ''
      setPhoneNumber(rawPhone ? formatPhoneNumber(rawPhone) : '')

      // Generate public quote link
      const quoteLink = `https://tradie-app-web.vercel.app/public/quotes/${response.quote.public_token}`

      // Default email subject and message
      setEmailSubject(`Quote ${response.quote.quote_number} from ${response.quote.organization_name}`)
      setEmailMessage(
        `Hi ${clientName},\n\n` +
        `Please find attached your quote ${response.quote.quote_number} for $${parseFloat(response.quote.total_amount).toFixed(2)}.\n\n` +
        `${response.quote.title ? `Project: ${response.quote.title}\n\n` : ''}` +
        `Valid until: ${new Date(response.quote.valid_until_date).toLocaleDateString('en-AU')}\n\n` +
        `View and approve your quote online: ${quoteLink}\n\n` +
        `Thank you for considering our services!\n\n` +
        `${response.quote.organization_name}`
      )

      // Default SMS message with actual link
      setSmsMessage(
        `Hi ${clientName}, your quote ${response.quote.quote_number} for $${parseFloat(response.quote.total_amount).toFixed(2)} is ready. View and approve it here: ${quoteLink}`
      )
    } catch (err: any) {
      console.error('Failed to fetch quote:', err)
      Alert.alert('Error', 'Failed to load quote details')
      router.back()
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async () => {
    // Validation
    if (!sendViaEmail && !sendViaSMS) {
      Alert.alert('Select Method', 'Please select at least one method to send the quote')
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

      // Update quote status to 'sent' if it's currently draft
      if (quote.status === 'draft') {
        await apiClient.updateQuote(id as string, { status: 'sent' })
      }

      // Send via email
      if (sendViaEmail) {
        await apiClient.request(`/quotes/${id}/send`, {
          method: 'POST',
          body: JSON.stringify({
            email: emailAddress,
            subject: emailSubject,
            message: emailMessage,
          }),
        })
      }

      // Send via SMS (auto-format phone number)
      if (sendViaSMS) {
        const formattedPhone = formatPhoneNumber(phoneNumber)
        await apiClient.sendQuoteSMS(id as string, {
          phone: formattedPhone,
          message: smsMessage,
        })
      }

      Alert.alert(
        'Success',
        `Quote sent successfully via ${sendViaEmail && sendViaSMS ? 'email and SMS' : sendViaEmail ? 'email' : 'SMS'}`,
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      )
    } catch (err: any) {
      console.error('Failed to send quote:', err)
      Alert.alert('Error', err.message || 'Failed to send quote')
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
        <Stack.Screen options={{ title: 'Send Quote' }} />
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
      <Stack.Screen options={{ title: 'Send Quote' }} />

      <ScrollView style={styles.scrollView}>
        {/* Quote Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quote Details</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.label}>Quote Number</Text>
            <Text style={styles.value}>{quote.quote_number}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.label}>Client</Text>
            <Text style={styles.value}>
              {quote.is_company && quote.company_name
                ? quote.company_name
                : [quote.first_name, quote.last_name].filter(Boolean).join(' ') || 'Unknown Client'}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.label}>Amount</Text>
            <Text style={styles.value}>{formatCurrency(quote.total_amount)}</Text>
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
              thumbColor="#fff"
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
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Email Section */}
        {sendViaEmail && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Email Details</Text>

            <Text style={styles.fieldLabel}>Email Address</Text>
            <TextInput
              style={styles.input}
              value={emailAddress}
              onChangeText={setEmailAddress}
              placeholder="client@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.fieldLabel}>Subject</Text>
            <TextInput
              style={styles.input}
              value={emailSubject}
              onChangeText={setEmailSubject}
              placeholder="Quote subject"
            />

            <Text style={styles.fieldLabel}>Message</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={emailMessage}
              onChangeText={setEmailMessage}
              placeholder="Email message"
              multiline
              numberOfLines={8}
            />
          </View>
        )}

        {/* SMS Section */}
        {sendViaSMS && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SMS Details</Text>

            <Text style={styles.fieldLabel}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="+61 4XX XXX XXX"
              keyboardType="phone-pad"
            />

            <Text style={styles.fieldLabel}>Message</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={smsMessage}
              onChangeText={setSmsMessage}
              placeholder="SMS message"
              multiline
              numberOfLines={4}
              maxLength={480}
            />
            <Text style={styles.charCount}>
              {smsCharCount} characters • {smsCredits} credit{smsCredits !== 1 ? 's' : ''} (${(smsCredits * 0.05).toFixed(2)})
            </Text>
          </View>
        )}

        {/* Send Button */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: brandColor }]}
            onPress={handleSend}
            disabled={submitting}
          >
            <MaterialCommunityIcons
              name={sendViaEmail && sendViaSMS ? 'send' : sendViaEmail ? 'email-send' : 'message-text'}
              size={24}
              color="#fff"
            />
            <Text style={styles.sendButtonText}>
              {submitting
                ? 'Sending Quote...'
                : `Send Quote via ${sendViaEmail && sendViaSMS ? 'Email & SMS' : sendViaEmail ? 'Email' : 'SMS'}`}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 20,
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
  summaryRow: {
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
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
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
    minHeight: 120,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'right',
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
})
