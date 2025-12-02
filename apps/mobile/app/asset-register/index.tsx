import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native'
import { Searchbar, Chip } from 'react-native-paper'
import { useState, useEffect } from 'react'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAuth } from '../../lib/auth'
import { apiClient } from '../../lib/api-client'

const STATUS_COLORS: Record<string, string> = {
  CREATED: '#9333ea',      // purple
  ASSIGNED: '#2563eb',     // blue
  SCHEDULED: '#0891b2',    // cyan
  IN_PROGRESS: '#ea580c',  // orange
  COMPLETED: '#16a34a',    // green
  CANCELLED: '#64748b',    // gray
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: '#64748b',
  MEDIUM: '#f59e0b',
  HIGH: '#ef4444',
}

const STORAGE_KEY = '@asset_register_filter_status'
const DEFAULT_FILTERS = ['CREATED', 'ASSIGNED', 'SCHEDULED', 'IN_PROGRESS']

export default function AssetRegisterJobsScreen() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const { isSignedIn } = useAuth()
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(DEFAULT_FILTERS)

  // Load saved filter preferences
  useEffect(() => {
    const loadFilterPreferences = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY)
        if (saved) {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSelectedStatuses(parsed)
          }
        }
      } catch (error) {
        console.error('Failed to load filter preferences:', error)
      }
    }
    loadFilterPreferences()
  }, [])

  // Save filter preferences whenever they change
  const updateSelectedStatuses = async (newStatuses: string[]) => {
    setSelectedStatuses(newStatuses)
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newStatuses))
    } catch (error) {
      console.error('Failed to save filter preferences:', error)
    }
  }

  // Toggle a status filter
  const toggleStatus = (status: string) => {
    if (status === 'all') {
      updateSelectedStatuses([])
    } else {
      const newStatuses = selectedStatuses.includes(status)
        ? selectedStatuses.filter(s => s !== status)
        : [...selectedStatuses, status]
      updateSelectedStatuses(newStatuses)
    }
  }

  // Fetch asset register jobs from API
  const fetchJobs = async () => {
    try {
      setError(null)
      const response = await apiClient.getAssetRegisterJobs({ assignedToMe: true })
      console.log('Fetched asset register jobs:', response)
      setJobs(response.jobs || [])
    } catch (err: any) {
      console.error('Failed to fetch asset register jobs:', err)
      setError(err.message || 'Failed to load asset register jobs')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Load jobs on mount
  useEffect(() => {
    if (isSignedIn) {
      fetchJobs()
    }
  }, [isSignedIn])

  // Pull to refresh
  const onRefresh = () => {
    setRefreshing(true)
    fetchJobs()
  }

  const filteredJobs = jobs
    .filter((job) => {
      // Filter by status
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(job.status)) {
        return false
      }

      // Filter by search query
      if (!searchQuery) return true

      const query = searchQuery.toLowerCase()
      const address = [job.address_street, job.address_suburb].filter(Boolean).join(' ')

      return (
        address.toLowerCase().includes(query) ||
        job.owner_name?.toLowerCase().includes(query) ||
        job.tenant_name?.toLowerCase().includes(query)
      )
    })
    .sort((a, b) => {
      // Sort by priority first (HIGH > MEDIUM > LOW)
      const priorityOrder = { HIGH: 1, MEDIUM: 2, LOW: 3 }
      const priorityA = priorityOrder[a.priority as keyof typeof priorityOrder] || 2
      const priorityB = priorityOrder[b.priority as keyof typeof priorityOrder] || 2
      if (priorityA !== priorityB) return priorityA - priorityB

      // Then by scheduled_date
      if (!a.scheduled_date && !b.scheduled_date) return 0
      if (!a.scheduled_date) return 1
      if (!b.scheduled_date) return -1
      return new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
    })

  const renderJobCard = ({ item }: { item: any }) => {
    // Build address
    const address = [
      item.address_street,
      item.address_suburb,
      item.address_state,
      item.address_postcode
    ].filter(Boolean).join(', ') || 'No address'

    // Format scheduled date
    const scheduledDate = item.scheduled_date
      ? new Date(item.scheduled_date).toLocaleDateString('en-AU', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        })
      : 'Not scheduled'

    const priority = (item.priority || 'MEDIUM') as keyof typeof PRIORITY_COLORS
    const status = (item.status || 'CREATED') as keyof typeof STATUS_COLORS

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/asset-register/${item.id}`)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <MaterialCommunityIcons name="clipboard-list-outline" size={20} color="#666" />
            <View style={[styles.priorityChip, { backgroundColor: PRIORITY_COLORS[priority] }]}>
              <Text style={styles.chipText}>{priority}</Text>
            </View>
          </View>
          <View style={[styles.statusChip, { backgroundColor: STATUS_COLORS[status] }]}>
            <Text style={styles.chipText}>{status.replace('_', ' ')}</Text>
          </View>
        </View>

        <Text style={styles.title}>Asset Register</Text>

        <View style={styles.row}>
          <MaterialCommunityIcons name="map-marker" size={16} color="#666" />
          <Text style={styles.info} numberOfLines={2}>{address}</Text>
        </View>

        {item.owner_name && (
          <View style={styles.row}>
            <MaterialCommunityIcons name="account" size={16} color="#666" />
            <Text style={styles.info}>Owner: {item.owner_name}</Text>
          </View>
        )}

        {item.tenant_name && (
          <View style={styles.row}>
            <MaterialCommunityIcons name="account-outline" size={16} color="#666" />
            <Text style={styles.info}>Tenant: {item.tenant_name}</Text>
          </View>
        )}

        <View style={styles.row}>
          <MaterialCommunityIcons name="calendar" size={16} color="#666" />
          <Text style={styles.info}>{scheduledDate}</Text>
        </View>
      </TouchableOpacity>
    )
  }

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading asset register jobs...</Text>
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
          placeholder="Search by address or contact..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />

        <View style={styles.chipContainer}>
          <Chip
            selected={selectedStatuses.length === 0}
            onPress={() => toggleStatus('all')}
            style={styles.chip}
          >
            All
          </Chip>
          <Chip
            selected={selectedStatuses.includes('CREATED')}
            onPress={() => toggleStatus('CREATED')}
            style={styles.chip}
          >
            Created
          </Chip>
          <Chip
            selected={selectedStatuses.includes('SCHEDULED')}
            onPress={() => toggleStatus('SCHEDULED')}
            style={styles.chip}
          >
            Scheduled
          </Chip>
          <Chip
            selected={selectedStatuses.includes('IN_PROGRESS')}
            onPress={() => toggleStatus('IN_PROGRESS')}
            style={styles.chip}
          >
            In Progress
          </Chip>
          <Chip
            selected={selectedStatuses.includes('COMPLETED')}
            onPress={() => toggleStatus('COMPLETED')}
            style={styles.chip}
          >
            Completed
          </Chip>
        </View>
      </View>

      <FlatList
        data={filteredJobs}
        renderItem={renderJobCard}
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
            <MaterialCommunityIcons name="clipboard-list-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>
              {error ? 'Failed to load jobs' : 'No asset register jobs found'}
            </Text>
            {!error && (
              <Text style={styles.emptySubtext}>
                Asset register jobs assigned to you will appear here
              </Text>
            )}
            {error && (
              <Text style={styles.emptySubtext}>Pull down to retry</Text>
            )}
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  filtersContainer: {
    backgroundColor: '#fff',
  },
  searchbar: {
    margin: 16,
    marginBottom: 0,
    elevation: 2,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    paddingTop: 8,
    gap: 8,
  },
  chip: {
    marginRight: 0,
  },
  list: {
    padding: 16,
    paddingTop: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
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
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priorityChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 4,
  },
  info: {
    fontSize: 14,
    color: '#666',
    flex: 1,
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
    textAlign: 'center',
    paddingHorizontal: 32,
  },
})
