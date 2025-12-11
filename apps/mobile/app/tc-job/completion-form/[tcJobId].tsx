import { View, Text, StyleSheet, Alert, ActivityIndicator, TouchableOpacity } from 'react-native'
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router'
import { useState, useEffect, useLayoutEffect } from 'react'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { CompletionFormRenderer } from '../../../components/completion-forms/CompletionFormRenderer'
import { apiClient } from '../../../lib/api-client'

export default function TCCompletionFormScreen() {
  const { tcJobId, templateId, tcJobCode, formName } = useLocalSearchParams()
  const router = useRouter()
  const navigation = useNavigation()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [existingFormId, setExistingFormId] = useState<string | null>(null)

  useLayoutEffect(() => {
    navigation.setOptions({
      title: formName || 'Completion Form',
      headerBackTitle: 'Back',
    })
  }, [navigation, formName])

  useEffect(() => {
    initializeForm()
  }, [])

  const initializeForm = async () => {
    try {
      setError(null)

      // For TC jobs, we need to check if a form exists for this TC job
      // or create a new one if not
      const response = await apiClient.getTCJobCompletionForm(tcJobId as string)

      if (response.form) {
        // Existing form found
        setExistingFormId(response.form.id)
      } else if (templateId) {
        // Create new form for TC job
        console.log('Creating TC job completion form with template:', templateId)
        const createResponse = await apiClient.saveTCJobCompletionForm(tcJobId as string, {
          template_id: templateId as string,
          tc_job_code: tcJobCode as string,
          form_data: {},
          status: 'draft',
        })
        setExistingFormId(createResponse.form.id)
      } else {
        setError('No template selected')
      }
    } catch (err: any) {
      console.error('Failed to initialize form:', err)
      setError(err.message || 'Failed to load completion form')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveDraft = async (formData: any) => {
    try {
      await apiClient.saveTCJobCompletionForm(tcJobId as string, {
        template_id: templateId as string,
        tc_job_code: tcJobCode as string,
        form_data: formData,
        status: 'draft',
      })
      Alert.alert('Success', 'Draft saved successfully')
    } catch (err: any) {
      console.error('Failed to save draft:', err)
      Alert.alert('Error', err.message || 'Failed to save draft')
      throw err
    }
  }

  const handleSubmit = async (formData: any) => {
    try {
      // Save and submit
      await apiClient.saveTCJobCompletionForm(tcJobId as string, {
        template_id: templateId as string,
        tc_job_code: tcJobCode as string,
        form_data: formData,
        status: 'submitted',
      })

      // TODO: Submit to TradieConnect API

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
          <TouchableOpacity style={styles.retryButton} onPress={initializeForm}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* TC Job header */}
      <View style={styles.tcJobHeader}>
        <MaterialCommunityIcons name="briefcase-outline" size={18} color="#2563eb" />
        <Text style={styles.tcJobCode}>TC Job: {tcJobCode}</Text>
      </View>

      <CompletionFormRenderer
        templateId={templateId as string}
        jobId={tcJobId as string}
        onSave={handleSaveDraft}
        onSubmit={handleSubmit}
        isTCJob={true}
        tcJobCode={tcJobCode as string}
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
  tcJobHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#dbeafe',
  },
  tcJobCode: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
})
