import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Share, Clipboard } from 'react-native'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { useState, useEffect } from 'react'
import { apiClient } from '../../lib/api-client'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useTheme } from '../../context/ThemeContext'

export default function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams()
  const router = useRouter()
  const { brandColor } = useTheme()

  const [invoice, setInvoice] = useState<any>(null)
  const [lineItems, setLineItems] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchInvoice()
  }, [id])

  const fetchInvoice = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await apiClient.getInvoice(id as string)
      setInvoice(response.invoice)
      setLineItems(response.lineItems || [])
      setPayments(response.payments || [])
    } catch (err: any) {
      console.error('Failed to fetch invoice:', err)
      setError(err.message || 'Failed to load invoice details')
      Alert.alert('Error', 'Failed to load invoice details')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return '#10b981'
      case 'sent':
        return '#3b82f6'
      case 'overdue':
        return '#ef4444'
      case 'partially_paid':
        return '#f59e0b'
      case 'draft':
        return '#6b7280'
      case 'cancelled':
        return '#dc2626'
      default:
        return '#6b7280'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'paid':
        return 'Paid'
      case 'sent':
        return 'Sent'
      case 'overdue':
        return 'Overdue'
      case 'partially_paid':
        return 'Partially Paid'
      case 'draft':
        return 'Draft'
      case 'cancelled':
        return 'Cancelled'
      default:
        return status
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
        <Stack.Screen options={{ title: 'Invoice Details' }} />
        <ActivityIndicator size="large" color={brandColor} />
      </View>
    )
  }

  if (error || !invoice) {
    return (
      <View style={styles.centerContainer}>
        <Stack.Screen options={{ title: 'Invoice Details' }} />
        <MaterialCommunityIcons name="alert-circle" size={64} color="#ef4444" />
        <Text style={styles.errorText}>{error || 'Invoice not found'}</Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: brandColor }]}
          onPress={fetchInvoice}
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
          title: invoice.invoice_number || 'Invoice',
          headerRight: () => (
            <TouchableOpacity onPress={() => Alert.alert('Edit', 'Edit invoice functionality coming soon')}>
              <MaterialCommunityIcons name="pencil" size={24} color={brandColor} />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView style={styles.scrollView}>
        {/* Status Badge */}
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(invoice.status) }]}>
            <Text style={styles.statusText}>{getStatusLabel(invoice.status)}</Text>
          </View>
        </View>

        {/* Invoice Header */}
        <View style={styles.section}>
          <Text style={styles.invoiceNumber}>{invoice.invoice_number}</Text>
          <Text style={styles.clientName}>{invoice.client_name || 'Unknown Client'}</Text>
        </View>

        {/* Dates */}
        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.dateItem}>
              <Text style={styles.label}>Issue Date</Text>
              <Text style={styles.value}>{formatDate(invoice.issue_date)}</Text>
            </View>
            <View style={styles.dateItem}>
              <Text style={styles.label}>Due Date</Text>
              <Text style={styles.value}>{formatDate(invoice.due_date)}</Text>
            </View>
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
            <Text style={styles.value}>{formatCurrency(invoice.subtotal)}</Text>
          </View>
          <View style={styles.amountRow}>
            <Text style={styles.label}>GST (10%)</Text>
            <Text style={styles.value}>{formatCurrency(invoice.gst_amount)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.amountRow}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>{formatCurrency(invoice.total_amount)}</Text>
          </View>
          {parseFloat(invoice.paid_amount || '0') > 0 && (
            <>
              <View style={styles.amountRow}>
                <Text style={styles.label}>Paid Amount</Text>
                <Text style={[styles.value, { color: '#10b981' }]}>{formatCurrency(invoice.paid_amount)}</Text>
              </View>
              <View style={styles.amountRow}>
                <Text style={styles.label}>Outstanding</Text>
                <Text style={[styles.value, { color: '#ef4444' }]}>
                  {formatCurrency(parseFloat(invoice.total_amount) - parseFloat(invoice.paid_amount || '0'))}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Notes */}
        {invoice.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>{invoice.notes}</Text>
          </View>
        )}

        {/* Payment Terms */}
        {invoice.payment_terms && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Terms</Text>
            <Text style={styles.value}>{invoice.payment_terms}</Text>
          </View>
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
          <>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: brandColor }]}
              onPress={() => router.push(`/invoices/${id}/record-payment`)}
            >
              <MaterialCommunityIcons name="cash" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Record Payment</Text>
            </TouchableOpacity>
          </>
        )}
        {invoice.status === 'draft' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={() => router.push(`/invoices/${id}/send`)}
          >
            <MaterialCommunityIcons name="send" size={20} color={brandColor} />
            <Text style={[styles.actionButtonText, { color: brandColor }]}>Send Invoice</Text>
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
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
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
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
})
