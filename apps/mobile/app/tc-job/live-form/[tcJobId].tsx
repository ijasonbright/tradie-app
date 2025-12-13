import React, { useState, useEffect, useLayoutEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Image,
} from 'react-native'
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { apiClient } from '../../../lib/api-client'

// Types matching our API response format
interface AnswerOption {
  id: string
  text: string
  tc_answer_id?: number
}

interface FormQuestion {
  id: string
  question_text: string
  field_type: string
  csv_question_id: number
  csv_group_id: number
  group_name?: string
  sort_order: number
  required: boolean
  answer_options?: AnswerOption[]
  hint?: string
}

interface FormGroup {
  id: string
  name: string
  csv_group_id: number
  sort_order: number
  questions: FormQuestion[]
}

interface FormDefinition {
  template_id: string
  template_name: string
  tc_form_id: number
  tc_job_id: number
  groups: FormGroup[]
  _tc_raw?: any
}

export default function TCLiveFormScreen() {
  const { tcJobId, tcJobCode } = useLocalSearchParams()
  const router = useRouter()
  const navigation = useNavigation()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<FormDefinition | null>(null)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle')
  const [savedFiles, setSavedFiles] = useState<Record<string, string>>({}) // TC saved file URLs
  const [localPhotos, setLocalPhotos] = useState<Record<string, string>>({}) // Locally captured photos
  const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null) // Question ID being uploaded

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'TC Live Form',
      headerBackTitle: 'Back',
    })
  }, [navigation])

  useEffect(() => {
    fetchFormDefinition()
  }, [tcJobId])

  const fetchFormDefinition = async () => {
    try {
      setError(null)
      setLoading(true)

      console.log('Fetching TC Live Form definition for job:', tcJobId)
      const response = await apiClient.getTCLiveFormDefinition(tcJobId as string)

      if (response.success && response.form) {
        setForm(response.form)

        // Initialize form data - use saved answers if available, otherwise empty
        const initialData: Record<string, any> = {}
        const savedAnswers = response.saved_answers || {}

        response.form.groups.forEach(group => {
          group.questions.forEach(question => {
            // Check if we have a saved answer for this question
            initialData[question.id] = savedAnswers[question.id] || ''
          })
        })
        setFormData(initialData)

        // Load saved files (photos) from TC
        if (response.saved_files) {
          setSavedFiles(response.saved_files)
        }

        // Log how many saved answers/files were loaded
        const savedCount = Object.keys(savedAnswers).length
        const filesCount = response.saved_files ? Object.keys(response.saved_files).length : 0
        if (savedCount > 0 || filesCount > 0) {
          console.log(`Loaded ${savedCount} saved answers and ${filesCount} files from TradieConnect`)
          setSyncStatus('synced') // Show synced status since we have existing data
        }

        // Update header with form name
        navigation.setOptions({
          title: response.form.template_name || 'TC Live Form',
        })
      } else {
        setError(response.error || 'Failed to fetch form definition')
      }
    } catch (err: any) {
      console.error('Failed to fetch TC form:', err)
      setError(err.message || 'Failed to load form from TradieConnect')
    } finally {
      setLoading(false)
    }
  }

  const updateField = (questionId: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [questionId]: value,
    }))
    // Reset sync status when user makes changes
    if (syncStatus === 'synced') {
      setSyncStatus('idle')
    }
  }

  // Handle photo capture for file fields
  const handleCapturePhoto = async (questionId: string) => {
    try {
      // Request camera permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is required to take photos.')
        return
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      })

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri
        setUploadingPhoto(questionId)

        try {
          // Upload to our API - uses the new TC Live Form endpoint
          const response = await apiClient.uploadTCLiveFormPhoto(
            tcJobId as string,
            imageUri,
            questionId // question key like "tc_q_2279"
          )

          if (response.success && response.url) {
            // Store the uploaded URL in localPhotos
            setLocalPhotos(prev => ({
              ...prev,
              [questionId]: response.url,
            }))
            // Also update formData with the URL for syncing
            updateField(questionId, response.url)
            Alert.alert('Success', 'Photo uploaded successfully')
          } else {
            Alert.alert('Upload Failed', 'Failed to upload photo')
          }
        } catch (uploadError: any) {
          console.error('Photo upload error:', uploadError)
          Alert.alert('Upload Error', uploadError.message || 'Failed to upload photo')
        } finally {
          setUploadingPhoto(null)
        }
      }
    } catch (err: any) {
      console.error('Camera error:', err)
      Alert.alert('Camera Error', err.message || 'Failed to access camera')
    }
  }

  // Get the current photo URL for a question (local > saved from TC)
  const getPhotoUrl = (questionId: string): string | null => {
    return localPhotos[questionId] || savedFiles[questionId] || null
  }

  const handleSaveAndSync = async () => {
    if (!form) return

    try {
      setIsSaving(true)
      setSyncStatus('syncing')

      const currentGroup = form.groups[currentGroupIndex]

      console.log('Syncing answers to TC for group:', currentGroup.csv_group_id)

      const response = await apiClient.syncTCFormAnswers(tcJobId as string, {
        answers: formData,
        group_no: currentGroup.csv_group_id,
        is_complete: false,
      })

      if (response.success) {
        setSyncStatus('synced')
        Alert.alert('Synced', 'Answers saved and synced to TradieConnect')
      } else {
        setSyncStatus('error')
        Alert.alert('Sync Error', response.error || 'Failed to sync answers')
      }
    } catch (err: any) {
      console.error('Failed to sync answers:', err)
      setSyncStatus('error')
      Alert.alert('Error', err.message || 'Failed to sync answers to TradieConnect')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSubmit = async () => {
    if (!form) return

    Alert.alert(
      'Submit Form',
      'Are you sure you want to complete this form? This will mark the job as completed in TradieConnect.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          style: 'default',
          onPress: async () => {
            try {
              setIsSubmitting(true)
              setSyncStatus('syncing')

              const response = await apiClient.syncTCFormAnswers(tcJobId as string, {
                answers: formData,
                is_complete: true,
              })

              if (response.success) {
                setSyncStatus('synced')
                Alert.alert(
                  'Success',
                  'Form completed and synced to TradieConnect',
                  [
                    {
                      text: 'OK',
                      onPress: () => router.back(),
                    },
                  ]
                )
              } else {
                setSyncStatus('error')
                Alert.alert('Submit Error', response.error || 'Failed to submit form')
              }
            } catch (err: any) {
              console.error('Failed to submit form:', err)
              setSyncStatus('error')
              Alert.alert('Error', err.message || 'Failed to submit form')
            } finally {
              setIsSubmitting(false)
            }
          },
        },
      ]
    )
  }

  const handleNext = () => {
    if (form && currentGroupIndex < form.groups.length - 1) {
      setCurrentGroupIndex(currentGroupIndex + 1)
    }
  }

  const handlePrevious = () => {
    if (currentGroupIndex > 0) {
      setCurrentGroupIndex(currentGroupIndex - 1)
    }
  }

  // Render a form field based on its type
  const renderField = (question: FormQuestion) => {
    const value = formData[question.id] || ''

    switch (question.field_type) {
      case 'text':
        return (
          <TextInput
            style={styles.textInput}
            value={value}
            onChangeText={(text) => updateField(question.id, text)}
            placeholder="Enter answer..."
            placeholderTextColor="#999"
          />
        )

      case 'textarea':
        return (
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={value}
            onChangeText={(text) => updateField(question.id, text)}
            placeholder="Enter answer..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
          />
        )

      case 'radio':
        return (
          <View style={styles.optionsContainer}>
            {question.answer_options?.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.optionButton,
                  value === option.text && styles.optionButtonSelected,
                ]}
                onPress={() => updateField(question.id, option.text)}
              >
                <View style={styles.radioOuter}>
                  {value === option.text && <View style={styles.radioInner} />}
                </View>
                <Text style={[
                  styles.optionText,
                  value === option.text && styles.optionTextSelected,
                ]}>
                  {option.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )

      case 'dropdown':
        return (
          <View style={styles.optionsContainer}>
            {question.answer_options?.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.dropdownOption,
                  value === option.text && styles.dropdownOptionSelected,
                ]}
                onPress={() => updateField(question.id, option.text)}
              >
                <Text style={[
                  styles.optionText,
                  value === option.text && styles.optionTextSelected,
                ]}>
                  {option.text}
                </Text>
                {value === option.text && (
                  <MaterialCommunityIcons name="check" size={20} color="#10b981" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )

      case 'checkbox':
        return (
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => updateField(question.id, value === 'Yes' ? 'No' : 'Yes')}
          >
            <View style={[styles.checkbox, value === 'Yes' && styles.checkboxChecked]}>
              {value === 'Yes' && (
                <MaterialCommunityIcons name="check" size={16} color="#fff" />
              )}
            </View>
            <Text style={styles.checkboxLabel}>Yes</Text>
          </TouchableOpacity>
        )

      case 'file':
        const photoUrl = getPhotoUrl(question.id)
        const isUploading = uploadingPhoto === question.id
        return (
          <View style={styles.fileFieldContainer}>
            {photoUrl ? (
              <View style={styles.photoPreviewContainer}>
                <Image source={{ uri: photoUrl }} style={styles.photoPreview} resizeMode="cover" />
                <TouchableOpacity
                  style={styles.retakeButton}
                  onPress={() => handleCapturePhoto(question.id)}
                  disabled={isUploading}
                >
                  <MaterialCommunityIcons name="camera-retake" size={20} color="#fff" />
                  <Text style={styles.retakeButtonText}>Retake</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.captureButton}
                onPress={() => handleCapturePhoto(question.id)}
                disabled={isUploading}
              >
                {isUploading ? (
                  <ActivityIndicator size="small" color="#7c3aed" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="camera" size={32} color="#7c3aed" />
                    <Text style={styles.captureButtonText}>Take Photo</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )

      default:
        return (
          <TextInput
            style={styles.textInput}
            value={value}
            onChangeText={(text) => updateField(question.id, text)}
            placeholder="Enter answer..."
            placeholderTextColor="#999"
          />
        )
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7c3aed" />
          <Text style={styles.loadingText}>Fetching form from TradieConnect...</Text>
        </View>
      </View>
    )
  }

  if (error || !form) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="cloud-off-outline" size={64} color="#ef4444" />
          <Text style={styles.errorTitle}>Failed to Load Form</Text>
          <Text style={styles.errorText}>{error || 'Could not fetch form from TradieConnect'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchFormDefinition}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  const currentGroup = form.groups[currentGroupIndex]
  const progress = ((currentGroupIndex + 1) / form.groups.length) * 100

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      {/* TC Live Badge */}
      <View style={styles.tcLiveBanner}>
        <View style={styles.tcLiveBadge}>
          <MaterialCommunityIcons name="cloud-sync" size={16} color="#fff" />
          <Text style={styles.tcLiveText}>TC Live Form</Text>
        </View>
        <Text style={styles.tcJobText}>Job: {tcJobCode || tcJobId}</Text>
        {syncStatus !== 'idle' && (
          <View style={styles.syncStatusContainer}>
            {syncStatus === 'syncing' && <ActivityIndicator size="small" color="#fff" />}
            {syncStatus === 'synced' && <MaterialCommunityIcons name="check-circle" size={16} color="#10b981" />}
            {syncStatus === 'error' && <MaterialCommunityIcons name="alert-circle" size={16} color="#ef4444" />}
            <Text style={styles.syncStatusText}>
              {syncStatus === 'syncing' ? 'Syncing...' : syncStatus === 'synced' ? 'Synced' : 'Sync failed'}
            </Text>
          </View>
        )}
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBarBackground}>
          <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressText}>
          Section {currentGroupIndex + 1} of {form.groups.length}
        </Text>
      </View>

      {/* Current Group */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.groupHeader}>
          <Text style={styles.groupName}>{currentGroup.name}</Text>
        </View>

        {/* Questions */}
        <View style={styles.questionsContainer}>
          {currentGroup.questions.map((question) => (
            <View key={question.id} style={styles.questionContainer}>
              <View style={styles.questionHeader}>
                <Text style={styles.questionText}>
                  {question.question_text}
                  {question.required && <Text style={styles.requiredMark}> *</Text>}
                </Text>
              </View>
              {question.hint && (
                <Text style={styles.hintText}>{question.hint}</Text>
              )}
              {renderField(question)}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Navigation Buttons */}
      <View style={styles.navigationContainer}>
        <View style={styles.navigationRow}>
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton, currentGroupIndex === 0 && styles.buttonDisabled]}
            onPress={handlePrevious}
            disabled={currentGroupIndex === 0}
          >
            <Text style={styles.secondaryButtonText}>Previous</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.saveButton]}
            onPress={handleSaveAndSync}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save & Sync</Text>
            )}
          </TouchableOpacity>

          {currentGroupIndex < form.groups.length - 1 ? (
            <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={handleNext}>
              <Text style={styles.primaryButtonText}>Next</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.button, styles.submitButton]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Complete</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
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
    backgroundColor: '#7c3aed',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  tcLiveBanner: {
    backgroundColor: '#7c3aed',
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  tcLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tcLiveText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  tcJobText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
  },
  syncStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  syncStatusText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
  },
  progressContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: '#e5e5e5',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#7c3aed',
    borderRadius: 2,
  },
  progressText: {
    marginTop: 6,
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  groupHeader: {
    marginBottom: 20,
  },
  groupName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111',
  },
  questionsContainer: {
    gap: 20,
  },
  questionContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  questionHeader: {
    marginBottom: 12,
  },
  questionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111',
    lineHeight: 22,
  },
  requiredMark: {
    color: '#ef4444',
  },
  hintText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  textInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  optionsContainer: {
    gap: 8,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  optionButtonSelected: {
    backgroundColor: '#f0fdf4',
    borderColor: '#10b981',
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10b981',
  },
  optionText: {
    fontSize: 15,
    color: '#374151',
    flex: 1,
  },
  optionTextSelected: {
    color: '#065f46',
    fontWeight: '500',
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dropdownOptionSelected: {
    backgroundColor: '#f0fdf4',
    borderColor: '#10b981',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  checkboxLabel: {
    fontSize: 15,
    color: '#374151',
  },
  fileContainer: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  fileHint: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
  },
  fileFieldContainer: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    overflow: 'hidden',
  },
  captureButton: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  captureButtonText: {
    fontSize: 14,
    color: '#7c3aed',
    fontWeight: '500',
  },
  photoPreviewContainer: {
    position: 'relative',
  },
  photoPreview: {
    width: '100%',
    height: 200,
    backgroundColor: '#e5e5e5',
  },
  retakeButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  retakeButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  navigationContainer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
    padding: 16,
  },
  navigationRow: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#7c3aed',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#7c3aed',
  },
  secondaryButtonText: {
    color: '#7c3aed',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#10b981',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#f59e0b',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
})
