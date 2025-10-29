import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Linking } from 'react-native'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { useState, useEffect } from 'react'
import { apiClient } from '../../lib/api-client'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { Avatar } from 'react-native-paper'

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams()
  const router = useRouter()

  const [client, setClient] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchClient()
  }, [id])

  const fetchClient = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await apiClient.getClient(id as string)
      setClient(response.client)
    } catch (err: any) {
      console.error('Failed to fetch client:', err)
      setError(err.message || 'Failed to load client details')
      Alert.alert('Error', 'Failed to load client details')
    } finally {
      setLoading(false)
    }
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

  const handleNavigate = (address: string) => {
    if (address && address !== 'No address') {
      const encodedAddress = encodeURIComponent(address)
      Linking.openURL(`maps://app?daddr=${encodedAddress}`)
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Client Details' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading client details...</Text>
        </View>
      </View>
    )
  }

  if (error || !client) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Client Details' }} />
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle" size={64} color="#ef4444" />
          <Text style={styles.errorText}>Failed to load client</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchClient}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  // Build client name from database fields
  const clientName = client.is_company
    ? client.company_name || 'Unnamed Company'
    : `${client.first_name || ''} ${client.last_name || ''}`.trim() || 'Unnamed Client'

  // Build address from database fields
  const address = [
    client.site_address_line1,
    client.site_address_line2,
    client.site_city,
    client.site_state,
    client.site_postcode
  ].filter(Boolean).join(', ') || 'No address'

  // Get contact phone (prefer mobile, fallback to phone)
  const contactPhone = client.mobile || client.phone || 'No phone'

  // Get client type
  const clientType = client.client_type || 'residential'

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Client Details',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push(`/clients/${id}/edit`)}
              style={styles.editButton}
            >
              <MaterialCommunityIcons name="pencil" size={24} color="#fff" />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header Card */}
        <View style={styles.headerCard}>
          <Avatar.Text
            size={80}
            label={getInitials(clientName)}
            style={[
              styles.avatar,
              { backgroundColor: clientType === 'commercial' ? '#9333ea' : '#2563eb' },
            ]}
          />
          <Text style={styles.name}>{clientName}</Text>
          <Text style={styles.type}>
            {clientType === 'commercial' ? 'Commercial' : 'Residential'}
          </Text>

          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => handleCall(contactPhone)}
            >
              <MaterialCommunityIcons name="phone" size={24} color="#2563eb" />
              <Text style={styles.quickActionLabel}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => handleEmail(client.email)}
            >
              <MaterialCommunityIcons name="email" size={24} color="#2563eb" />
              <Text style={styles.quickActionLabel}>Email</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => handleMessage(contactPhone)}
            >
              <MaterialCommunityIcons name="message-text" size={24} color="#2563eb" />
              <Text style={styles.quickActionLabel}>Message</Text>
            </TouchableOpacity>
            {address !== 'No address' && (
              <TouchableOpacity
                style={styles.quickActionButton}
                onPress={() => handleNavigate(address)}
              >
                <MaterialCommunityIcons name="navigation" size={24} color="#2563eb" />
                <Text style={styles.quickActionLabel}>Navigate</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Contact Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <View style={styles.card}>
            {client.email && (
              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="email" size={20} color="#666" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Email</Text>
                  <Text style={styles.infoValue}>{client.email}</Text>
                </View>
              </View>
            )}

            {client.phone && (
              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="phone" size={20} color="#666" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Phone</Text>
                  <Text style={styles.infoValue}>{client.phone}</Text>
                </View>
              </View>
            )}

            {client.mobile && (
              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="cellphone" size={20} color="#666" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Mobile</Text>
                  <Text style={styles.infoValue}>{client.mobile}</Text>
                </View>
              </View>
            )}

            {client.abn && (
              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="briefcase" size={20} color="#666" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>ABN</Text>
                  <Text style={styles.infoValue}>{client.abn}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Site Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Site Address</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="map-marker" size={20} color="#666" />
              <View style={styles.infoContent}>
                <Text style={styles.infoValue}>{address}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Billing Address (if different) */}
        {!client.billing_address_same_as_site && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Billing Address</Text>
            <View style={styles.card}>
              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="file-document" size={20} color="#666" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoValue}>
                    {[
                      client.billing_address_line1,
                      client.billing_address_line2,
                      client.billing_city,
                      client.billing_state,
                      client.billing_postcode
                    ].filter(Boolean).join(', ') || 'No billing address'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Notes */}
        {client.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <View style={styles.card}>
              <Text style={styles.notesText}>{client.notes}</Text>
            </View>
          </View>
        )}

        {/* Job History Placeholder */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Jobs</Text>
          <View style={styles.card}>
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="briefcase-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No jobs yet</Text>
            </View>
          </View>
        </View>

        {/* Invoice History Placeholder */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Invoices</Text>
          <View style={styles.card}>
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="file-document-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No invoices yet</Text>
            </View>
          </View>
        </View>
      </ScrollView>
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
    fontSize: 16,
    fontWeight: '600',
  },
  editButton: {
    marginRight: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  headerCard: {
    backgroundColor: '#fff',
    padding: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  avatar: {
    marginBottom: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 4,
  },
  type: {
    fontSize: 14,
    color: '#666',
    textTransform: 'capitalize',
    marginBottom: 24,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 24,
  },
  quickActionButton: {
    alignItems: 'center',
    gap: 4,
  },
  quickActionLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  section: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    color: '#111',
  },
  notesText: {
    fontSize: 15,
    color: '#111',
    lineHeight: 22,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
})
