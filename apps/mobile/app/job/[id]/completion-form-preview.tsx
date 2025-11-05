import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Image, Alert, Share, Platform } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState, useEffect } from 'react'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { apiClient } from '../../../lib/api-client'
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'

interface CompletionForm {
  id: string
  template_id: string
  template_name: string
  form_data: Record<string, any>
  status: string
  completion_date: string | null
  completed_by_name: string | null
  photos: Array<{
    id: string
    photo_url: string
    caption: string | null
    photo_type: string
  }>
  groups: Array<{
    id: string
    group_name: string
    group_order: number
    questions: Array<{
      id: string
      question_text: string
      field_type: string
      answer_options: Array<{ id: string; text: string }>
      is_required: boolean
    }>
  }>
}

export default function CompletionFormPreviewScreen() {
  const { id } = useLocalSearchParams() // job ID
  const router = useRouter()
  const [form, setForm] = useState<CompletionForm | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    fetchForm()
  }, [])

  const fetchForm = async () => {
    try {
      setError(null)
      const response = await apiClient.getJobCompletionForm(id as string)

      if (!response.form) {
        setError('No completion form found for this job')
        setLoading(false)
        return
      }

      setForm(response.form)
    } catch (err: any) {
      console.error('Failed to fetch form:', err)
      setError(err.message || 'Failed to load completion form')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadPDF = async () => {
    try {
      setDownloading(true)

      console.log('Downloading PDF for job:', id)

      // Download PDF blob
      const pdfBlob = await apiClient.downloadCompletionFormPDF(id as string)

      // Convert blob to base64 using FileReader (works in React Native)
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const dataUrl = reader.result as string
          const base64String = dataUrl.split(',')[1]
          resolve(base64String)
        }
        reader.onerror = reject
        reader.readAsDataURL(pdfBlob)
      })

      // Save to file system using new File API
      const filename = `completion-report-${id}.pdf`
      const file = new FileSystem.File(FileSystem.Paths.cache, filename)

      // Write the base64 data
      file.write(base64)

      console.log('PDF saved to:', file.uri)

      // Share the file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Job Completion Report',
          UTI: 'com.adobe.pdf',
        })
      } else {
        Alert.alert('Success', 'PDF downloaded successfully')
      }
    } catch (err: any) {
      console.error('Failed to download PDF:', err)
      Alert.alert('Error', err.message || 'Failed to download PDF')
    } finally {
      setDownloading(false)
    }
  }

  const handleSendToClient = async () => {
    Alert.alert(
      'Send Completion Report',
      'Send this completion report via email to the client?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            try {
              setSending(true)

              console.log('Sending completion report for job:', id)

              const response = await apiClient.sendCompletionReport(id as string)

              Alert.alert('Success', response.message || 'Completion report sent successfully')
            } catch (err: any) {
              console.error('Failed to send report:', err)
              Alert.alert('Error', err.message || 'Failed to send completion report')
            } finally {
              setSending(false)
            }
          },
        },
      ]
    )
  }

  const renderAnswer = (question: any, answer: any) => {
    if (answer === null || answer === undefined || answer === '') {
      return <Text style={styles.answerEmpty}>No answer provided</Text>
    }

    switch (question.field_type) {
      case 'multi_checkbox':
        if (Array.isArray(answer)) {
          return (
            <View style={styles.multiAnswer}>
              {answer.map((item, idx) => (
                <View key={idx} style={styles.checkboxItem}>
                  <MaterialCommunityIcons name="checkbox-marked" size={16} color="#10b981" />
                  <Text style={styles.answerText}>{item}</Text>
                </View>
              ))}
            </View>
          )
        }
        return <Text style={styles.answerText}>{answer}</Text>

      case 'checkbox':
        return (
          <View style={styles.checkboxItem}>
            <MaterialCommunityIcons
              name={answer ? 'checkbox-marked' : 'checkbox-blank-outline'}
              size={20}
              color={answer ? '#10b981' : '#999'}
            />
            <Text style={styles.answerText}>{answer ? 'Yes' : 'No'}</Text>
          </View>
        )

      case 'file':
        if (typeof answer === 'string' && answer.startsWith('http')) {
          return (
            <Image
              source={{ uri: answer }}
              style={styles.fileImage}
              resizeMode="cover"
            />
          )
        }
        return <Text style={styles.answerText}>{answer}</Text>

      case 'date':
        if (answer) {
          return (
            <Text style={styles.answerText}>
              {new Date(answer).toLocaleDateString('en-AU', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          )
        }
        return <Text style={styles.answerEmpty}>No date selected</Text>

      default:
        return <Text style={styles.answerText}>{answer.toString()}</Text>
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

  if (error || !form) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle-outline" size={64} color="#ef4444" />
          <Text style={styles.errorTitle}>No Completion Form</Text>
          <Text style={styles.errorText}>{error || 'This job does not have a completion form yet'}</Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => router.push(`/job/${id}/completion-form-templates`)}
          >
            <MaterialCommunityIcons name="plus" size={20} color="#fff" />
            <Text style={styles.createButtonText}>Create Completion Form</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header Card */}
        <View style={styles.headerCard}>
          <View style={styles.headerIcon}>
            <MaterialCommunityIcons name="file-document-check" size={32} color="#10b981" />
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.templateName}>{form.template_name}</Text>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusBadge,
                  form.status === 'submitted'
                    ? styles.statusSubmitted
                    : styles.statusDraft,
                ]}
              >
                <Text style={styles.statusText}>
                  {form.status === 'submitted' ? 'Submitted' : 'Draft'}
                </Text>
              </View>
              {form.completion_date && (
                <Text style={styles.completionDate}>
                  {new Date(form.completion_date).toLocaleDateString('en-AU')}
                </Text>
              )}
            </View>
            {form.completed_by_name && (
              <Text style={styles.completedBy}>Completed by {form.completed_by_name}</Text>
            )}
          </View>
        </View>

        {/* Form Sections */}
        {form.groups.map((group) => (
          <View key={group.id} style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="folder-outline" size={20} color="#2563eb" />
              <Text style={styles.sectionTitle}>{group.group_name}</Text>
            </View>

            {group.questions.map((question) => {
              const answer = form.form_data[question.id]

              return (
                <View key={question.id} style={styles.questionBlock}>
                  <View style={styles.questionHeader}>
                    <Text style={styles.questionText}>
                      {question.question_text}
                      {question.is_required && <Text style={styles.required}> *</Text>}
                    </Text>
                  </View>
                  <View style={styles.answerContainer}>
                    {renderAnswer(question, answer)}
                  </View>
                </View>
              )
            })}
          </View>
        ))}

        {/* Photos Section */}
        {form.photos && form.photos.length > 0 && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="camera" size={20} color="#2563eb" />
              <Text style={styles.sectionTitle}>Photos ({form.photos.length})</Text>
            </View>

            <View style={styles.photosGrid}>
              {form.photos.map((photo) => (
                <View key={photo.id} style={styles.photoItem}>
                  <Image
                    source={{ uri: photo.photo_url }}
                    style={styles.photoImage}
                    resizeMode="cover"
                  />
                  {photo.caption && (
                    <Text style={styles.photoCaption} numberOfLines={2}>
                      {photo.caption}
                    </Text>
                  )}
                  <View style={styles.photoTypeBadge}>
                    <Text style={styles.photoTypeText}>
                      {photo.photo_type.replace('_', ' ')}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Action Buttons */}
        {form.status === 'draft' && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => router.push(`/job/${id}/completion-form?template_id=${form.template_id}`)}
            >
              <MaterialCommunityIcons name="pencil" size={20} color="#fff" />
              <Text style={styles.editButtonText}>Continue Editing</Text>
            </TouchableOpacity>
          </View>
        )}

        {form.status === 'submitted' && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => router.push(`/job/${id}/completion-form?template_id=${form.template_id}`)}
            >
              <MaterialCommunityIcons name="pencil" size={20} color="#fff" />
              <Text style={styles.editButtonText}>Edit Form</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.downloadButton, downloading && styles.buttonDisabled]}
              onPress={handleDownloadPDF}
              disabled={downloading}
            >
              {downloading ? (
                <ActivityIndicator size="small" color="#2563eb" />
              ) : (
                <MaterialCommunityIcons name="file-pdf-box" size={20} color="#2563eb" />
              )}
              <Text style={styles.downloadButtonText}>
                {downloading ? 'Downloading...' : 'Download PDF'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.shareButton, sending && styles.buttonDisabled]}
              onPress={handleSendToClient}
              disabled={sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#2563eb" />
              ) : (
                <MaterialCommunityIcons name="email" size={20} color="#2563eb" />
              )}
              <Text style={styles.shareButtonText}>
                {sending ? 'Sending...' : 'Email to Client'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
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
  createButton: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 16,
  },
  headerCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  headerIcon: {
    width: 56,
    height: 56,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
    gap: 6,
  },
  templateName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusSubmitted: {
    backgroundColor: '#dcfce7',
  },
  statusDraft: {
    backgroundColor: '#fef3c7',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111',
  },
  completionDate: {
    fontSize: 13,
    color: '#666',
  },
  completedBy: {
    fontSize: 13,
    color: '#666',
  },
  sectionCard: {
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  questionBlock: {
    marginBottom: 16,
  },
  questionHeader: {
    marginBottom: 8,
  },
  questionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111',
    lineHeight: 20,
  },
  required: {
    color: '#ef4444',
  },
  answerContainer: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  answerText: {
    fontSize: 14,
    color: '#111',
    lineHeight: 20,
  },
  answerEmpty: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  multiAnswer: {
    gap: 8,
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fileImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoItem: {
    width: '48%',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f9fafb',
  },
  photoImage: {
    width: '100%',
    height: 120,
  },
  photoCaption: {
    fontSize: 12,
    color: '#666',
    padding: 8,
    lineHeight: 16,
  },
  photoTypeBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  photoTypeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'capitalize',
  },
  actions: {
    gap: 12,
    marginTop: 8,
    marginBottom: 24,
  },
  editButton: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  downloadButton: {
    backgroundColor: '#eff6ff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
  },
  downloadButtonText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '600',
  },
  shareButton: {
    backgroundColor: '#eff6ff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
  },
  shareButtonText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
})
