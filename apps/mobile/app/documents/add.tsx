import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Platform } from 'react-native'
import { useState } from 'react'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import * as DocumentPicker from 'expo-document-picker'
import DateTimePicker from '@react-native-community/datetimepicker'
import { apiClient } from '../../lib/api-client'

const DOCUMENT_TYPES = [
  { value: 'license', label: 'Trade License' },
  { value: 'certification', label: 'Certification' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'white_card', label: 'White Card' },
  { value: 'drivers_license', label: "Driver's License" },
  { value: 'other', label: 'Other' },
]

export default function AddDocumentScreen() {
  const router = useRouter()
  const { type } = useLocalSearchParams<{ type: string }>()
  const isOrganization = type === 'organization'

  const [uploading, setUploading] = useState(false)

  const [title, setTitle] = useState('')
  const [documentType, setDocumentType] = useState('license')
  const [documentNumber, setDocumentNumber] = useState('')
  const [issuingAuthority, setIssuingAuthority] = useState('')
  const [issueDate, setIssueDate] = useState(new Date())
  const [expiryDate, setExpiryDate] = useState(new Date())
  const [hasExpiry, setHasExpiry] = useState(true)
  const [selectedFile, setSelectedFile] = useState<any>(null)

  const [showIssueDatePicker, setShowIssueDatePicker] = useState(false)
  const [showExpiryDatePicker, setShowExpiryDatePicker] = useState(false)

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      })

      if (result.assets && result.assets[0]) {
        setSelectedFile(result.assets[0])
      }
    } catch (err) {
      console.error('Error picking document:', err)
      Alert.alert('Error', 'Failed to pick document')
    }
  }

  const handleUpload = async () => {
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Title is required')
      return
    }

    if (!selectedFile) {
      Alert.alert('Validation Error', 'Please select a file to upload')
      return
    }

    try {
      setUploading(true)

      const documentData = {
        title: title.trim(),
        document_type: documentType,
        document_number: documentNumber.trim() || null,
        issuing_authority: issuingAuthority.trim() || null,
        issue_date: issueDate.toISOString().split('T')[0],
        expiry_date: hasExpiry ? expiryDate.toISOString().split('T')[0] : null,
        file_uri: selectedFile.uri,
        file_name: selectedFile.name,
        file_type: selectedFile.mimeType,
      }

      if (isOrganization) {
        await apiClient.uploadOrganizationDocument(documentData)
      } else {
        await apiClient.uploadUserDocument(documentData)
      }

      Alert.alert('Success', 'Document uploaded successfully', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ])
    } catch (err: any) {
      console.error('Failed to upload document:', err)
      Alert.alert('Error', err.message || 'Failed to upload document')
    } finally {
      setUploading(false)
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Info */}
        <View style={styles.infoCard}>
          <MaterialCommunityIcons name="information" size={20} color="#2563eb" />
          <Text style={styles.infoText}>
            {isOrganization
              ? 'Upload business documents like insurance, licenses, and certifications'
              : 'Upload your personal trade licenses, certifications, and qualifications'}
          </Text>
        </View>

        {/* Basic Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Document Details</Text>

          <Text style={styles.label}>Document Title *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g., Electrical License"
          />

          <Text style={styles.label}>Document Type</Text>
          <View style={styles.typeGrid}>
            {DOCUMENT_TYPES.map((dt) => (
              <TouchableOpacity
                key={dt.value}
                style={[styles.typeButton, documentType === dt.value && styles.typeButtonActive]}
                onPress={() => setDocumentType(dt.value)}
              >
                <Text style={[styles.typeButtonText, documentType === dt.value && styles.typeButtonTextActive]}>
                  {dt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Document Number</Text>
          <TextInput
            style={styles.input}
            value={documentNumber}
            onChangeText={setDocumentNumber}
            placeholder="Optional"
          />

          <Text style={styles.label}>Issuing Authority</Text>
          <TextInput
            style={styles.input}
            value={issuingAuthority}
            onChangeText={setIssuingAuthority}
            placeholder="e.g., VBA, WorkSafe"
          />
        </View>

        {/* Dates */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dates</Text>

          <Text style={styles.label}>Issue Date</Text>
          <TouchableOpacity style={styles.dateButton} onPress={() => setShowIssueDatePicker(true)}>
            <MaterialCommunityIcons name="calendar" size={20} color="#666" />
            <Text style={styles.dateButtonText}>{issueDate.toLocaleDateString('en-AU')}</Text>
          </TouchableOpacity>

          {showIssueDatePicker && (
            <DateTimePicker
              value={issueDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, date) => {
                setShowIssueDatePicker(false)
                if (date) setIssueDate(date)
              }}
            />
          )}

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setHasExpiry(!hasExpiry)}
          >
            <View style={[styles.checkbox, hasExpiry && styles.checkboxActive]}>
              {hasExpiry && <MaterialCommunityIcons name="check" size={16} color="#fff" />}
            </View>
            <Text style={styles.checkboxLabel}>This document has an expiry date</Text>
          </TouchableOpacity>

          {hasExpiry && (
            <>
              <Text style={styles.label}>Expiry Date</Text>
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowExpiryDatePicker(true)}>
                <MaterialCommunityIcons name="calendar" size={20} color="#666" />
                <Text style={styles.dateButtonText}>{expiryDate.toLocaleDateString('en-AU')}</Text>
              </TouchableOpacity>

              {showExpiryDatePicker && (
                <DateTimePicker
                  value={expiryDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, date) => {
                    setShowExpiryDatePicker(false)
                    if (date) setExpiryDate(date)
                  }}
                  minimumDate={new Date()}
                />
              )}
            </>
          )}
        </View>

        {/* File Upload */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upload File</Text>

          {selectedFile ? (
            <View style={styles.selectedFile}>
              <MaterialCommunityIcons name="file-check" size={32} color="#10b981" />
              <View style={styles.selectedFileInfo}>
                <Text style={styles.selectedFileName}>{selectedFile.name}</Text>
                <Text style={styles.selectedFileSize}>
                  {(selectedFile.size / 1024).toFixed(0)} KB
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedFile(null)}>
                <MaterialCommunityIcons name="close-circle" size={24} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.uploadButton} onPress={handlePickDocument}>
              <MaterialCommunityIcons name="cloud-upload" size={48} color="#2563eb" />
              <Text style={styles.uploadButtonText}>Tap to select file</Text>
              <Text style={styles.uploadButtonHint}>PDF or Image (JPG, PNG)</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.saveButton, uploading && styles.saveButtonDisabled]}
          onPress={handleUpload}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialCommunityIcons name="upload" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Upload Document</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 16,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    backgroundColor: '#fff',
  },
  typeButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    padding: 14,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#111',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  checkboxLabel: {
    fontSize: 15,
    color: '#111',
  },
  uploadButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    borderWidth: 2,
    borderColor: '#e5e5e5',
    borderStyle: 'dashed',
    borderRadius: 12,
    backgroundColor: '#f9f9f9',
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563eb',
    marginTop: 12,
  },
  uploadButtonHint: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  selectedFile: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  selectedFileInfo: {
    flex: 1,
    marginLeft: 12,
  },
  selectedFileName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
    marginBottom: 2,
  },
  selectedFileSize: {
    fontSize: 13,
    color: '#666',
  },
  saveButton: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 8,
    marginBottom: 32,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
})
