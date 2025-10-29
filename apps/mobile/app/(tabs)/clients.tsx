import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Linking } from 'react-native'
import { Searchbar, FAB, Avatar } from 'react-native-paper'
import { useState, useEffect } from 'react'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useAuth } from '../../lib/auth'
import { apiClient } from '../../lib/api-client'

// Mock data for clients
const MOCK_CLIENTS = [
  {
    id: '1',
    name: 'John Smith',
    type: 'residential',
    email: 'john.smith@email.com',
    phone: '+61 412 345 678',
    address: '123 Main St, Sydney NSW 2000',
    activeJobs: 2,
    totalJobs: 5,
  },
  {
    id: '2',
    name: 'Jane Doe',
    type: 'residential',
    email: 'jane.doe@email.com',
    phone: '+61 423 456 789',
    address: '456 Oak Ave, Melbourne VIC 3000',
    activeJobs: 1,
    totalJobs: 3,
  },
  {
    id: '3',
    name: 'ABC Company Pty Ltd',
    type: 'commercial',
    email: 'info@abccompany.com.au',
    phone: '+61 434 567 890',
    address: '789 Pine Rd, Brisbane QLD 4000',
    activeJobs: 3,
    totalJobs: 12,
  },
  {
    id: '4',
    name: 'XYZ Builders',
    type: 'commercial',
    email: 'contact@xyzbuilders.com.au',
    phone: '+61 445 678 901',
    address: '321 Cedar St, Perth WA 6000',
    activeJobs: 0,
    totalJobs: 8,
  },
]

export default function ClientsScreen() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const { isSignedIn } = useAuth()
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch clients from API
  const fetchClients = async () => {
    try {
      setError(null)
      const response = await apiClient.getClients()
      console.log('Fetched clients:', response)
      setClients(response.clients || [])
    } catch (err: any) {
      console.error('Failed to fetch clients:', err)
      setError(err.message || 'Failed to load clients')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Load clients on mount
  useEffect(() => {
    if (isSignedIn) {
      fetchClients()
    }
  }, [isSignedIn])

  // Pull to refresh
  const onRefresh = () => {
    setRefreshing(true)
    fetchClients()
  }

  const filteredClients = clients.filter((client) => {
    if (!searchQuery) return true

    const query = searchQuery.toLowerCase()
    const clientName = client.is_company
      ? client.company_name
      : `${client.first_name || ''} ${client.last_name || ''}`.trim()

    return (
      clientName?.toLowerCase().includes(query) ||
      client.email?.toLowerCase().includes(query) ||
      client.phone?.includes(searchQuery) ||
      client.mobile?.includes(searchQuery)
    )
  })

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const handleCall = (phoneNumber: string) => {
    if (phoneNumber && phoneNumber !== 'No phone') {
      Linking.openURL(`tel:${phoneNumber}`)
    }
  }

  const handleEmail = (email: string) => {
    if (email) {
      Linking.openURL(`mailto:${email}`)
    }
  }

  const handleMessage = (phoneNumber: string) => {
    if (phoneNumber && phoneNumber !== 'No phone') {
      Linking.openURL(`sms:${phoneNumber}`)
    }
  }

  const renderClientCard = ({ item }: { item: any }) => {
    // Build client name from database fields
    const clientName = item.is_company
      ? item.company_name || 'Unnamed Company'
      : `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'Unnamed Client'

    // Build address from database fields
    const address = [
      item.site_address_line1,
      item.site_city,
      item.site_state,
      item.site_postcode
    ].filter(Boolean).join(', ') || 'No address'

    // Get contact phone (prefer mobile, fallback to phone)
    const contactPhone = item.mobile || item.phone || 'No phone'

    // Get client type
    const clientType = item.client_type || 'residential'

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/clients/${item.id}`)}
      >
        <View style={styles.cardHeader}>
          <Avatar.Text
            size={48}
            label={getInitials(clientName)}
            style={[
              styles.avatar,
              { backgroundColor: clientType === 'commercial' ? '#9333ea' : '#2563eb' },
            ]}
          />
          <View style={styles.headerInfo}>
            <Text style={styles.name}>{clientName}</Text>
            <Text style={styles.type}>
              {clientType === 'commercial' ? 'Commercial' : 'Residential'}
            </Text>
          </View>
        </View>

        <View style={styles.contactInfo}>
          {item.email && (
            <View style={styles.row}>
              <MaterialCommunityIcons name="email" size={16} color="#666" />
              <Text style={styles.info}>{item.email}</Text>
            </View>
          )}

          <View style={styles.row}>
            <MaterialCommunityIcons name="phone" size={16} color="#666" />
            <Text style={styles.info}>{contactPhone}</Text>
          </View>

          <View style={styles.row}>
            <MaterialCommunityIcons name="map-marker" size={16} color="#666" />
            <Text style={styles.info}>{address}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation()
              handleCall(contactPhone)
            }}
          >
            <MaterialCommunityIcons name="phone" size={20} color="#2563eb" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation()
              handleEmail(item.email)
            }}
          >
            <MaterialCommunityIcons name="email" size={20} color="#2563eb" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation()
              handleMessage(contactPhone)
            }}
          >
            <MaterialCommunityIcons name="message-text" size={20} color="#2563eb" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    )
  }

  // Show loading spinner while fetching clients
  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading clients...</Text>
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
        placeholder="Search clients..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchbar}
      />

      <FlatList
        data={filteredClients}
        renderItem={renderClientCard}
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
            <MaterialCommunityIcons
              name="account-group-outline"
              size={64}
              color="#ccc"
            />
            <Text style={styles.emptyText}>
              {error ? 'Failed to load clients' : 'No clients found'}
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
        onPress={() => router.push('/clients/add')}
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
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 2,
  },
  type: {
    fontSize: 13,
    color: '#666',
    textTransform: 'capitalize',
  },
  contactInfo: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  info: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  stats: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e5e5',
    marginBottom: 12,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2563eb',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  divider: {
    width: 1,
    backgroundColor: '#e5e5e5',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
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
