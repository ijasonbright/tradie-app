import React, { useState } from 'react'
import { View, Text, TouchableOpacity, Image, Alert, ActivityIndicator, StyleSheet, ScrollView } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { apiClient } from '@/lib/api-client'

interface FileFieldProps {
  question: any
  value: string | string[]
  onChange: (value: string | string[]) => void
  jobId: string
  isTCJob?: boolean
}

export function FileField({ question, value, onChange, jobId, isTCJob = false }: FileFieldProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null)

  // Convert value to array for consistent handling
  const photos = Array.isArray(value) ? value : value ? [value] : []

  const pickImages = async () => {
    const result = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!result.granted) {
      Alert.alert('Permission required', 'Please allow access to your photo library')
      return
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      allowsMultipleSelection: true,
      quality: 0.8,
    })

    if (!pickerResult.canceled && pickerResult.assets.length > 0) {
      await uploadImages(pickerResult.assets.map(asset => asset.uri))
    }
  }

  const takePhoto = async () => {
    const result = await ImagePicker.requestCameraPermissionsAsync()
    if (!result.granted) {
      Alert.alert('Permission required', 'Please allow access to your camera')
      return
    }

    const pickerResult = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
    })

    if (!pickerResult.canceled && pickerResult.assets[0]) {
      await uploadImages([pickerResult.assets[0].uri])
    }
  }

  const uploadImages = async (uris: string[]) => {
    try {
      setIsUploading(true)
      setUploadProgress({ current: 0, total: uris.length })
      const uploadedUrls: string[] = []

      for (let i = 0; i < uris.length; i++) {
        const uri = uris[i]
        setUploadProgress({ current: i + 1, total: uris.length })

        const response = isTCJob
          ? await apiClient.uploadTCCompletionFormPhoto(
              jobId,
              uri,
              '', // caption
              'completion_form', // photo_type
              question.id // question_id
            )
          : await apiClient.uploadCompletionFormPhoto(
              jobId,
              uri,
              '', // caption
              'completion_form', // photo_type
              question.id // question_id
            )
        uploadedUrls.push(response.photo.photo_url)
      }

      // Add new photos to existing ones
      const updatedPhotos = [...photos, ...uploadedUrls]
      onChange(updatedPhotos)

      Alert.alert('Success', `${uploadedUrls.length} photo${uploadedUrls.length > 1 ? 's' : ''} uploaded successfully`)
    } catch (error) {
      console.error('Upload failed:', error)
      Alert.alert('Error', 'Failed to upload photos')
    } finally {
      setIsUploading(false)
      setUploadProgress(null)
    }
  }

  const removePhoto = (indexToRemove: number) => {
    const updatedPhotos = photos.filter((_, index) => index !== indexToRemove)
    onChange(updatedPhotos.length > 0 ? updatedPhotos : '')
  }

  const showOptions = () => {
    Alert.alert('Add Photos', 'Choose an option', [
      { text: 'Take Photo', onPress: takePhoto },
      { text: 'Choose from Library', onPress: pickImages },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  return (
    <View style={styles.container}>
      {photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScroll}>
          {photos.map((photoUrl, index) => (
            <View key={index} style={styles.photoContainer}>
              <Image source={{ uri: photoUrl }} style={styles.image} />
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removePhoto(index)}
              >
                <MaterialCommunityIcons name="close-circle" size={24} color="#ff3b30" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      <TouchableOpacity
        style={styles.uploadButton}
        onPress={showOptions}
        disabled={isUploading}
      >
        {isUploading ? (
          <>
            <ActivityIndicator color="#007AFF" />
            {uploadProgress && (
              <Text style={styles.uploadProgressText}>
                Uploading {uploadProgress.current} of {uploadProgress.total}...
              </Text>
            )}
          </>
        ) : (
          <>
            <Text style={styles.uploadIcon}>📷</Text>
            <Text style={styles.uploadText}>
              {photos.length > 0 ? 'Add More Photos' : 'Add Photos'}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  photosScroll: {
    marginBottom: 8,
  },
  photoContainer: {
    position: 'relative',
    marginRight: 12,
  },
  uploadButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  uploadText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  uploadProgressText: {
    fontSize: 14,
    color: '#007AFF',
    marginTop: 8,
  },
  image: {
    width: 200,
    height: 200,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
})
