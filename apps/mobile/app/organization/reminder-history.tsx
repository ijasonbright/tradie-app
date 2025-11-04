import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native'
import { useState, useEffect } from 'react'
import { useRouter } from 'expo-router'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { apiClient } from '../../lib/api-client'
import { Chip } from 'react-native-paper'

export default function ReminderHistoryScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [history, setHistory] = useState<any[]>([])
  const [filterType, setFilterType] = useState<'all' | 'invoice_reminder' | 'monthly_statement'>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'sent' | 'failed'>('all')

  useEffect(() => {
    fetchHistory()
  }, [filterType, filterStatus])

  const fetchHistory = async () => {
    try {
      const response = await apiClient.getReminderHistory({
        type: filterType,
        status: filterStatus,
        limit: 50,
      })
      setHistory(response.history || [])
    } catch (err: any) {
      console.error('Failed to fetch reminder history:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = () => {
    setRefreshing(true)
    fetchHistory()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered':
        return '#10b981'
      case 'failed':
        return '#ef4444'
      default:
        return '#6b7280'
    }
  }

  const getTypeIcon = (type: string) => {
    return type === 'monthly_statement' ? 'file-document-multiple' : 'bell-alert'
  }

  const getTypeLabel = (type: string) => {
    return type === 'monthly_statement' ? 'Statement' : 'Reminder'
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return `Today at ${date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}`
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return `${diffDays} days ago`
    } else {
      return date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reminder History</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Filters */}
      <View style={styles.filters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <Chip
            selected={filterType === 'all'}
            onPress={() => setFilterType('all')}
            style={styles.filterChip}
            textStyle={filterType === 'all' ? styles.filterChipTextSelected : styles.filterChipText}
          >
            All
          </Chip>
          <Chip
            selected={filterType === 'invoice_reminder'}
            onPress={() => setFilterType('invoice_reminder')}
            style={styles.filterChip}
            textStyle={filterType === 'invoice_reminder' ? styles.filterChipTextSelected : styles.filterChipText}
          >
            Invoice Reminders
          </Chip>
          <Chip
            selected={filterType === 'monthly_statement'}
            onPress={() => setFilterType('monthly_statement')}
            style={styles.filterChip}
            textStyle={filterType === 'monthly_statement' ? styles.filterChipTextSelected : styles.filterChipText}
          >
            Statements
          </Chip>
        </ScrollView>
      </View>

      <View style={styles.filters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <Chip
            selected={filterStatus === 'all'}
            onPress={() => setFilterStatus('all')}
            style={styles.filterChip}
            textStyle={filterStatus === 'all' ? styles.filterChipTextSelected : styles.filterChipText}
          >
            All Status
          </Chip>
          <Chip
            selected={filterStatus === 'sent'}
            onPress={() => setFilterStatus('sent')}
            style={styles.filterChip}
            textStyle={filterStatus === 'sent' ? styles.filterChipTextSelected : styles.filterChipText}
          >
            Sent
          </Chip>
          <Chip
            selected={filterStatus === 'failed'}
            onPress={() => setFilterStatus('failed')}
            style={styles.filterChip}
            textStyle={filterStatus === 'failed' ? styles.filterChipTextSelected : styles.filterChipText}
          >
            Failed
          </Chip>
        </ScrollView>
      </View>

      {/* History List */}
      <ScrollView
        style={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#2563eb']} />}
      >
        {history.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="email-open-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyStateTitle}>No reminders sent yet</Text>
            <Text style={styles.emptyStateText}>
              Reminders will appear here once the automated system sends them, or you manually trigger them.
            </Text>
          </View>
        ) : (
          history.map((item) => (
            <View key={item.id} style={styles.historyItem}>
              <View style={styles.historyItemHeader}>
                <View style={styles.historyItemIcon}>
                  <MaterialCommunityIcons name={getTypeIcon(item.reminderType)} size={20} color="#2563eb" />
                </View>
                <View style={styles.historyItemInfo}>
                  <Text style={styles.historyItemTitle}>{item.clientName}</Text>
                  <Text style={styles.historyItemSubtitle}>
                    {getTypeLabel(item.reminderType)} • {item.sentVia.toUpperCase()}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item.status)}15` }]}>
                  <Text style={[styles.statusBadgeText, { color: getStatusColor(item.status) }]}>
                    {item.status === 'sent' ? 'Sent' : 'Failed'}
                  </Text>
                </View>
              </View>

              <View style={styles.historyItemDetails}>
                <View style={styles.detailRow}>
                  <MaterialCommunityIcons name="clock-outline" size={14} color="#6b7280" />
                  <Text style={styles.detailText}>{formatDate(item.sentAt)}</Text>
                </View>

                {item.invoiceAmount && (
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons name="currency-usd" size={14} color="#6b7280" />
                    <Text style={styles.detailText}>${item.invoiceAmount}</Text>
                  </View>
                )}

                {item.daysBeforeDue !== null && item.daysBeforeDue > 0 && (
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons name="calendar-clock" size={14} color="#6b7280" />
                    <Text style={styles.detailText}>{item.daysBeforeDue} days before due</Text>
                  </View>
                )}

                {item.daysBeforeDue !== null && item.daysBeforeDue < 0 && (
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons name="alert-circle" size={14} color="#ef4444" />
                    <Text style={[styles.detailText, { color: '#ef4444' }]}>
                      {Math.abs(item.daysBeforeDue)} days overdue
                    </Text>
                  </View>
                )}

                {item.creditsUsed > 0 && (
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons name="message-text" size={14} color="#6b7280" />
                    <Text style={styles.detailText}>{item.creditsUsed} SMS credit{item.creditsUsed === 1 ? '' : 's'}</Text>
                  </View>
                )}
              </View>

              {item.recipientEmail && (
                <Text style={styles.recipientText}>
                  <MaterialCommunityIcons name="email" size={12} color="#9ca3af" /> {item.recipientEmail}
                </Text>
              )}
              {item.recipientPhone && (
                <Text style={styles.recipientText}>
                  <MaterialCommunityIcons name="phone" size={12} color="#9ca3af" /> {item.recipientPhone}
                </Text>
              )}

              {item.errorMessage && (
                <View style={styles.errorBox}>
                  <MaterialCommunityIcons name="alert" size={16} color="#ef4444" />
                  <Text style={styles.errorText}>{item.errorMessage}</Text>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  filters: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterScroll: {
    gap: 8,
  },
  filterChip: {
    backgroundColor: '#f3f4f6',
  },
  filterChipText: {
    color: '#6b7280',
  },
  filterChipTextSelected: {
    color: '#2563eb',
  },
  list: {
    flex: 1,
  },
  historyItem: {
    backgroundColor: '#fff',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  historyItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  historyItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  historyItemInfo: {
    flex: 1,
  },
  historyItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  historyItemSubtitle: {
    fontSize: 13,
    color: '#6b7280',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  historyItemDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 13,
    color: '#6b7280',
  },
  recipientText: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fef2f2',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: '#ef4444',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
    marginTop: 64,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
})
