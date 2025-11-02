import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native'
import { Searchbar, FAB, Chip } from 'react-native-paper'
import { useState, useEffect } from 'react'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useAuth } from '../../lib/auth'
import { apiClient } from '../../lib/api-client'

export default function InvoicesTab() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const { isSignedIn } = useAuth()
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')

  // Fetch invoices from API
  const fetchInvoices = async () => {
    try {
      setError(null)
      const response = await apiClient.getInvoices()
      console.log('Fetched invoices:', response)
      setInvoices(response.invoices || [])
    } catch (err: any) {
      console.error('Failed to fetch invoices:', err)
      setError(err.message || 'Failed to load invoices')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (isSignedIn) {
      fetchInvoices()
    }
  }, [isSignedIn])

  const onRefresh = () => {
    setRefreshing(true)
    fetchInvoices()
  }

  const filteredInvoices = invoices.filter((invoice) => {
    // Filter by status
    if (filterStatus !== 'all' && invoice.status !== filterStatus) {
      return false
    }

    // Filter by search query
    if (!searchQuery) return true

    const query = searchQuery.toLowerCase()
    return (
      invoice.invoice_number?.toLowerCase().includes(query) ||
      invoice.client_name?.toLowerCase().includes(query) ||
      invoice.total_amount?.toString().includes(query)
    )
  })

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
      default:
        return status
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const renderInvoiceCard = ({ item }: { item: any }) => {
    const statusColor = getStatusColor(item.status)

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/invoices/${item.id}`)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <Text style={styles.invoiceNumber}>{item.invoice_number}</Text>
            <Text style={styles.clientName}>{item.client_name || 'Unknown Client'}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.row}>
            <MaterialCommunityIcons name="calendar" size={16} color="#666" />
            <Text style={styles.label}>Issue Date:</Text>
            <Text style={styles.value}>{formatDate(item.issue_date)}</Text>
          </View>

          <View style={styles.row}>
            <MaterialCommunityIcons name="calendar-clock" size={16} color="#666" />
            <Text style={styles.label}>Due Date:</Text>
            <Text style={styles.value}>{formatDate(item.due_date)}</Text>
          </View>

          <View style={[styles.row, styles.totalRow]}>
            <MaterialCommunityIcons name="currency-usd" size={16} color="#111" />
            <Text style={styles.totalLabel}>Total:</Text>
            <Text style={styles.totalValue}>{formatCurrency(item.total_amount || 0)}</Text>
          </View>

          {item.paid_amount > 0 && item.status === 'partially_paid' && (
            <View style={styles.row}>
              <MaterialCommunityIcons name="cash-check" size={16} color="#10b981" />
              <Text style={styles.label}>Paid:</Text>
              <Text style={[styles.value, { color: '#10b981' }]}>
                {formatCurrency(item.paid_amount)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation()
              router.push(`/invoices/${item.id}/send`)
            }}
          >
            <MaterialCommunityIcons name="send" size={18} color="#2563eb" />
            <Text style={styles.actionText}>Send</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation()
              router.push(`/invoices/${item.id}/record-payment`)
            }}
          >
            <MaterialCommunityIcons name="cash" size={18} color="#10b981" />
            <Text style={[styles.actionText, { color: '#10b981' }]}>Record Payment</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    )
  }

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading invoices...</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorBanner}>
          <MaterialCommunityIcons name="alert-circle" size={20} color="#fff" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.filtersContainer}>
        <Searchbar
          placeholder="Search invoices..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />

        <View style={styles.chipContainer}>
          <Chip
            selected={filterStatus === 'all'}
            onPress={() => setFilterStatus('all')}
            style={styles.chip}
          >
            All
          </Chip>
          <Chip
            selected={filterStatus === 'draft'}
            onPress={() => setFilterStatus('draft')}
            style={styles.chip}
          >
            Draft
          </Chip>
          <Chip
            selected={filterStatus === 'sent'}
            onPress={() => setFilterStatus('sent')}
            style={styles.chip}
          >
            Sent
          </Chip>
          <Chip
            selected={filterStatus === 'paid'}
            onPress={() => setFilterStatus('paid')}
            style={styles.chip}
          >
            Paid
          </Chip>
          <Chip
            selected={filterStatus === 'overdue'}
            onPress={() => setFilterStatus('overdue')}
            style={styles.chip}
          >
            Overdue
          </Chip>
        </View>
      </View>

      <FlatList
        data={filteredInvoices}
        renderItem={renderInvoiceCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2563eb']}
            tintColor="#2563eb"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="receipt-text-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>
              {error ? 'Failed to load invoices' : 'No invoices found'}
            </Text>
            {error && <Text style={styles.emptySubtext}>Pull down to retry</Text>}
          </View>
        }
      />

      <FAB
        icon="plus"
        style={styles.fab}
        label="Create Invoice"
        color="#fff"
        onPress={() => Alert.alert('Coming Soon', 'Create invoice feature is coming soon!')}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
  },
  errorBanner: {
    backgroundColor: '#ef4444',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  errorText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  filtersContainer: {
    backgroundColor: '#fff',
    paddingBottom: 12,
  },
  searchbar: {
    margin: 16,
    marginBottom: 8,
    elevation: 0,
    backgroundColor: '#f5f5f5',
  },
  chipContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    height: 32,
  },
  list: {
    padding: 16,
    paddingTop: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerLeft: {
    flex: 1,
  },
  invoiceNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 4,
  },
  clientName: {
    fontSize: 14,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  cardBody: {
    gap: 8,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  label: {
    fontSize: 13,
    color: '#666',
  },
  value: {
    fontSize: 13,
    color: '#111',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111',
    marginLeft: 'auto',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563eb',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#bbb',
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#2563eb',
  },
})
