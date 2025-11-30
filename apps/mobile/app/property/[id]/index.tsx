import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking, RefreshControl } from 'react-native'
import { useState, useEffect } from 'react'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { apiClient } from '../../../lib/api-client'

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [property, setProperty] = useState<any>(null)
  const [assets, setAssets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      console.error('Failed to fetch property:', err)
      setError(err.message || 'Failed to load property')
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

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`)
  }

  const handleEmail = (email: string) => {
    Linking.openURL(`mailto:${email}`)
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading property...</Text>
      </View>
    )
  }

  if (error || !property) {
    return (
      <View style={styles.errorContainer}>
        <MaterialCommunityIcons name="alert-circle" size={48} color="#ef4444" />
        <Text style={styles.errorText}>{error || 'Property not found'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const address = [
    property.address_street,
    property.address_suburb,
    property.address_state,
    property.address_postcode
  ].filter(Boolean).join(', ')

  // Group assets by room
  const assetsByRoom = assets.reduce((acc: Record<string, any[]>, asset) => {
    const room = asset.room || 'Other'
    if (!acc[room]) acc[room] = []
    acc[room].push(asset)
    return acc
  }, {})

  return (
    <>
      <Stack.Screen
        options={{
          title: property.address_street || 'Property',
          headerBackTitle: 'Properties',
        }}
      />
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Property Header */}
        <View style={styles.header}>
          <View style={styles.addressContainer}>
            <MaterialCommunityIcons name="home" size={28} color="#2563eb" />
            <View style={styles.addressInfo}>
              <Text style={styles.addressText}>{address}</Text>
              {property.property_type && (
                <Text style={styles.propertyType}>
                  {property.property_type}
                  {property.bedrooms && ` • ${property.bedrooms} bed`}
                  {property.bathrooms && ` • ${property.bathrooms} bath`}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push(`/property/${id}/assets`)}
          >
            <MaterialCommunityIcons name="clipboard-list" size={24} color="#2563eb" />
            <Text style={styles.actionButtonText}>View Assets</Text>
            <View style={styles.assetCount}>
              <Text style={styles.assetCountText}>{assets.length}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.addAssetButton]}
            onPress={() => router.push(`/property/${id}/assets/capture`)}
          >
            <MaterialCommunityIcons name="plus-circle" size={24} color="#fff" />
            <Text style={[styles.actionButtonText, { color: '#fff' }]}>Add Asset</Text>
          </TouchableOpacity>
        </View>

        {/* Owner Info */}
        {property.owner_name && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Owner</Text>
            <View style={styles.contactCard}>
              <View style={styles.contactHeader}>
                <MaterialCommunityIcons name="account-key" size={20} color="#666" />
                <Text style={styles.contactName}>{property.owner_name}</Text>
              </View>
              <View style={styles.contactActions}>
                {property.owner_phone && (
                  <TouchableOpacity
                    style={styles.contactAction}
                    onPress={() => handleCall(property.owner_phone)}
                  >
                    <MaterialCommunityIcons name="phone" size={18} color="#2563eb" />
                    <Text style={styles.contactActionText}>{property.owner_phone}</Text>
                  </TouchableOpacity>
                )}
                {property.owner_email && (
                  <TouchableOpacity
                    style={styles.contactAction}
                    onPress={() => handleEmail(property.owner_email)}
                  >
                    <MaterialCommunityIcons name="email" size={18} color="#2563eb" />
                    <Text style={styles.contactActionText}>{property.owner_email}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Tenant Info */}
        {property.tenant_name && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tenant</Text>
            <View style={styles.contactCard}>
              <View style={styles.contactHeader}>
                <MaterialCommunityIcons name="account" size={20} color="#666" />
                <Text style={styles.contactName}>{property.tenant_name}</Text>
              </View>
              <View style={styles.contactActions}>
                {property.tenant_phone && (
                  <TouchableOpacity
                    style={styles.contactAction}
                    onPress={() => handleCall(property.tenant_phone)}
                  >
                    <MaterialCommunityIcons name="phone" size={18} color="#2563eb" />
                    <Text style={styles.contactActionText}>{property.tenant_phone}</Text>
                  </TouchableOpacity>
                )}
                {property.tenant_email && (
                  <TouchableOpacity
                    style={styles.contactAction}
                    onPress={() => handleEmail(property.tenant_email)}
                  >
                    <MaterialCommunityIcons name="email" size={18} color="#2563eb" />
                    <Text style={styles.contactActionText}>{property.tenant_email}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Access Instructions */}
        {property.access_instructions && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Access Instructions</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{property.access_instructions}</Text>
            </View>
          </View>
        )}

        {/* Asset Summary by Room */}
        {assets.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Assets by Room</Text>
            {Object.entries(assetsByRoom).map(([room, roomAssets]) => (
              <TouchableOpacity
                key={room}
                style={styles.roomCard}
                onPress={() => router.push(`/property/${id}/assets?room=${encodeURIComponent(room)}`)}
              >
                <View style={styles.roomHeader}>
                  <MaterialCommunityIcons name="door" size={20} color="#666" />
                  <Text style={styles.roomName}>{room}</Text>
                </View>
                <View style={styles.roomBadge}>
                  <Text style={styles.roomBadgeText}>{roomAssets.length}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Notes */}
        {property.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{property.notes}</Text>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  addressInfo: {
    flex: 1,
  },
  addressText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
    marginBottom: 4,
  },
  propertyType: {
    fontSize: 14,
    color: '#666',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
  },
  addAssetButton: {
    backgroundColor: '#16a34a',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
  assetCount: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  assetCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    padding: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  contactCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  contactActions: {
    gap: 8,
  },
  contactAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  contactActionText: {
    fontSize: 14,
    color: '#2563eb',
  },
  notesCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  notesText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
  },
  roomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  roomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  roomName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111',
  },
  roomBadge: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roomBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
})
