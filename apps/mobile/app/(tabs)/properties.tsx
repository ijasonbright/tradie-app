import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native'
import { Searchbar, FAB } from 'react-native-paper'
import { useState, useEffect } from 'react'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useAuth } from '../../lib/auth'
import { apiClient } from '../../lib/api-client'

export default function PropertiesScreen() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const { isSignedIn } = useAuth()
  const [properties, setProperties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch properties from API
  const fetchProperties = async () => {
    try {
      setError(null)
      const response = await apiClient.getProperties()
      console.log('Fetched properties:', response)
      setProperties(response.properties || [])
    } catch (err: any) {
      console.error('Failed to fetch properties:', err)
      setError(err.message || 'Failed to load properties')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Load properties on mount
  useEffect(() => {
    if (isSignedIn) {
      fetchProperties()
    }
  }, [isSignedIn])

  // Pull to refresh
  const onRefresh = () => {
    setRefreshing(true)
    fetchProperties()
  }

  const filteredProperties = properties
    .filter((property) => {
      if (!searchQuery) return true

      const query = searchQuery.toLowerCase()
      const fullAddress = `${property.address_street || ''} ${property.address_suburb || ''} ${property.address_state || ''}`.toLowerCase()
      const ownerName = (property.owner_name || '').toLowerCase()
      const tenantName = (property.tenant_name || '').toLowerCase()

      return (
        fullAddress.includes(query) ||
        ownerName.includes(query) ||
        tenantName.includes(query)
      )
    })
    .sort((a, b) => {
      // Sort by suburb, then street
      const suburbA = (a.address_suburb || '').toLowerCase()
      const suburbB = (b.address_suburb || '').toLowerCase()
      if (suburbA !== suburbB) return suburbA.localeCompare(suburbB)
      return (a.address_street || '').localeCompare(b.address_street || '')
    })

  const renderPropertyCard = ({ item }: { item: any }) => {
    const address = [
      item.address_street,
      item.address_suburb,
      item.address_state,
      item.address_postcode
    ].filter(Boolean).join(', ') || 'No address'

    const propertyInfo = [
      item.property_type,
      item.bedrooms ? `${item.bedrooms} bed` : null,
      item.bathrooms ? `${item.bathrooms} bath` : null
    ].filter(Boolean).join(' • ')

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/property/${item.id}`)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons name="home" size={24} color="#2563eb" />
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.title} numberOfLines={2}>{address}</Text>
            {propertyInfo && (
              <Text style={styles.subtitle}>{propertyInfo}</Text>
            )}
          </View>
          {item.asset_count > 0 && (
            <View style={styles.assetBadge}>
              <Text style={styles.assetBadgeText}>{item.asset_count}</Text>
              <Text style={styles.assetBadgeLabel}>assets</Text>
            </View>
          )}
        </View>

        {(item.owner_name || item.tenant_name) && (
          <View style={styles.contactsRow}>
            {item.owner_name && (
              <View style={styles.contactItem}>
                <MaterialCommunityIcons name="account-key" size={14} color="#666" />
                <Text style={styles.contactText} numberOfLines={1}>Owner: {item.owner_name}</Text>
              </View>
            )}
            {item.tenant_name && (
              <View style={styles.contactItem}>
                <MaterialCommunityIcons name="account" size={14} color="#666" />
                <Text style={styles.contactText} numberOfLines={1}>Tenant: {item.tenant_name}</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push(`/property/${item.id}/assets`)}
          >
            <MaterialCommunityIcons name="clipboard-list" size={16} color="#2563eb" />
            <Text style={styles.actionButtonText}>View Assets</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push(`/property/${item.id}/assets/capture`)}
          >
            <MaterialCommunityIcons name="plus-circle" size={16} color="#16a34a" />
            <Text style={[styles.actionButtonText, { color: '#16a34a' }]}>Add Asset</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    )
  }

  // Show loading spinner while fetching properties
  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading properties...</Text>
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
          placeholder="Search properties..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />
      </View>

      <FlatList
        data={filteredProperties}
        renderItem={renderPropertyCard}
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
            <MaterialCommunityIcons name="home-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>
              {error ? 'Failed to load properties' : 'No properties found'}
            </Text>
            <Text style={styles.emptySubtext}>
              {error ? 'Pull down to retry' : 'Properties will sync from Property Pal'}
            </Text>
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
    paddingBottom: 12,
  },
  searchbar: {
    margin: 16,
    marginBottom: 0,
    elevation: 2,
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
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
  },
  assetBadge: {
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    marginLeft: 8,
  },
  assetBadgeText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#16a34a',
  },
  assetBadgeLabel: {
    fontSize: 10,
    color: '#16a34a',
    textTransform: 'uppercase',
  },
  contactsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    minWidth: 120,
  },
  contactText: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
  },
  actionButtonText: {
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
    textAlign: 'center',
  },
})
