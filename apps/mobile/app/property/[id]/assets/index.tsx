import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native'
import { Searchbar, FAB, Chip } from 'react-native-paper'
import { useState, useEffect } from 'react'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { apiClient } from '../../../../lib/api-client'

const CONDITION_COLORS: Record<string, string> = {
  EXCELLENT: '#16a34a',
  GOOD: '#22c55e',
  FAIR: '#eab308',
  POOR: '#f97316',
  REPLACEMENT_NEEDED: '#ef4444',
}

const CATEGORY_ICONS: Record<string, string> = {
  APPLIANCE: 'fridge',
  HVAC: 'air-conditioner',
  PLUMBING: 'water-pump',
  ELECTRICAL: 'flash',
  SECURITY: 'shield-lock',
  FURNITURE: 'sofa',
  FIXTURE: 'ceiling-light',
  OTHER: 'package-variant',
}

export default function PropertyAssetsScreen() {
  const { id, room: initialRoom } = useLocalSearchParams<{ id: string; room?: string }>()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [property, setProperty] = useState<any>(null)
  const [assets, setAssets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedRoom, setSelectedRoom] = useState<string | null>(initialRoom || null)

  const fetchData = async () => {
    try {
      setError(null)
      const [propertyRes, assetsRes] = await Promise.all([
        apiClient.getProperty(id),
        apiClient.getAssets({ property_id: id })
      ])
      setProperty(propertyRes.property)
      setAssets(assetsRes.assets || [])
    } catch (err: any) {
      console.error('Failed to fetch assets:', err)
      setError(err.message || 'Failed to load assets')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [id])

  const onRefresh = () => {
    setRefreshing(true)
    fetchData()
  }

  // Get unique rooms for filter
  const rooms = [...new Set(assets.map(a => a.room).filter(Boolean))].sort()

  const filteredAssets = assets
    .filter((asset) => {
      // Filter by room
      if (selectedRoom && asset.room !== selectedRoom) return false

      // Filter by search
      if (!searchQuery) return true
      const query = searchQuery.toLowerCase()
      return (
        asset.name?.toLowerCase().includes(query) ||
        asset.brand?.toLowerCase().includes(query) ||
        asset.model?.toLowerCase().includes(query) ||
        asset.serial_number?.toLowerCase().includes(query)
      )
    })
    .sort((a, b) => {
      // Sort by room then name
      if (a.room !== b.room) {
        if (!a.room) return 1
        if (!b.room) return -1
        return a.room.localeCompare(b.room)
      }
      return (a.name || '').localeCompare(b.name || '')
    })

  const formatCurrency = (value: string | number | null) => {
    if (!value) return null
    const num = typeof value === 'string' ? parseFloat(value) : value
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
    }).format(num)
  }

  const renderAssetCard = ({ item }: { item: any }) => {
    const conditionColor = CONDITION_COLORS[item.condition] || '#666'
    const categoryIcon = CATEGORY_ICONS[item.category] || 'package-variant'

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/asset/${item.id}`)}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.iconContainer, { backgroundColor: `${conditionColor}15` }]}>
            <MaterialCommunityIcons
              name={categoryIcon as any}
              size={24}
              color={conditionColor}
            />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.assetName} numberOfLines={1}>{item.name}</Text>
            {(item.brand || item.model) && (
              <Text style={styles.assetSubtitle} numberOfLines={1}>
                {[item.brand, item.model].filter(Boolean).join(' - ')}
              </Text>
            )}
          </View>
          <View style={[styles.conditionBadge, { backgroundColor: conditionColor }]}>
            <Text style={styles.conditionText}>
              {(item.condition || 'N/A').replace(/_/g, ' ')}
            </Text>
          </View>
        </View>

        <View style={styles.cardDetails}>
          {item.room && (
            <View style={styles.detailItem}>
              <MaterialCommunityIcons name="door" size={14} color="#666" />
              <Text style={styles.detailText}>{item.room}</Text>
            </View>
          )}
          {item.estimated_age && (
            <View style={styles.detailItem}>
              <MaterialCommunityIcons name="calendar" size={14} color="#666" />
              <Text style={styles.detailText}>{item.estimated_age}y old</Text>
            </View>
          )}
          {item.current_value && (
            <View style={styles.detailItem}>
              <MaterialCommunityIcons name="currency-usd" size={14} color="#666" />
              <Text style={styles.detailText}>{formatCurrency(item.current_value)}</Text>
            </View>
          )}
          {item.photo_count > 0 && (
            <View style={styles.detailItem}>
              <MaterialCommunityIcons name="camera" size={14} color="#666" />
              <Text style={styles.detailText}>{item.photo_count}</Text>
            </View>
          )}
        </View>

        {item.maintenance_required && item.maintenance_required !== 'NONE' && (
          <View style={styles.maintenanceAlert}>
            <MaterialCommunityIcons name="wrench" size={14} color="#f97316" />
            <Text style={styles.maintenanceText}>
              {item.maintenance_required.replace(/_/g, ' ')}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    )
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading assets...</Text>
      </View>
    )
  }

  const totalValue = assets.reduce((sum, a) => sum + parseFloat(a.current_value || 0), 0)

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Asset Register',
          headerBackTitle: 'Property',
        }}
      />
      <View style={styles.container}>
        {/* Summary Header */}
        <View style={styles.summaryHeader}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{assets.length}</Text>
            <Text style={styles.summaryLabel}>Total Assets</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{formatCurrency(totalValue) || '$0'}</Text>
            <Text style={styles.summaryLabel}>Total Value</Text>
          </View>
        </View>

        {/* Search and Filters */}
        <View style={styles.filtersContainer}>
          <Searchbar
            placeholder="Search assets..."
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={styles.searchbar}
          />

          {rooms.length > 0 && (
            <View style={styles.chipContainer}>
              <Chip
                selected={!selectedRoom}
                onPress={() => setSelectedRoom(null)}
                style={styles.chip}
              >
                All Rooms
              </Chip>
              {rooms.map(room => (
                <Chip
                  key={room}
                  selected={selectedRoom === room}
                  onPress={() => setSelectedRoom(selectedRoom === room ? null : room)}
                  style={styles.chip}
                >
                  {room}
                </Chip>
              ))}
            </View>
          )}
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <MaterialCommunityIcons name="alert-circle" size={20} color="#fff" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <FlatList
          data={filteredAssets}
          renderItem={renderAssetCard}
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
                {error ? 'Failed to load assets' : 'No assets recorded'}
              </Text>
              <Text style={styles.emptySubtext}>
                Tap the + button to add your first asset
              </Text>
            </View>
          }
        />

        <FAB
          icon="plus"
          style={styles.fab}
          onPress={() => router.push(`/property/${id}/assets/capture`)}
          label="Add Asset"
        />
      </View>
    </>
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
  summaryHeader: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#e5e5e5',
    marginHorizontal: 16,
  },
  filtersContainer: {
    backgroundColor: '#fff',
    paddingBottom: 12,
  },
  searchbar: {
    margin: 16,
    marginBottom: 8,
    elevation: 2,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 8,
  },
  chip: {
    marginRight: 0,
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
  list: {
    padding: 16,
    paddingBottom: 100,
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
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  assetName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  assetSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  conditionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  conditionText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
  },
  cardDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 13,
    color: '#666',
  },
  maintenanceAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  maintenanceText: {
    fontSize: 13,
    color: '#f97316',
    fontWeight: '500',
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
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#16a34a',
  },
})
