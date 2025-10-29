import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native'
import { Searchbar, FAB } from 'react-native-paper'
import { useState, useEffect } from 'react'
import { MaterialCommunityIcons } from '@expo/vector-icons'
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
}

const PRIORITY_COLORS: Record<string, string> = {
  low: '#64748b',
  medium: '#f59e0b',
  high: '#ef4444',
  urgent: '#dc2626',
}

export default function JobsScreen() {
  const [searchQuery, setSearchQuery] = useState('')
  const { isSignedIn } = useAuth()
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const filteredJobs = jobs.filter((job) => {
    if (!searchQuery) return true

    const query = searchQuery.toLowerCase()
    const clientName = job.is_company
      ? job.company_name
      : `${job.first_name || ''} ${job.last_name || ''}`.trim()

    return (
      job.title?.toLowerCase().includes(query) ||
      job.job_number?.toLowerCase().includes(query) ||
      clientName?.toLowerCase().includes(query)
    )
  })

  const renderJobCard = ({ item }: { item: any }) => {
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

    // Format date safely
    const scheduledDate = item.scheduled_date
      ? new Date(item.scheduled_date).toLocaleDateString()
      : 'Not scheduled'

    // Get priority and status with fallbacks
    const priority = (item.priority || 'medium') as keyof typeof PRIORITY_COLORS
    const status = (item.status || 'quoted') as keyof typeof STATUS_COLORS

    return (
      <TouchableOpacity style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.jobNumber}>{item.job_number || 'N/A'}</Text>
            <View style={[styles.priorityChip, { backgroundColor: PRIORITY_COLORS[priority] }]}>
              <Text style={styles.chipText}>{priority.toUpperCase()}</Text>
            </View>
          </View>
          <View style={[styles.statusChip, { backgroundColor: STATUS_COLORS[status] }]}>
            <Text style={styles.chipText}>{status.replace('_', ' ').toUpperCase()}</Text>
          </View>
        </View>

        <Text style={styles.title}>{item.title || 'Untitled Job'}</Text>

        <View style={styles.row}>
          <MaterialCommunityIcons name="account" size={16} color="#666" />
          <Text style={styles.info}>{clientName || 'No client'}</Text>
        </View>

        <View style={styles.row}>
          <MaterialCommunityIcons name="map-marker" size={16} color="#666" />
          <Text style={styles.info}>{address}</Text>
        </View>

        <View style={styles.row}>
          <MaterialCommunityIcons name="calendar" size={16} color="#666" />
          <Text style={styles.info}>{scheduledDate}</Text>
        </View>
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

      <Searchbar
        placeholder="Search jobs..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchbar}
      />

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
        onPress={() => alert('Create new job - Coming soon!')}
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
  searchbar: {
    margin: 16,
    elevation: 2,
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
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111',
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
})
