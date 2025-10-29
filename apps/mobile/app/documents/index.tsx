import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native'
import { useState, useEffect } from 'react'
import { useRouter } from 'expo-router'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { FAB } from 'react-native-paper'
import { apiClient } from '../../lib/api-client'

const DOCUMENT_TYPES: Record<string, { icon: string; label: string; color: string }> = {
  license: { icon: 'card-account-details', label: 'Trade License', color: '#3b82f6' },
  certification: { icon: 'certificate', label: 'Certification', color: '#8b5cf6' },
  insurance: { icon: 'shield-check', label: 'Insurance', color: '#10b981' },
  white_card: { icon: 'hard-hat', label: 'White Card', color: '#f59e0b' },
  drivers_license: { icon: 'car', label: "Driver's License", color: '#06b6d4' },
  other: { icon: 'file-document', label: 'Other', color: '#6b7280' },
}

export default function DocumentsScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [documents, setDocuments] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [selectedTab, setSelectedTab] = useState<'personal' | 'organization'>('personal')

  useEffect(() => {
    fetchDocuments()
  }, [selectedTab])

  const fetchDocuments = async () => {
    try {
      setError(null)
      const response = selectedTab === 'personal'
        ? await apiClient.getUserDocuments()
        : await apiClient.getOrganizationDocuments()

      setDocuments(response.documents || [])
    } catch (err: any) {
      console.error('Failed to fetch documents:', err)
      setError(err.message || 'Failed to load documents')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const onRefresh = () => {
    setRefreshing(true)
    fetchDocuments()
  }

  const handleDocumentPress = (doc: any) => {
    // Navigate to document detail or open file
    Alert.alert(
      doc.title,
      `Type: ${doc.document_type}\nExpiry: ${doc.expiry_date ? new Date(doc.expiry_date).toLocaleDateString() : 'No expiry'}`,
      [
        { text: 'View', onPress: () => console.log('Open file:', doc.file_url) },
        { text: 'Cancel', style: 'cancel' },
      ]
    )
  }

  const handleDeleteDocument = async (docId: string) => {
    Alert.alert(
      'Delete Document',
      'Are you sure you want to delete this document?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (selectedTab === 'personal') {
                await apiClient.deleteUserDocument(docId)
              } else {
                await apiClient.deleteOrganizationDocument(docId)
              }
              fetchDocuments()
            } catch (err: any) {
              Alert.alert('Error', 'Failed to delete document')
            }
          },
        },
      ]
    )
  }

  const isExpiringSoon = (expiryDate: string | null) => {
    if (!expiryDate) return false
    const expiry = new Date(expiryDate)
    const today = new Date()
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0
  }

  const isExpired = (expiryDate: string | null) => {
    if (!expiryDate) return false
    return new Date(expiryDate) < new Date()
  }

  const renderDocument = (doc: any) => {
    const docType = DOCUMENT_TYPES[doc.document_type] || DOCUMENT_TYPES.other
    const expired = isExpired(doc.expiry_date)
    const expiringSoon = isExpiringSoon(doc.expiry_date)

    return (
      <TouchableOpacity
        key={doc.id}
        style={styles.documentCard}
        onPress={() => handleDocumentPress(doc)}
        onLongPress={() => handleDeleteDocument(doc.id)}
      >
        <View style={[styles.documentIcon, { backgroundColor: docType.color + '20' }]}>
          <MaterialCommunityIcons name={docType.icon as any} size={24} color={docType.color} />
        </View>

        <View style={styles.documentInfo}>
          <Text style={styles.documentTitle}>{doc.title}</Text>
          <Text style={styles.documentType}>{docType.label}</Text>

          {doc.document_number && (
            <View style={styles.documentMeta}>
              <MaterialCommunityIcons name="numeric" size={14} color="#666" />
              <Text style={styles.documentMetaText}>{doc.document_number}</Text>
            </View>
          )}

          {doc.expiry_date && (
            <View style={styles.documentMeta}>
              <MaterialCommunityIcons
                name="calendar"
                size={14}
                color={expired ? '#ef4444' : expiringSoon ? '#f59e0b' : '#666'}
              />
              <Text
                style={[
                  styles.documentMetaText,
                  expired && styles.expiredText,
                  expiringSoon && styles.expiringText,
                ]}
              >
                Expires: {new Date(doc.expiry_date).toLocaleDateString()}
              </Text>
            </View>
          )}
        </View>

        {(expired || expiringSoon) && (
          <View style={[styles.statusBadge, expired ? styles.expiredBadge : styles.expiringBadge]}>
            <MaterialCommunityIcons
              name={expired ? 'alert-circle' : 'alert'}
              size={16}
              color="#fff"
            />
          </View>
        )}

        <MaterialCommunityIcons name="chevron-right" size={24} color="#ccc" />
      </TouchableOpacity>
    )
  }

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading documents...</Text>
        </View>
      </View>
    )
  }

  const expiringCount = documents.filter(d => isExpiringSoon(d.expiry_date) || isExpired(d.expiry_date)).length

  return (
    <View style={styles.container}>
      {/* Tab Switcher */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'personal' && styles.tabActive]}
          onPress={() => setSelectedTab('personal')}
        >
          <MaterialCommunityIcons
            name="account"
            size={20}
            color={selectedTab === 'personal' ? '#2563eb' : '#666'}
          />
          <Text style={[styles.tabText, selectedTab === 'personal' && styles.tabTextActive]}>
            My Documents
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'organization' && styles.tabActive]}
          onPress={() => setSelectedTab('organization')}
        >
          <MaterialCommunityIcons
            name="domain"
            size={20}
            color={selectedTab === 'organization' ? '#2563eb' : '#666'}
          />
          <Text style={[styles.tabText, selectedTab === 'organization' && styles.tabTextActive]}>
            Organization
          </Text>
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <MaterialCommunityIcons name="alert-circle" size={20} color="#fff" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Expiring Alert */}
      {expiringCount > 0 && (
        <View style={styles.alertBanner}>
          <MaterialCommunityIcons name="alert" size={20} color="#f59e0b" />
          <Text style={styles.alertText}>
            {expiringCount} document{expiringCount > 1 ? 's' : ''} expiring soon or expired
          </Text>
        </View>
      )}

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
        {documents.length > 0 ? (
          documents.map(renderDocument)
        ) : (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="file-document-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No documents yet</Text>
            <Text style={styles.emptySubtext}>Tap the + button to add a document</Text>
          </View>
        )}
      </ScrollView>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => router.push(`/documents/add?type=${selectedTab}`)}
        label="Add"
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#2563eb',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#2563eb',
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
  alertBanner: {
    backgroundColor: '#fef3c7',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#fde68a',
  },
  alertText: {
    flex: 1,
    color: '#92400e',
    fontSize: 13,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 80,
  },
  documentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  documentIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  documentInfo: {
    flex: 1,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 4,
  },
  documentType: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
  },
  documentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  documentMetaText: {
    fontSize: 12,
    color: '#666',
  },
  expiredText: {
    color: '#ef4444',
    fontWeight: '600',
  },
  expiringText: {
    color: '#f59e0b',
    fontWeight: '600',
  },
  statusBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  expiredBadge: {
    backgroundColor: '#ef4444',
  },
  expiringBadge: {
    backgroundColor: '#f59e0b',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
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
