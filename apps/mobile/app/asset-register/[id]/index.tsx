import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Linking } from 'react-native'
import { Button, Card, Divider } from 'react-native-paper'
import { useState, useEffect } from 'react'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { apiClient } from '../../../lib/api-client'

const STATUS_COLORS: Record<string, string> = {
  CREATED: '#9333ea',
  ASSIGNED: '#2563eb',
  SCHEDULED: '#0891b2',
  IN_PROGRESS: '#ea580c',
  COMPLETED: '#16a34a',
  CANCELLED: '#64748b',
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: '#64748b',
  MEDIUM: '#f59e0b',
  HIGH: '#ef4444',
}

export default function AssetRegisterJobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [job, setJob] = useState<any>(null)
  const [photos, setPhotos] = useState<any[]>([])
  const [notes, setNotes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const fetchJobDetails = async () => {
    try {
      setError(null)
      const response = await apiClient.getAssetRegisterJob(id!)
      console.log('Fetched asset register job:', response)
      setJob(response.job)
      setPhotos(response.photos || [])
      setNotes(response.notes || [])
    } catch (err: any) {
      console.error('Failed to fetch asset register job:', err)
      setError(err.message || 'Failed to load job details')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (id) {
      fetchJobDetails()
    }
  }, [id])

  const handleStartJob = async () => {
    Alert.alert(
      'Start Asset Register',
      'Are you ready to start this asset register job?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          onPress: async () => {
            try {
              setActionLoading(true)
              await apiClient.startAssetRegisterJob(id!)
              await fetchJobDetails()
              Alert.alert('Success', 'Job has been started')
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to start job')
            } finally {
              setActionLoading(false)
            }
          },
        },
      ]
    )
  }

  const handleCompleteJob = () => {
    router.push(`/asset-register/${id}/complete`)
  }

  const handleReopenJob = async () => {
    Alert.alert(
      'Reopen Asset Register',
      'Are you sure you want to reopen this completed asset register? This will allow you to make edits.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reopen',
          onPress: async () => {
            try {
              setActionLoading(true)
              await apiClient.reopenAssetRegisterJob(id!)
              await fetchJobDetails()
              Alert.alert('Success', 'Job has been reopened')
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to reopen job')
            } finally {
              setActionLoading(false)
            }
          },
        },
      ]
    )
  }

  const openMaps = () => {
    if (!job) return

    const address = [
      job.address_street,
      job.address_suburb,
      job.address_state,
      job.address_postcode
    ].filter(Boolean).join(', ')

    const encodedAddress = encodeURIComponent(address)
    const mapsUrl = `https://maps.apple.com/?q=${encodedAddress}`
    Linking.openURL(mapsUrl)
  }

  const callPhone = (phone: string) => {
    Linking.openURL(`tel:${phone}`)
  }

  const sendEmail = (email: string) => {
    Linking.openURL(`mailto:${email}`)
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading job details...</Text>
      </View>
    )
  }

  if (error || !job) {
    return (
      <View style={styles.errorContainer}>
        <MaterialCommunityIcons name="alert-circle" size={64} color="#ef4444" />
        <Text style={styles.errorText}>{error || 'Job not found'}</Text>
        <Button mode="contained" onPress={() => router.back()}>
          Go Back
        </Button>
      </View>
    )
  }

  const address = [
    job.address_street,
    job.address_suburb,
    job.address_state,
    job.address_postcode
  ].filter(Boolean).join(', ') || 'No address'

  const priority = (job.priority || 'MEDIUM') as keyof typeof PRIORITY_COLORS
  const status = (job.status || 'CREATED') as keyof typeof STATUS_COLORS
  const canStart = status === 'CREATED' || status === 'ASSIGNED' || status === 'SCHEDULED'
  const canComplete = status === 'IN_PROGRESS'

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Asset Register',
          headerRight: () => (
            <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[status] }]}>
              <Text style={styles.statusText}>{status.replace('_', ' ')}</Text>
            </View>
          ),
        }}
      />

      <ScrollView style={styles.container}>
        {/* Property Card */}
        <Card style={styles.card}>
          <Card.Title
            title="Property Details"
            left={(props) => <MaterialCommunityIcons {...props} name="home" size={24} color="#2563eb" />}
          />
          <Card.Content>
            <TouchableOpacity onPress={openMaps} style={styles.addressRow}>
              <MaterialCommunityIcons name="map-marker" size={20} color="#2563eb" />
              <Text style={styles.addressText}>{address}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#999" />
            </TouchableOpacity>

            {job.property_type && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Type:</Text>
                <Text style={styles.detailValue}>{job.property_type}</Text>
              </View>
            )}

            {(job.bedrooms || job.bathrooms) && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Layout:</Text>
                <Text style={styles.detailValue}>
                  {job.bedrooms && `${job.bedrooms} bed`}
                  {job.bedrooms && job.bathrooms && ' / '}
                  {job.bathrooms && `${job.bathrooms} bath`}
                </Text>
              </View>
            )}

            {job.access_instructions && (
              <View style={styles.notesSection}>
                <Text style={styles.detailLabel}>Access Instructions:</Text>
                <Text style={styles.notesText}>{job.access_instructions}</Text>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Owner Contact Card */}
        {job.owner_name && (
          <Card style={styles.card}>
            <Card.Title
              title="Owner"
              left={(props) => <MaterialCommunityIcons {...props} name="account" size={24} color="#16a34a" />}
            />
            <Card.Content>
              <Text style={styles.contactName}>{job.owner_name}</Text>

              {job.owner_phone && (
                <TouchableOpacity onPress={() => callPhone(job.owner_phone)} style={styles.contactRow}>
                  <MaterialCommunityIcons name="phone" size={20} color="#2563eb" />
                  <Text style={styles.contactText}>{job.owner_phone}</Text>
                </TouchableOpacity>
              )}

              {job.owner_email && (
                <TouchableOpacity onPress={() => sendEmail(job.owner_email)} style={styles.contactRow}>
                  <MaterialCommunityIcons name="email" size={20} color="#2563eb" />
                  <Text style={styles.contactText}>{job.owner_email}</Text>
                </TouchableOpacity>
              )}
            </Card.Content>
          </Card>
        )}

        {/* Tenant Contact Card */}
        {job.tenant_name && (
          <Card style={styles.card}>
            <Card.Title
              title="Tenant"
              left={(props) => <MaterialCommunityIcons {...props} name="account-outline" size={24} color="#0891b2" />}
            />
            <Card.Content>
              <Text style={styles.contactName}>{job.tenant_name}</Text>

              {job.tenant_phone && (
                <TouchableOpacity onPress={() => callPhone(job.tenant_phone)} style={styles.contactRow}>
                  <MaterialCommunityIcons name="phone" size={20} color="#2563eb" />
                  <Text style={styles.contactText}>{job.tenant_phone}</Text>
                </TouchableOpacity>
              )}

              {job.tenant_email && (
                <TouchableOpacity onPress={() => sendEmail(job.tenant_email)} style={styles.contactRow}>
                  <MaterialCommunityIcons name="email" size={20} color="#2563eb" />
                  <Text style={styles.contactText}>{job.tenant_email}</Text>
                </TouchableOpacity>
              )}
            </Card.Content>
          </Card>
        )}

        {/* Job Details Card */}
        <Card style={styles.card}>
          <Card.Title
            title="Job Details"
            left={(props) => <MaterialCommunityIcons {...props} name="clipboard-list" size={24} color="#ea580c" />}
          />
          <Card.Content>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Priority:</Text>
              <View style={[styles.priorityBadge, { backgroundColor: PRIORITY_COLORS[priority] }]}>
                <Text style={styles.priorityText}>{priority}</Text>
              </View>
            </View>

            {job.scheduled_date && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Scheduled:</Text>
                <Text style={styles.detailValue}>
                  {new Date(job.scheduled_date).toLocaleDateString('en-AU', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </Text>
              </View>
            )}

            {job.started_date && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Started:</Text>
                <Text style={styles.detailValue}>
                  {new Date(job.started_date).toLocaleString('en-AU')}
                </Text>
              </View>
            )}

            {job.completed_date && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Completed:</Text>
                <Text style={styles.detailValue}>
                  {new Date(job.completed_date).toLocaleString('en-AU')}
                </Text>
              </View>
            )}

            {job.notes && (
              <View style={styles.notesSection}>
                <Text style={styles.detailLabel}>Notes:</Text>
                <Text style={styles.notesText}>{job.notes}</Text>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Notes Section */}
        {notes.length > 0 && (
          <Card style={styles.card}>
            <Card.Title
              title={`Notes (${notes.length})`}
              left={(props) => <MaterialCommunityIcons {...props} name="note-text" size={24} color="#9333ea" />}
            />
            <Card.Content>
              {notes.map((note, index) => (
                <View key={note.id}>
                  {index > 0 && <Divider style={styles.divider} />}
                  <View style={styles.noteItem}>
                    <Text style={styles.noteAuthor}>{note.user_name || 'Unknown'}</Text>
                    <Text style={styles.noteDate}>
                      {new Date(note.created_at).toLocaleString('en-AU')}
                    </Text>
                    <Text style={styles.noteText}>{note.note_text}</Text>
                  </View>
                </View>
              ))}
            </Card.Content>
          </Card>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          {canStart && (
            <Button
              mode="contained"
              onPress={handleStartJob}
              loading={actionLoading}
              disabled={actionLoading}
              style={styles.actionButton}
              icon="play"
            >
              Start Job
            </Button>
          )}

          {canComplete && (
            <Button
              mode="contained"
              onPress={handleCompleteJob}
              style={[styles.actionButton, styles.completeButton]}
              icon="check"
            >
              Complete Asset Register
            </Button>
          )}

          {status === 'COMPLETED' && (
            <>
              <View style={styles.completedBanner}>
                <MaterialCommunityIcons name="check-circle" size={24} color="#16a34a" />
                <Text style={styles.completedText}>This asset register has been completed</Text>
              </View>
              <Button
                mode="outlined"
                onPress={handleReopenJob}
                loading={actionLoading}
                disabled={actionLoading}
                style={styles.reopenButton}
                icon="pencil"
              >
                Reopen to Make Edits
              </Button>
            </>
          )}
        </View>

        <View style={styles.bottomSpacer} />
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
    gap: 16,
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  card: {
    margin: 16,
    marginBottom: 0,
    elevation: 2,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    marginBottom: 12,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: '#2563eb',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    width: 100,
  },
  detailValue: {
    fontSize: 14,
    color: '#111',
    flex: 1,
  },
  notesSection: {
    marginTop: 8,
  },
  notesText: {
    fontSize: 14,
    color: '#111',
    marginTop: 4,
    lineHeight: 20,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 8,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  contactText: {
    fontSize: 14,
    color: '#2563eb',
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  divider: {
    marginVertical: 12,
  },
  noteItem: {
    paddingVertical: 4,
  },
  noteAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },
  noteDate: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  noteText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  actionsContainer: {
    padding: 16,
    gap: 12,
  },
  actionButton: {
    paddingVertical: 4,
  },
  completeButton: {
    backgroundColor: '#16a34a',
  },
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#dcfce7',
    padding: 16,
    borderRadius: 8,
  },
  completedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16a34a',
  },
  reopenButton: {
    borderColor: '#ea580c',
    marginTop: 8,
  },
  bottomSpacer: {
    height: 32,
  },
})
