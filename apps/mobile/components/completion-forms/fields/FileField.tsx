import React, { useState } from 'react'
import { View, Text, TouchableOpacity, Image, Alert, ActivityIndicator, StyleSheet } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { apiClient } from '@/lib/api-client'

interface FileFieldProps {
  question: any
  value: string
  onChange: (value: string) => void
  jobId: string
}

export function FileField({ question, value, onChange, jobId }: FileFieldProps) {
  const [isUploading, setIsUploading] = useState(false)

  const pickImage = async () => {
    const result = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!result.granted) {
      Alert.alert('Permission required', 'Please allow access to your photo library')
      return
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    })

    if (!pickerResult.canceled && pickerResult.assets[0]) {
      await uploadImage(pickerResult.assets[0].uri)
    }
  }

  const takePhoto = async () => {
    const result = await ImagePicker.requestCameraPermissionsAsync()
    if (!result.granted) {
      Alert.alert('Permission required', 'Please allow access to your camera')
      return
    }

    const pickerResult = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    })

    if (!pickerResult.canceled && pickerResult.assets[0]) {
      await uploadImage(pickerResult.assets[0].uri)
    }
  }

  const uploadImage = async (uri: string) => {
    try {
      setIsUploading(true)

      const response = await apiClient.uploadCompletionFormPhoto(
        jobId,
        uri,
        '', // caption
        'completion_form', // photo_type
        question.id // question_id
      )

      onChange(response.photo.photo_url)
      Alert.alert('Success', 'Photo uploaded successfully')
    } catch (error) {
      console.error('Upload failed:', error)
      Alert.alert('Error', 'Failed to upload photo')
    } finally {
      setIsUploading(false)
    }
  }

  const showOptions = () => {
    Alert.alert('Add Photo', 'Choose an option', [
      { text: 'Take Photo', onPress: takePhoto },
      { text: 'Choose from Library', onPress: pickImage },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  return (
    <View style={styles.container}>
      {value ? (
        <View>
          <Image source={{ uri: value }} style={styles.image} />
          <TouchableOpacity style={styles.changeButton} onPress={showOptions}>
            <Text style={styles.changeButtonText}>Change Photo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={showOptions}
          disabled={isUploading}
        >
          {isUploading ? (
            <ActivityIndicator color="#007AFF" />
          ) : (
            <>
              <Text style={styles.uploadIcon}>📷</Text>
              <Text style={styles.uploadText}>Add Photo</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {},
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
  image: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
  },
  changeButton: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    alignItems: 'center',
  },
  changeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
})
