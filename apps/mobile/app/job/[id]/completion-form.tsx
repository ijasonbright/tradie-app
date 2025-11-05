import { View, Text, StyleSheet, Alert, ActivityIndicator, TouchableOpacity } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState, useEffect } from 'react'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { CompletionFormRenderer } from '../../../components/completion-forms/CompletionFormRenderer'
import { apiClient } from '../../../lib/api-client'

export default function CompletionFormScreen() {
  const { id, template_id } = useLocalSearchParams() // id = job ID, template_id from query string
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [existingFormId, setExistingFormId] = useState<string | null>(null)
  const [templateId, setTemplateId] = useState<string | null>(null)

  useEffect(() => {
    checkExistingForm()
  }, [])

  const checkExistingForm = async () => {
    try {
      setError(null)
      const response = await apiClient.getJobCompletionForm(id as string)

      if (response.form) {
        // Existing form found
        setExistingFormId(response.form.id)
        setTemplateId(response.form.template_id)
      } else if (template_id) {
        // New form with template selected - create empty draft immediately
        // This ensures the form exists before user tries to upload photos
        setTemplateId(template_id as string)

        console.log('Creating initial form draft for template:', template_id)
        const createResponse = await apiClient.saveJobCompletionForm(id as string, {
          template_id: template_id as string,
          form_data: {}, // Empty form data initially
          status: 'draft',
        })

        setExistingFormId(createResponse.form.id)
        console.log('Initial form draft created:', createResponse.form.id)
      } else {
        // No form and no template - redirect to template selection
        router.replace(`/job/${id}/completion-form-templates`)
        return
      }
    } catch (err: any) {
      console.error('Failed to check existing form:', err)
      setError(err.message || 'Failed to load completion form')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveDraft = async (formData: any) => {
    try {
      // Save or update draft
      const response = await apiClient.saveJobCompletionForm(id as string, {
        template_id: templateId!,
        form_data: formData,
        status: 'draft',
      })

      if (!existingFormId) {
        setExistingFormId(response.form.id)
      }

      Alert.alert('Success', 'Draft saved successfully')
    } catch (err: any) {
      console.error('Failed to save draft:', err)
      Alert.alert('Error', err.message || 'Failed to save draft')
      throw err
    }
  }

  const handleSubmit = async (formData: any) => {
    try {
      // First save the form data
      await apiClient.saveJobCompletionForm(id as string, {
        template_id: templateId!,
        form_data: formData,
        status: 'draft',
      })

      // Then submit it
      await apiClient.submitJobCompletionForm(id as string)

      Alert.alert(
        'Success',
        'Completion form submitted successfully',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      )
    } catch (err: any) {
      console.error('Failed to submit form:', err)
      Alert.alert('Error', err.message || 'Failed to submit form')
      throw err
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading completion form...</Text>
        </View>
      </View>
    )
  }

  if (error || !templateId) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle-outline" size={64} color="#ef4444" />
          <Text style={styles.errorTitle}>Failed to Load Form</Text>
          <Text style={styles.errorText}>{error || 'Template not found'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={checkExistingForm}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <CompletionFormRenderer
        templateId={templateId}
        jobId={id as string}
        onSave={handleSaveDraft}
        onSubmit={handleSubmit}
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
})
