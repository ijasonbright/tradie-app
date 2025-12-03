import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native'
import { Searchbar, FAB, Chip } from 'react-native-paper'
import { useState, useEffect } from 'react'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAuth } from '../../lib/auth'
import { apiClient } from '../../lib/api-client'

// Mock data for now - will be replaced with API calls
const MOCK_JOBS = [
  {
    id: '1',
    jobNumber: 'JOB-2025-001',
    title: 'Kitchen Renovation',
    client: 'John Smith',
    status: 'in_progress',
    priority: 'high',
    scheduledDate: '2025-01-15',
    address: '123 Main St, Sydney',
  },
  {
    id: '2',
    jobNumber: 'JOB-2025-002',
    title: 'Bathroom Plumbing',
    client: 'Jane Doe',
    status: 'scheduled',
    priority: 'medium',
    scheduledDate: '2025-01-16',
    address: '456 Oak Ave, Melbourne',
  },
  {
    id: '3',
    jobNumber: 'JOB-2025-003',
    title: 'Electrical Inspection',
    client: 'ABC Company',
    status: 'quoted',
    priority: 'low',
    scheduledDate: '2025-01-20',
    address: '789 Pine Rd, Brisbane',
  },
]

const STATUS_COLORS: Record<string, string> = {
  quoted: '#9333ea',
  scheduled: '#2563eb',
  in_progress: '#ea580c',
  completed: '#16a34a',
  invoiced: '#0891b2',
  // Asset register statuses
  CREATED: '#9333ea',
  ASSIGNED: '#2563eb',
  SCHEDULED: '#2563eb',
  IN_PROGRESS: '#ea580c',
  COMPLETED: '#16a34a',
  CANCELLED: '#64748b',
}

const PRIORITY_COLORS: Record<string, string> = {
  low: '#64748b',
  medium: '#f59e0b',
  high: '#ef4444',
  urgent: '#dc2626',
  // Asset register priorities (uppercase)
  LOW: '#64748b',
  MEDIUM: '#f59e0b',
  HIGH: '#ef4444',
}

const STORAGE_KEY = '@jobs_filter_status'
const DEFAULT_FILTERS = ['scheduled', 'in_progress'] // Default to scheduled and in progress

export default function JobsScreen() {
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
      // If "All" is clicked, clear all filters
      updateSelectedStatuses([])
    } else {
      // Toggle individual status
      const newStatuses = selectedStatuses.includes(status)
        ? selectedStatuses.filter(s => s !== status)
        : [...selectedStatuses, status]
      updateSelectedStatuses(newStatuses)
    }
  }

  // Fetch jobs from API
  const fetchJobs = async () => {
    try {
      setError(null)
      const response = await apiClient.getJobs()
      console.log('Fetched jobs:', response)
      setJobs(response.jobs || [])
    } catch (err: any) {
      console.error('Failed to fetch jobs:', err)
      setError(err.message || 'Failed to load jobs')
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

  // Map asset register status to job status for filtering
  const mapArStatusToJobStatus = (arStatus: string): string => {
    const mapping: Record<string, string> = {
      'CREATED': 'quoted',
      'ASSIGNED': 'quoted',
      'SCHEDULED': 'scheduled',
      'IN_PROGRESS': 'in_progress',
      'COMPLETED': 'completed',
    }
    return mapping[arStatus] || arStatus.toLowerCase()
  }

  const filteredJobs = jobs
    .filter((job) => {
      // Filter by status - if no statuses selected, show all
      if (selectedStatuses.length > 0) {
        // For asset register jobs, map status to job equivalent
        const effectiveStatus = job.record_type === 'asset_register'
          ? mapArStatusToJobStatus(job.status)
          : job.status
        if (!selectedStatuses.includes(effectiveStatus)) {
          return false
        }
      }

      // Filter by search query
      if (!searchQuery) return true

      const query = searchQuery.toLowerCase()
      const clientName = job.is_company
        ? job.company_name
        : `${job.first_name || ''} ${job.last_name || ''}`.trim()

      // For asset register, also search address
      const address = `${job.site_address_line1 || ''} ${job.site_city || ''} ${job.site_state || ''}`.toLowerCase()

      return (
        job.title?.toLowerCase().includes(query) ||
        job.job_number?.toLowerCase().includes(query) ||
        clientName?.toLowerCase().includes(query) ||
        address.includes(query)
      )
    })
    .sort((a, b) => {
      // Sort by scheduled_date (earliest first)
      if (!a.scheduled_date && !b.scheduled_date) return 0
      if (!a.scheduled_date) return 1
      if (!b.scheduled_date) return -1
      return new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
    })

  const renderJobCard = ({ item }: { item: any }) => {
    const isAssetRegister = item.record_type === 'asset_register'

    // Build client name from database fields
    const clientName = item.is_company
      ? item.company_name
      : `${item.first_name || ''} ${item.last_name || ''}`.trim()

    // Build address from database fields
    const address = [
      item.site_address_line1,
      item.site_city,
      item.site_state
    ].filter(Boolean).join(', ') || 'No address'

    // Format date and time safely
    const scheduledDateTime = (() => {
      if (!item.scheduled_date) return 'Not scheduled'

      const date = new Date(item.scheduled_date).toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })

      if (item.scheduled_start_time) {
        const startTime = new Date(item.scheduled_start_time).toLocaleTimeString('en-AU', {
          hour: '2-digit',
          minute: '2-digit'
        })

        if (item.scheduled_end_time) {
          const endTime = new Date(item.scheduled_end_time).toLocaleTimeString('en-AU', {
            hour: '2-digit',
            minute: '2-digit'
          })
          return `${date} • ${startTime}-${endTime}`
        }
        return `${date} • ${startTime}`
      }

      return date
    })()

    // Get priority and status with fallbacks
    const priority = (item.priority || 'medium') as keyof typeof PRIORITY_COLORS
    const status = (item.status || 'quoted') as keyof typeof STATUS_COLORS

    // Route to asset register detail for asset register jobs
    const handlePress = () => {
      if (isAssetRegister) {
        router.push(`/asset-register/${item.id}`)
      } else {
        router.push(`/job/${item.id}`)
      }
    }

    return (
      <TouchableOpacity
        style={[styles.card, isAssetRegister && styles.assetRegisterCard]}
        onPress={handlePress}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.jobNumber}>{item.job_number || 'N/A'}</Text>
            {isAssetRegister && (
              <View style={styles.assetRegisterBadge}>
                <MaterialCommunityIcons name="clipboard-list" size={12} color="#fff" />
              </View>
            )}
            <View style={[styles.priorityChip, { backgroundColor: PRIORITY_COLORS[priority] || PRIORITY_COLORS.medium }]}>
              <Text style={styles.chipText}>{String(priority).toUpperCase()}</Text>
            </View>
          </View>
          <View style={[styles.statusChip, { backgroundColor: STATUS_COLORS[status] || STATUS_COLORS.quoted }]}>
            <Text style={styles.chipText}>{String(status).replace('_', ' ').toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.titleRow}>
          {isAssetRegister && (
            <MaterialCommunityIcons name="clipboard-list" size={20} color="#16a34a" style={{ marginRight: 8 }} />
          )}
          <Text style={[styles.title, isAssetRegister && styles.assetRegisterTitle]}>
            {item.title || 'Untitled Job'}
          </Text>
        </View>

        <View style={styles.row}>
          <MaterialCommunityIcons name={isAssetRegister ? "home" : "account"} size={16} color="#666" />
          <Text style={styles.info}>{isAssetRegister ? address : (clientName || 'No client')}</Text>
        </View>

        {!isAssetRegister && (
          <View style={styles.row}>
            <MaterialCommunityIcons name="map-marker" size={16} color="#666" />
            <Text style={styles.info}>{address}</Text>
          </View>
        )}

        <View style={styles.row}>
          <MaterialCommunityIcons name="calendar" size={16} color="#666" />
          <Text style={styles.info}>{scheduledDateTime}</Text>
        </View>

        {item.assigned_to_name && (
          <View style={styles.row}>
            <MaterialCommunityIcons name="account-check" size={16} color="#666" />
            <Text style={styles.info}>Assigned: {item.assigned_to_name}</Text>
          </View>
        )}
      </TouchableOpacity>
    )
  }

  // Show loading spinner while fetching jobs
  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading jobs...</Text>
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
          placeholder="Search jobs..."
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
            selected={selectedStatuses.includes('quoted')}
            onPress={() => toggleStatus('quoted')}
            style={styles.chip}
          >
            Quoted
          </Chip>
          <Chip
            selected={selectedStatuses.includes('scheduled')}
            onPress={() => toggleStatus('scheduled')}
            style={styles.chip}
          >
            Scheduled
          </Chip>
          <Chip
            selected={selectedStatuses.includes('in_progress')}
            onPress={() => toggleStatus('in_progress')}
            style={styles.chip}
          >
            In Progress
          </Chip>
          <Chip
            selected={selectedStatuses.includes('completed')}
            onPress={() => toggleStatus('completed')}
            style={styles.chip}
          >
            Completed
          </Chip>
          <Chip
            selected={selectedStatuses.includes('invoiced')}
            onPress={() => toggleStatus('invoiced')}
            style={styles.chip}
          >
            Invoiced
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
            <MaterialCommunityIcons name="briefcase-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>
              {error ? 'Failed to load jobs' : 'No jobs found'}
            </Text>
            {error && (
              <Text style={styles.emptySubtext}>Pull down to retry</Text>
            )}
          </View>
        }
      />

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => router.push('/job/add')}
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
    paddingTop: 0,
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
  jobNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111',
    flex: 1,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  info: {
    fontSize: 14,
    color: '#666',
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
  assetRegisterCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#16a34a',
  },
  assetRegisterBadge: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
  },
  assetRegisterTitle: {
    color: '#16a34a',
  },
})
