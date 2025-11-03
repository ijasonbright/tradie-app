import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
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
  const [emailAddress, setEmailAddress] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailMessage, setEmailMessage] = useState('')

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

      // Pre-fill email from client
      setEmailAddress(response.quote.client_email || '')

      // Default email subject and message
      setEmailSubject(`Quote ${response.quote.quote_number} from ${response.quote.organization_name}`)
      setEmailMessage(
        `Hi ${clientName},\n\n` +
        `Please find attached your quote ${response.quote.quote_number} for $${parseFloat(response.quote.total_amount).toFixed(2)}.\n\n` +
        `${response.quote.title ? `Project: ${response.quote.title}\n\n` : ''}` +
        `Valid until: ${new Date(response.quote.valid_until_date).toLocaleDateString('en-AU')}\n\n` +
        `Thank you for considering our services!\n\n` +
        `${response.quote.organization_name}`
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
    if (!emailAddress) {
      Alert.alert('Email Required', 'Please enter an email address')
      return
    }

    try {
      setSubmitting(true)

      // Call send quote API
      await apiClient.request(`/quotes/${id}/send`, {
        method: 'POST',
        body: JSON.stringify({
          email: emailAddress,
          subject: emailSubject,
          message: emailMessage,
        }),
      })

      Alert.alert('Success', 'Quote sent successfully!', [
        { text: 'OK', onPress: () => router.back() }
      ])
    } catch (err: any) {
      console.error('Failed to send quote:', err)
      Alert.alert('Error', err.message || 'Failed to send quote')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Stack.Screen options={{ title: 'Send Quote' }} />
        <ActivityIndicator size="large" color={brandColor} />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <Stack.Screen
        options={{
          title: 'Send Quote',
          headerRight: () => (
            <TouchableOpacity onPress={handleSend} disabled={submitting}>
              <Text style={[styles.sendButton, { color: submitting ? '#9ca3af' : brandColor }]}>
                {submitting ? 'Sending...' : 'Send'}
              </Text>
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Quote Info */}
        <View style={styles.section}>
          <Text style={styles.quoteNumber}>{quote.quote_number}</Text>
          <Text style={styles.amount}>
            Total: ${parseFloat(quote.total_amount).toFixed(2)}
          </Text>
        </View>

        {/* Email Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Send via Email</Text>

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

        {/* Send Button */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.sendQuoteButton, { backgroundColor: brandColor }]}
            onPress={handleSend}
            disabled={submitting}
          >
            <MaterialCommunityIcons name="email-send" size={24} color="#fff" />
            <Text style={styles.sendQuoteButtonText}>
              {submitting ? 'Sending Quote...' : 'Send Quote via Email'}
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 40,
  },
  sendButton: {
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
    marginBottom: 4,
  },
  amount: {
    fontSize: 18,
    color: '#6b7280',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
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
  sendQuoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  sendQuoteButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
})
