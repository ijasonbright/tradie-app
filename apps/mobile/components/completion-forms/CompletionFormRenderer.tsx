import React, { useState, useEffect } from 'react'
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
} from 'react-native'
import { useCompletionForm } from './useCompletionForm'
import { FormField } from './FormField'

interface CompletionFormRendererProps {
  templateId: string
  jobId: string
  onSave?: (formData: any) => void
  onSubmit?: (formData: any) => void
  isTCJob?: boolean  // If true, use TC-specific API endpoints
  tcJobCode?: string // TC job code for saving
}

export function CompletionFormRenderer({
  templateId,
  jobId,
  onSave,
  onSubmit,
  isTCJob = false,
  tcJobCode,
}: CompletionFormRendererProps) {
  const {
    template,
    formData,
    errors,
    isLoading,
    isSaving,
    isSubmitting,
    updateField,
    validateForm,
    saveForm,
    submitForm,
  } = useCompletionForm(templateId, jobId, { isTCJob, tcJobCode })

  const [currentGroupIndex, setCurrentGroupIndex] = useState(0)
  const [validatedSections, setValidatedSections] = useState<Set<number>>(new Set())

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading form...</Text>
      </View>
    )
  }

  if (!template) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Template not found</Text>
      </View>
    )
  }

  const currentGroup = template.groups[currentGroupIndex]
  const progress = ((currentGroupIndex + 1) / template.groups.length) * 100

  const handleNext = () => {
    if (currentGroupIndex < template.groups.length - 1) {
      setCurrentGroupIndex(currentGroupIndex + 1)
    }
  }

  const handlePrevious = () => {
    if (currentGroupIndex > 0) {
      setCurrentGroupIndex(currentGroupIndex - 1)
    }
  }

  const handleSave = async () => {
    try {
      await saveForm()
      Alert.alert('Success', 'Form saved as draft')
      onSave?.(formData)
    } catch (error) {
      Alert.alert('Error', 'Failed to save form')
    }
  }

  const handleSubmit = async () => {
    // Mark all sections as validated when submitting
    const allSections = new Set(template.groups.map((_, index) => index))
    setValidatedSections(allSections)

    const validationErrors = validateForm()
    if (Object.keys(validationErrors).length > 0) {
      Alert.alert('Validation Error', 'Please fill in all required fields')
      return
    }

    Alert.alert(
      'Submit Form',
      'Are you sure you want to submit this form? You will not be able to edit it after submission.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          style: 'default',
          onPress: async () => {
            try {
              await submitForm()
              Alert.alert('Success', 'Form submitted successfully')
              onSubmit?.(formData)
            } catch (error) {
              Alert.alert('Error', 'Failed to submit form')
            }
          },
        },
      ]
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBarBackground}>
          <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressText}>
          Section {currentGroupIndex + 1} of {template.groups.length}
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
          {currentGroup.description && (
            <Text style={styles.groupDescription}>{currentGroup.description}</Text>
          )}
        </View>

        {/* Questions */}
        <View style={styles.questionsContainer}>
          {currentGroup.questions.map((question: any) => (
            <FormField
              key={question.id}
              question={question}
              value={formData[question.id]}
              error={validatedSections.has(currentGroupIndex) ? errors[question.id] : undefined}
              onChange={(value) => updateField(question.id, value)}
              jobId={jobId}
            />
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
            onPress={handleSave}
            disabled={isSaving}
          >
            <Text style={styles.saveButtonText}>
              {isSaving ? 'Saving...' : 'Save Draft'}
            </Text>
          </TouchableOpacity>

          {currentGroupIndex < template.groups.length - 1 ? (
            <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={handleNext}>
              <Text style={styles.primaryButtonText}>Next</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.button, styles.submitButton]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              <Text style={styles.submitButtonText}>
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </Text>
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
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
  },
  progressContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: '#E5E5E5',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#007AFF',
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  groupDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  questionsContainer: {
    gap: 16,
  },
  navigationContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
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
    backgroundColor: '#007AFF',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#34C759',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#FF9500',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
})
