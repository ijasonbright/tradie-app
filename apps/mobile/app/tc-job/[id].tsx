import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Linking, Platform, Alert } from 'react-native'
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router'
import { useState, useEffect } from 'react'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { apiClient } from '../../lib/api-client'

interface CompletionFormTemplate {
  id: string
  name: string
  description: string | null
  tc_form_id: number
  group_count: number
  question_count: number
}

// TradieConnect Job status colors
const TC_STATUS_COLORS: Record<string, string> = {
  'Posted': '#f59e0b',
  'Job Accepted By Business': '#3b82f6',
  'Booked': '#8b5cf6',
  'In Progress': '#8b5cf6',
  'Completed': '#10b981',
  'Invoiced': '#06b6d4',
  'Cancelled': '#ef4444',
  'default': '#6b7280',
}

export default function TCJobDetailScreen() {
  const { id } = useLocalSearchParams()
  const router = useRouter()
  const navigation = useNavigation()
  const [job, setJob] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formTemplate, setFormTemplate] = useState<CompletionFormTemplate | null>(null)
  const [loadingForm, setLoadingForm] = useState(false)

  const fetchJobDetails = async () => {
    try {
      setError(null)
      const response = await apiClient.getTCJobDetails(id as string)
      console.log('Fetched TC job details:', response)
      setJob(response.job)

      // If job has a completionFormTypeId, try to find the matching form template
      if (response.job?.completionFormTypeId) {
        setLoadingForm(true)
        try {
          const formResponse = await apiClient.getCompletionFormTemplateByTcFormId(response.job.completionFormTypeId)
          if (formResponse.success && formResponse.template) {
            setFormTemplate(formResponse.template)
            console.log('Found matching form template:', formResponse.template.name)
          } else {
            console.log('No form template found for tc_form_id:', response.job.completionFormTypeId)
          }
        } catch (formErr) {
          console.log('Could not fetch form template:', formErr)
        } finally {
          setLoadingForm(false)
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch TC job:', err)
      setError(err.message || 'Failed to load job details')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (id) {
      fetchJobDetails()
    }
  }, [id])

  // Set the header title when job is loaded
  useEffect(() => {
    if (job) {
      navigation.setOptions({
        title: `TC Job #${job.jobId}` || 'TradieConnect Job',
      })
    }
  }, [job, navigation])

  const onRefresh = () => {
    setRefreshing(true)
    fetchJobDetails()
  }

  const handleCall = (phoneNumber: string | null) => {
    if (phoneNumber) {
      Linking.openURL(`tel:${phoneNumber}`)
    }
  }

  const handleNavigate = (lat: number, long: number, address?: string) => {
    if (lat && long && lat !== 0 && long !== 0) {
      // Use GPS coordinates if available
      const url = Platform.select({
        ios: `maps://app?daddr=${lat},${long}`,
        android: `google.navigation:q=${lat},${long}`,
      }) || `https://www.google.com/maps/dir/?api=1&destination=${lat},${long}`

      Linking.canOpenURL(url)
        .then((supported) => {
          if (supported) {
            return Linking.openURL(url)
          } else {
            return Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${long}`)
          }
        })
        .catch((err) => console.error('Error opening maps:', err))
    } else if (address) {
      // Fall back to address string
      const encodedAddress = encodeURIComponent(address)
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`)
    }
  }

  const getStatusColor = (status: string) => {
    return TC_STATUS_COLORS[status] || TC_STATUS_COLORS.default
  }

  const handleOpenCompletionForm = () => {
    if (!formTemplate) {
      Alert.alert(
        'Form Not Available',
        'No completion form template is available for this job type.',
        [{ text: 'OK' }]
      )
      return
    }

    // Navigate to TC-specific completion form screen
    router.push({
      pathname: '/tc-job/completion-form/[tcJobId]',
      params: {
        tcJobId: job?.jobId?.toString(),
        templateId: formTemplate.id,
        tcJobCode: job?.code || `TC-${job?.jobId}`,
        formName: formTemplate.name,
      },
    })
  }

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading job details...</Text>
        </View>
      </View>
    )
  }

  if (error || !job) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle-outline" size={64} color="#ef4444" />
          <Text style={styles.errorTitle}>Failed to Load Job</Text>
          <Text style={styles.errorText}>{error || 'Job not found'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchJobDetails}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  // Extract data from job
  const property = job.property || {}
  const pricing = job.pricing || {}
  const history = job.history || []

  // Build address
  const buildAddress = () => {
    if (property.address) return property.address
    return [
      property.unit,
      property.number,
      property.street,
      property.suburb,
      property.state,
      property.postCode
    ].filter(Boolean).join(' ')
  }

  const address = buildAddress()
  const jobStatus = property.jobStatusName || job.propertyMeStatus || 'Unknown'

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2563eb']}
            tintColor="#2563eb"
          />
        }
      >
        {/* TradieConnect Badge */}
        <View style={styles.tcBadge}>
          <MaterialCommunityIcons name="cloud-sync" size={16} color="#fff" />
          <Text style={styles.tcBadgeText}>TradieConnect Job</Text>
        </View>

        {/* Header Card */}
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.jobNumber}>Job #{job.jobId}</Text>
              <Text style={styles.title}>{pricing.jobTypeName || job.jobSourcePrettyPrint || 'Service Job'}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: getStatusColor(jobStatus) }]}>
              <Text style={styles.badgeText}>{jobStatus.toUpperCase()}</Text>
            </View>
          </View>

          {job.propertyMeSummary && (
            <Text style={styles.description}>{job.propertyMeSummary}</Text>
          )}

          {/* Job Type Indicators */}
          <View style={styles.typeIndicators}>
            {job.isInspection && (
              <View style={styles.typeChip}>
                <MaterialCommunityIcons name="clipboard-check" size={14} color="#2563eb" />
                <Text style={styles.typeChipText}>Inspection</Text>
              </View>
            )}
            {job.hasGas && (
              <View style={styles.typeChip}>
                <MaterialCommunityIcons name="fire" size={14} color="#f59e0b" />
                <Text style={styles.typeChipText}>Gas</Text>
              </View>
            )}
            {job.isEnergyUpgrade && (
              <View style={styles.typeChip}>
                <MaterialCommunityIcons name="lightning-bolt" size={14} color="#10b981" />
                <Text style={styles.typeChipText}>Energy Upgrade</Text>
              </View>
            )}
            {job.isRectification && (
              <View style={styles.typeChip}>
                <MaterialCommunityIcons name="wrench" size={14} color="#ef4444" />
                <Text style={styles.typeChipText}>Rectification</Text>
              </View>
            )}
          </View>
        </View>

        {/* Location Card */}
        {(address || (job.lat && job.long)) && (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="map-marker" size={20} color="#2563eb" />
              <Text style={styles.sectionTitle}>Location</Text>
            </View>

            {address && <Text style={styles.addressText}>{address}</Text>}

            {job.entryNotes && (
              <View style={styles.notesBox}>
                <Text style={styles.notesLabel}>Entry Notes:</Text>
                <Text style={styles.notesText}>{job.entryNotes}</Text>
              </View>
            )}

            {property.siteAccessNotes && (
              <View style={styles.notesBox}>
                <Text style={styles.notesLabel}>Access Notes:</Text>
                <Text style={styles.notesText}>{property.siteAccessNotes}</Text>
              </View>
            )}

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleNavigate(job.lat, job.long, address)}
              >
                <MaterialCommunityIcons name="navigation" size={20} color="#2563eb" />
                <Text style={styles.actionButtonText}>Navigate</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Tenant Contact Card */}
        {(property.tenantFullname || property.tenantMobile || property.tenantEmail) && (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="account" size={20} color="#2563eb" />
              <Text style={styles.sectionTitle}>Tenant</Text>
            </View>

            {property.tenantFullname && (
              <Text style={styles.clientName}>{property.tenantFullname}</Text>
            )}

            {property.tenantEmail && (
              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="email" size={16} color="#666" />
                <Text style={styles.infoText}>{property.tenantEmail}</Text>
              </View>
            )}

            {property.tenantMobile && (
              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="phone" size={16} color="#666" />
                <Text style={styles.infoText}>{property.tenantMobile}</Text>
              </View>
            )}

            {property.tenantMobile && (
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleCall(property.tenantMobile)}
                >
                  <MaterialCommunityIcons name="phone" size={20} color="#2563eb" />
                  <Text style={styles.actionButtonText}>Call Tenant</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Manager Contact Card */}
        {(property.managerFullname || property.managerMobile || property.managerEmail) && (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="account-tie" size={20} color="#2563eb" />
              <Text style={styles.sectionTitle}>Property Manager</Text>
            </View>

            {property.managerFullname && (
              <Text style={styles.clientName}>{property.managerFullname}</Text>
            )}

            {property.managerEmail && (
              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="email" size={16} color="#666" />
                <Text style={styles.infoText}>{property.managerEmail}</Text>
              </View>
            )}

            {property.managerMobile && (
              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="phone" size={16} color="#666" />
                <Text style={styles.infoText}>{property.managerMobile}</Text>
              </View>
            )}

            {property.managerMobile && (
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleCall(property.managerMobile)}
                >
                  <MaterialCommunityIcons name="phone" size={20} color="#2563eb" />
                  <Text style={styles.actionButtonText}>Call Manager</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Owner Contact Card */}
        {(property.ownerFullname || property.ownerMobile || property.ownerEmail) && (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="home-account" size={20} color="#2563eb" />
              <Text style={styles.sectionTitle}>Owner</Text>
            </View>

            {property.ownerFullname && (
              <Text style={styles.clientName}>{property.ownerFullname}</Text>
            )}

            {property.ownerEmail && (
              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="email" size={16} color="#666" />
                <Text style={styles.infoText}>{property.ownerEmail}</Text>
              </View>
            )}

            {property.ownerMobile && (
              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="phone" size={16} color="#666" />
                <Text style={styles.infoText}>{property.ownerMobile}</Text>
              </View>
            )}

            {property.ownerMobile && (
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleCall(property.ownerMobile)}
                >
                  <MaterialCommunityIcons name="phone" size={20} color="#2563eb" />
                  <Text style={styles.actionButtonText}>Call Owner</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Pricing Card */}
        {pricing && pricing.currentJobCost > 0 && (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="currency-usd" size={20} color="#2563eb" />
              <Text style={styles.sectionTitle}>Pricing</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.label}>Job Type:</Text>
              <Text style={styles.value}>{pricing.jobTypeName}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.label}>Property Type:</Text>
              <Text style={styles.value}>{pricing.propertyType}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.label}>Job Cost:</Text>
              <Text style={styles.priceText}>${pricing.currentJobCost.toFixed(2)}</Text>
            </View>

            {pricing.initialWithGst > 0 && pricing.initialWithGst !== pricing.currentJobCost && (
              <View style={styles.infoRow}>
                <Text style={styles.label}>Inc. GST:</Text>
                <Text style={styles.priceText}>${pricing.initialWithGst.toFixed(2)}</Text>
              </View>
            )}
          </View>
        )}

        {/* Job History */}
        {history.length > 0 && (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="history" size={20} color="#2563eb" />
              <Text style={styles.sectionTitle}>History ({history.length})</Text>
            </View>

            {history.slice(0, 10).map((item: any, index: number) => (
              <View key={item.id || index} style={styles.historyItem}>
                <View style={styles.historyHeader}>
                  <Text style={styles.historyStatus}>{item.statusName}</Text>
                  <Text style={styles.historyDate}>
                    {new Date(item.timestamp).toLocaleDateString('en-AU', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Text>
                </View>
                <Text style={styles.historyDescription} numberOfLines={2}>
                  {item.description}
                </Text>
                {item.fullname && (
                  <Text style={styles.historyUser}>By: {item.fullname}</Text>
                )}
              </View>
            ))}

            {history.length > 10 && (
              <Text style={styles.moreText}>+{history.length - 10} more entries</Text>
            )}
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="lightning-bolt" size={20} color="#2563eb" />
            <Text style={styles.sectionTitle}>Quick Actions</Text>
          </View>

          <View style={styles.quickActionsGrid}>
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => handleNavigate(job.lat, job.long, address)}
            >
              <MaterialCommunityIcons name="navigation" size={32} color="#2563eb" />
              <Text style={styles.quickActionLabel}>Navigate</Text>
            </TouchableOpacity>

            {property.tenantMobile && (
              <TouchableOpacity
                style={styles.quickActionCard}
                onPress={() => handleCall(property.tenantMobile)}
              >
                <MaterialCommunityIcons name="phone" size={32} color="#2563eb" />
                <Text style={styles.quickActionLabel}>Call Tenant</Text>
              </TouchableOpacity>
            )}

            {property.managerMobile && (
              <TouchableOpacity
                style={styles.quickActionCard}
                onPress={() => handleCall(property.managerMobile)}
              >
                <MaterialCommunityIcons name="phone-outline" size={32} color="#2563eb" />
                <Text style={styles.quickActionLabel}>Call Manager</Text>
              </TouchableOpacity>
            )}

            {/* Complete Form Button */}
            <TouchableOpacity
              style={[
                styles.quickActionCard,
                formTemplate ? styles.quickActionCardPrimary : styles.quickActionCardDisabled
              ]}
              onPress={handleOpenCompletionForm}
              disabled={loadingForm}
            >
              {loadingForm ? (
                <ActivityIndicator size="small" color={formTemplate ? '#fff' : '#999'} />
              ) : (
                <MaterialCommunityIcons
                  name="clipboard-check"
                  size={32}
                  color={formTemplate ? '#fff' : '#999'}
                />
              )}
              <Text style={[
                styles.quickActionLabel,
                formTemplate ? styles.quickActionLabelPrimary : styles.quickActionLabelDisabled
              ]}>
                {formTemplate ? 'Complete Form' : 'No Form'}
              </Text>
              {formTemplate && (
                <Text style={styles.quickActionSubLabel}>{formTemplate.name}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Job Reference */}
        <View style={styles.referenceCard}>
          <Text style={styles.referenceLabel}>Job Code</Text>
          <Text style={styles.referenceValue}>{job.code || `TC-${job.jobId}`}</Text>
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
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
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
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  tcBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#7c3aed',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'center',
    marginBottom: 16,
  },
  tcBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  jobNumber: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111',
    flexShrink: 1,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  typeIndicators: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  typeChipText: {
    fontSize: 12,
    color: '#4b5563',
    fontWeight: '500',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  addressText: {
    fontSize: 14,
    color: '#111',
    lineHeight: 20,
    marginBottom: 12,
  },
  notesBox: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: '#111',
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
  clientName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    flex: 1,
  },
  value: {
    fontSize: 14,
    color: '#111',
    flex: 2,
  },
  priceText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10b981',
  },
  historyItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  historyStatus: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563eb',
  },
  historyDate: {
    fontSize: 11,
    color: '#999',
  },
  historyDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  historyUser: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  moreText: {
    fontSize: 12,
    color: '#2563eb',
    textAlign: 'center',
    marginTop: 8,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  quickActionCard: {
    width: '47%',
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 12,
    gap: 8,
  },
  quickActionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
    textAlign: 'center',
  },
  quickActionCardPrimary: {
    backgroundColor: '#10b981',
  },
  quickActionCardDisabled: {
    backgroundColor: '#e5e7eb',
  },
  quickActionLabelPrimary: {
    color: '#fff',
  },
  quickActionLabelDisabled: {
    color: '#999',
  },
  quickActionSubLabel: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginTop: -4,
  },
  referenceCard: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  referenceLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
  },
  referenceValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
})
