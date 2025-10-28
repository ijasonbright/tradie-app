import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native'
import { Chip, Searchbar, FAB } from 'react-native-paper'
import { useState } from 'react'
import { MaterialCommunityIcons } from '@expo/vector-icons'

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

  const filteredJobs = MOCK_JOBS.filter(
    (job) =>
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.jobNumber.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const renderJobCard = ({ item }: { item: typeof MOCK_JOBS[0] }) => (
    <TouchableOpacity style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.jobNumber}>{item.jobNumber}</Text>
          <Chip
            mode="flat"
            style={[styles.priorityChip, { backgroundColor: PRIORITY_COLORS[item.priority] }]}
            textStyle={styles.chipText}
          >
            {item.priority.toUpperCase()}
          </Chip>
        </View>
        <Chip
          mode="flat"
          style={[styles.statusChip, { backgroundColor: STATUS_COLORS[item.status] }]}
          textStyle={styles.chipText}
        >
          {item.status.replace('_', ' ').toUpperCase()}
        </Chip>
      </View>

      <Text style={styles.title}>{item.title}</Text>

      <View style={styles.row}>
        <MaterialCommunityIcons name="account" size={16} color="#666" />
        <Text style={styles.info}>{item.client}</Text>
      </View>

      <View style={styles.row}>
        <MaterialCommunityIcons name="map-marker" size={16} color="#666" />
        <Text style={styles.info}>{item.address}</Text>
      </View>

      <View style={styles.row}>
        <MaterialCommunityIcons name="calendar" size={16} color="#666" />
        <Text style={styles.info}>
          {new Date(item.scheduledDate).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  )

  return (
    <View style={styles.container}>
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
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="briefcase-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No jobs found</Text>
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
    height: 24,
  },
  statusChip: {
    height: 24,
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
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#2563eb',
  },
})
