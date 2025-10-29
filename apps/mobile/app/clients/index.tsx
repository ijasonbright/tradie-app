import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native'
import { Searchbar, FAB } from 'react-native-paper'
import { useState, useEffect } from 'react'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { apiClient } from '../../lib/api-client'

export default function ClientsScreen() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchClients()
  }, [])

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

  const onRefresh = () => {
    setRefreshing(true)
    fetchClients()
  }

  const filteredClients = clients.filter((client) => {
    const clientName = client.is_company
      ? client.company_name
      : `${client.first_name} ${client.last_name}`

    return clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
           client.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
           client.phone?.includes(searchQuery) ||
           client.mobile?.includes(searchQuery)
  })

  const renderClientCard = ({ item }: { item: any }) => {
    const clientName = item.is_company
      ? item.company_name
      : `${item.first_name} ${item.last_name}`

    const primaryContact = item.mobile || item.phone || item.email

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/clients/${item.id}`)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons
              name={item.is_company ? 'office-building' : 'account'}
              size={24}
              color="#2563eb"
            />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.clientName}>{clientName}</Text>
            {item.is_company && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>COMPANY</Text>
              </View>
            )}
          </View>
        </View>

        {primaryContact && (
          <View style={styles.contactRow}>
            <MaterialCommunityIcons name="phone" size={16} color="#666" />
            <Text style={styles.contactText}>{primaryContact}</Text>
          </View>
        )}

        {item.site_address_line1 && (
          <View style={styles.contactRow}>
            <MaterialCommunityIcons name="map-marker" size={16} color="#666" />
            <Text style={styles.contactText} numberOfLines={1}>
              {item.site_address_line1}
              {item.site_city && `, ${item.site_city}`}
            </Text>
          </View>
        )}

        <View style={styles.cardFooter}>
          <Text style={styles.footerText}>
            {item.client_type === 'commercial' ? 'Commercial' : 'Residential'}
          </Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#999" />
        </View>
      </TouchableOpacity>
    )
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading clients...</Text>
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
            <MaterialCommunityIcons name="account-multiple-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>
              {error ? 'Failed to load clients' : searchQuery ? 'No clients found' : 'No clients yet'}
            </Text>
            {error && (
              <Text style={styles.emptySubtext}>Pull down to retry</Text>
            )}
            {!error && !searchQuery && (
              <Text style={styles.emptySubtext}>Tap + to add your first client</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  errorText: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
  },
  searchbar: {
    margin: 16,
    backgroundColor: '#fff',
  },
  list: {
    padding: 16,
    paddingTop: 0,
    paddingBottom: 80,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardContent: {
    flex: 1,
  },
  clientName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 4,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#666',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  contactText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#2563eb',
  },
})
