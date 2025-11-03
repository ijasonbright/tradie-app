import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { useState, useEffect } from 'react'
import { apiClient } from '../../lib/api-client'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useTheme } from '../../context/ThemeContext'

export default function QuoteDetailScreen() {
  const { id } = useLocalSearchParams()
  const router = useRouter()
  const { brandColor } = useTheme()

  const [quote, setQuote] = useState<any>(null)
  const [lineItems, setLineItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchQuote()
  }, [id])

  const fetchQuote = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await apiClient.getQuote(id as string)
      setQuote(response.quote)
      setLineItems(response.lineItems || [])
    } catch (err: any) {
      console.error('Failed to fetch quote:', err)
      setError(err.message || 'Failed to load quote details')
      Alert.alert('Error', 'Failed to load quote details')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted': return '#10b981'
      case 'sent': return '#3b82f6'
      case 'rejected': return '#ef4444'
      case 'expired': return '#f59e0b'
      case 'draft': return '#6b7280'
      default: return '#6b7280'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'accepted': return 'Accepted'
      case 'sent': return 'Sent'
      case 'rejected': return 'Rejected'
      case 'expired': return 'Expired'
      case 'draft': return 'Draft'
      default: return status
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    return `$${num.toFixed(2)}`
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Stack.Screen options={{ title: 'Quote Details' }} />
        <ActivityIndicator size="large" color={brandColor} />
      </View>
    )
  }

  if (error || !quote) {
    return (
      <View style={styles.centerContainer}>
        <Stack.Screen options={{ title: 'Quote Details' }} />
        <MaterialCommunityIcons name="alert-circle" size={64} color="#ef4444" />
        <Text style={styles.errorText}>{error || 'Quote not found'}</Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: brandColor }]}
          onPress={fetchQuote}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: quote.quote_number || 'Quote',
          headerRight: () => (
            <TouchableOpacity onPress={() => router.push(`/quotes/${id}/edit`)}>
              <MaterialCommunityIcons name="pencil" size={24} color={brandColor} />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView style={styles.scrollView}>
        {/* Status Badge */}
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(quote.status) }]}>
            <Text style={styles.statusText}>{getStatusLabel(quote.status)}</Text>
          </View>
        </View>

        {/* Quote Header */}
        <View style={styles.section}>
          <Text style={styles.quoteNumber}>{quote.quote_number}</Text>
          <Text style={styles.clientName}>{quote.client_name || 'Unknown Client'}</Text>
          {quote.title && <Text style={styles.quoteTitle}>{quote.title}</Text>}
        </View>

        {/* Valid Until */}
        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.dateItem}>
              <Text style={styles.label}>Valid Until</Text>
              <Text style={styles.value}>{formatDate(quote.valid_until_date)}</Text>
            </View>
            {quote.sent_at && (
              <View style={styles.dateItem}>
                <Text style={styles.label}>Sent Date</Text>
                <Text style={styles.value}>{formatDate(quote.sent_at)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Line Items */}
        {lineItems && lineItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Line Items</Text>
            {lineItems.map((item: any, index: number) => (
              <View key={item.id || index} style={styles.lineItem}>
                <View style={styles.lineItemHeader}>
                  <Text style={styles.lineItemDescription}>{item.description}</Text>
                </View>
                <View style={styles.lineItemDetails}>
                  <Text style={styles.lineItemQuantity}>
                    {parseFloat(item.quantity).toFixed(2)} × {formatCurrency(item.unit_price)}
                  </Text>
                  <Text style={styles.lineItemTotal}>{formatCurrency(item.line_total)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Amounts */}
        <View style={styles.section}>
          <View style={styles.amountRow}>
            <Text style={styles.label}>Subtotal</Text>
            <Text style={styles.value}>{formatCurrency(quote.subtotal)}</Text>
          </View>
          <View style={styles.amountRow}>
            <Text style={styles.label}>GST (10%)</Text>
            <Text style={styles.value}>{formatCurrency(quote.gst_amount)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.amountRow}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>{formatCurrency(quote.total_amount)}</Text>
          </View>
        </View>

        {/* Description */}
        {quote.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.descriptionText}>{quote.description}</Text>
          </View>
        )}

        {/* Notes */}
        {quote.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>{quote.notes}</Text>
          </View>
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        {quote.status !== 'accepted' && quote.status !== 'rejected' && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: brandColor }]}
            onPress={() => router.push(`/quotes/${id}/send`)}
          >
            <MaterialCommunityIcons name="send" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>
              {quote.status === 'draft' ? 'Send Quote' : 'Resend Quote'}
            </Text>
          </TouchableOpacity>
        )}

        {quote.status === 'accepted' && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: brandColor }]}
            onPress={() => Alert.alert('Convert to Job', 'This feature will be available soon')}
          >
            <MaterialCommunityIcons name="briefcase-plus" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Convert to Job</Text>
          </TouchableOpacity>
        )}
      </View>
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
    padding: 20,
  },
  scrollView: {
    flex: 1,
  },
  statusContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
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
    marginBottom: 4,
  },
  quoteTitle: {
    fontSize: 16,
    color: '#1f2937',
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dateItem: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  lineItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  lineItemHeader: {
    marginBottom: 6,
  },
  lineItemDescription: {
    fontSize: 15,
    color: '#1f2937',
    fontWeight: '500',
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
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
  descriptionText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  notesText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  actionButtons: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
})
