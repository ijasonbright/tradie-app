import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking, RefreshControl, Alert } from 'react-native'
import { useState, useEffect } from 'react'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { apiClient } from '../../../lib/api-client'

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [property, setProperty] = useState<any>(null)
  const [assets, setAssets] = useState<any[]>([])
  const [assetRegisterJobs, setAssetRegisterJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [creatingAssetRegister, setCreatingAssetRegister] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      setError(null)
      const [propertyRes, assetsRes, arJobsRes] = await Promise.all([
        apiClient.getProperty(id),
        apiClient.getAssets({ property_id: id }),
        apiClient.getAssetRegisterJobsForProperty(id)
      ])
      setProperty(propertyRes.property)
      setAssets(assetsRes.assets || [])
      setAssetRegisterJobs(arJobsRes.jobs || [])
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

  // Check for active/in-progress asset register job
  const activeAssetRegisterJob = assetRegisterJobs.find(
    job => ['CREATED', 'ASSIGNED', 'SCHEDULED', 'IN_PROGRESS'].includes(job.status)
  )

  const handleStartAssetRegister = async () => {
    if (activeAssetRegisterJob) {
      // Navigate to existing job
      router.push(`/asset-register/${activeAssetRegisterJob.id}`)
      return
    }

    // Confirm creation of new asset register
    Alert.alert(
      'Start Asset Register',
      'This will create a new asset register for this property. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          onPress: async () => {
            try {
              setCreatingAssetRegister(true)
              const result = await apiClient.createAssetRegisterJob({
                property_id: parseInt(id),
                organization_id: property.organization_id,
                notes: `Asset register for ${property.address_street}`,
              })
              // Navigate to the new asset register job
              router.push(`/asset-register/${result.job.id}`)
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to create asset register')
            } finally {
              setCreatingAssetRegister(false)
            }
          },
        },
      ]
    )
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

        {/* Asset Register Action */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[
              styles.assetRegisterButton,
              activeAssetRegisterJob ? styles.assetRegisterButtonActive : null
            ]}
            onPress={handleStartAssetRegister}
            disabled={creatingAssetRegister}
          >
            {creatingAssetRegister ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <MaterialCommunityIcons
                  name={activeAssetRegisterJob ? "clipboard-text-clock" : "clipboard-text-play"}
                  size={24}
                  color="#fff"
                />
                <View style={styles.assetRegisterContent}>
                  <Text style={styles.assetRegisterButtonText}>
                    {activeAssetRegisterJob ? 'Continue Asset Register' : 'Start Asset Register'}
                  </Text>
                  {activeAssetRegisterJob && (
                    <Text style={styles.assetRegisterStatus}>
                      Status: {activeAssetRegisterJob.status.replace('_', ' ')}
                    </Text>
                  )}
                </View>
                <MaterialCommunityIcons name="chevron-right" size={24} color="#fff" />
              </>
            )}
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
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  assetRegisterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#2563eb',
  },
  assetRegisterButtonActive: {
    backgroundColor: '#16a34a',
  },
  assetRegisterContent: {
    flex: 1,
  },
  assetRegisterButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  assetRegisterStatus: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
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
