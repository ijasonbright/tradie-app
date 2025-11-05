import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState, useEffect } from 'react'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { apiClient } from '../../../lib/api-client'

interface Template {
  id: string
  name: string
  description: string | null
  group_count: number
  question_count: number
  is_global: boolean
}

export default function CompletionFormTemplatesScreen() {
  const { id } = useLocalSearchParams() // job ID
  const router = useRouter()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      setError(null)
      const response = await apiClient.get('/completion-forms/templates')
      console.log('Fetched templates:', response)
      setTemplates(response.templates || [])
    } catch (err: any) {
      console.error('Failed to fetch templates:', err)
      setError(err.message || 'Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectTemplate = (templateId: string) => {
    router.push(`/job/${id}/completion-form?template_id=${templateId}`)
  }

  const renderTemplate = ({ item }: { item: Template }) => (
    <TouchableOpacity
      style={styles.templateCard}
      onPress={() => handleSelectTemplate(item.id)}
    >
      <View style={styles.templateHeader}>
        <View style={styles.templateIcon}>
          <MaterialCommunityIcons name="file-document-outline" size={32} color="#2563eb" />
        </View>
        <View style={styles.templateInfo}>
          <Text style={styles.templateName}>{item.name}</Text>
          {item.description && (
            <Text style={styles.templateDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}
          <View style={styles.templateMeta}>
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="folder-outline" size={14} color="#666" />
              <Text style={styles.metaText}>{item.group_count} sections</Text>
            </View>
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="help-circle-outline" size={14} color="#666" />
              <Text style={styles.metaText}>{item.question_count} questions</Text>
            </View>
            {item.is_global && (
              <View style={[styles.metaItem, styles.globalBadge]}>
                <MaterialCommunityIcons name="earth" size={14} color="#10b981" />
                <Text style={styles.globalText}>Global</Text>
              </View>
            )}
          </View>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={24} color="#ccc" />
      </View>
    </TouchableOpacity>
  )

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading templates...</Text>
        </View>
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle-outline" size={64} color="#ef4444" />
          <Text style={styles.errorTitle}>Failed to Load Templates</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchTemplates}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Select a Completion Form</Text>
        <Text style={styles.headerSubtitle}>
          Choose the form template that matches this job type
        </Text>
      </View>

      <FlatList
        data={templates}
        renderItem={renderTemplate}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="file-document-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No templates available</Text>
            <Text style={styles.emptySubtext}>
              Contact your administrator to add completion form templates
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
  header: {
    backgroundColor: '#fff',
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  list: {
    padding: 16,
  },
  templateCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  templateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  templateIcon: {
    width: 56,
    height: 56,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateInfo: {
    flex: 1,
    gap: 4,
  },
  templateName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 2,
  },
  templateDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  templateMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#666',
  },
  globalBadge: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  globalText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10b981',
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
    paddingHorizontal: 32,
  },
})
