import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native'
import { Searchbar, FAB, Card } from 'react-native-paper'
import { useState, useEffect } from 'react'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useAuth } from '../../lib/auth'
import { apiClient } from '../../lib/api-client'

export default function PaymentsTab() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const { isSignedIn } = useAuth()
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState({
    today: 0,
    thisWeek: 0,
    thisMonth: 0,
  })

  // Fetch payments from API
  const fetchPayments = async () => {
    try {
      setError(null)
      const response = await apiClient.getPayments()
      console.log('Fetched payments:', response)
      setPayments(response.payments || [])
      calculateStats(response.payments || [])
    } catch (err: any) {
      console.error('Failed to fetch payments:', err)
      setError(err.message || 'Failed to load payments')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const calculateStats = (paymentsList: any[]) => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    startOfWeek.setHours(0, 0, 0, 0)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const todayTotal = paymentsList
      .filter((p) => new Date(p.payment_date) >= startOfToday)
      .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)

    const weekTotal = paymentsList
      .filter((p) => new Date(p.payment_date) >= startOfWeek)
      .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)

    const monthTotal = paymentsList
      .filter((p) => new Date(p.payment_date) >= startOfMonth)
      .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)

    setStats({
      today: todayTotal,
      thisWeek: weekTotal,
      thisMonth: monthTotal,
    })
  }

  useEffect(() => {
    if (isSignedIn) {
      fetchPayments()
    }
  }, [isSignedIn])

  const onRefresh = () => {
    setRefreshing(true)
    fetchPayments()
  }

  const filteredPayments = payments.filter((payment) => {
    if (!searchQuery) return true

    const query = searchQuery.toLowerCase()
    return (
      payment.client_name?.toLowerCase().includes(query) ||
      payment.invoice_number?.toLowerCase().includes(query) ||
      payment.payment_method?.toLowerCase().includes(query) ||
      payment.reference_number?.toLowerCase().includes(query)
    )
  })

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

  const getPaymentMethodIcon = (method: string) => {
    switch (method?.toLowerCase()) {
      case 'cash':
        return 'cash'
      case 'card':
        return 'credit-card'
      case 'bank_transfer':
      case 'bank transfer':
        return 'bank-transfer'
      case 'stripe':
        return 'credit-card-wireless'
      default:
        return 'cash-multiple'
    }
  }

  const renderPaymentCard = ({ item }: { item: any }) => {
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/invoices/${item.invoice_id}`)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons
              name={getPaymentMethodIcon(item.payment_method)}
              size={24}
              color="#10b981"
            />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.amount}>{formatCurrency(item.amount || 0)}</Text>
            <Text style={styles.clientName}>{item.client_name || 'Unknown Client'}</Text>
          </View>
          <View style={styles.dateContainer}>
            <Text style={styles.date}>{formatDate(item.payment_date)}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.row}>
            <MaterialCommunityIcons name="receipt" size={16} color="#666" />
            <Text style={styles.label}>Invoice:</Text>
            <Text style={styles.value}>{item.invoice_number || 'N/A'}</Text>
          </View>

          <View style={styles.row}>
            <MaterialCommunityIcons name="credit-card" size={16} color="#666" />
            <Text style={styles.label}>Method:</Text>
            <Text style={styles.value}>
              {item.payment_method?.replace('_', ' ')?.toUpperCase() || 'N/A'}
            </Text>
          </View>

          {item.reference_number && (
            <View style={styles.row}>
              <MaterialCommunityIcons name="pound" size={16} color="#666" />
              <Text style={styles.label}>Reference:</Text>
              <Text style={styles.value}>{item.reference_number}</Text>
            </View>
          )}

          {item.notes && (
            <View style={styles.notesRow}>
              <MaterialCommunityIcons name="note-text" size={16} color="#666" />
              <Text style={styles.notes} numberOfLines={2}>
                {item.notes}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    )
  }

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading payments...</Text>
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

      {/* Summary Cards */}
      <View style={styles.statsContainer}>
        <Card style={styles.statCard}>
          <View style={styles.statContent}>
            <Text style={styles.statLabel}>Today</Text>
            <Text style={styles.statValue}>{formatCurrency(stats.today)}</Text>
          </View>
        </Card>
        <Card style={styles.statCard}>
          <View style={styles.statContent}>
            <Text style={styles.statLabel}>This Week</Text>
            <Text style={styles.statValue}>{formatCurrency(stats.thisWeek)}</Text>
          </View>
        </Card>
        <Card style={styles.statCard}>
          <View style={styles.statContent}>
            <Text style={styles.statLabel}>This Month</Text>
            <Text style={styles.statValue}>{formatCurrency(stats.thisMonth)}</Text>
          </View>
        </Card>
      </View>

      <Searchbar
        placeholder="Search payments..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchbar}
      />

      <FlatList
        data={filteredPayments}
        renderItem={renderPaymentCard}
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
            <MaterialCommunityIcons name="cash-multiple" size={64} color="#ccc" />
            <Text style={styles.emptyText}>
              {error ? 'Failed to load payments' : 'No payments recorded'}
            </Text>
            {error && <Text style={styles.emptySubtext}>Pull down to retry</Text>}
          </View>
        }
      />

      <FAB
        icon="cash-plus"
        style={styles.fab}
        label="Record Payment"
        color="#fff"
        onPress={() => router.push('/payments/record')}
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
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    elevation: 2,
  },
  statContent: {
    padding: 16,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10b981',
  },
  searchbar: {
    marginHorizontal: 16,
    marginBottom: 8,
    elevation: 0,
    backgroundColor: '#fff',
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
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardContent: {
    flex: 1,
  },
  amount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 2,
  },
  clientName: {
    fontSize: 14,
    color: '#666',
  },
  dateContainer: {
    alignItems: 'flex-end',
  },
  date: {
    fontSize: 13,
    color: '#666',
  },
  cardBody: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 13,
    color: '#666',
  },
  value: {
    fontSize: 13,
    color: '#111',
  },
  notesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  notes: {
    flex: 1,
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
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
    backgroundColor: '#10b981',
  },
})
