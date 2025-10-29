import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, RefreshControl, Modal, Image, Dimensions } from 'react-native'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { useState, useEffect } from 'react'
import { apiClient } from '../../../lib/api-client'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { FAB } from 'react-native-paper'
import * as ImagePicker from 'expo-image-picker'

const { width } = Dimensions.get('window')
const imageSize = (width - 48) / 3

export default function JobPhotosScreen() {
  const { id } = useLocalSearchParams()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [photos, setPhotos] = useState<any[]>([])
  const [selectedPhoto, setSelectedPhoto] = useState<any | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Form fields
  const [photoType, setPhotoType] = useState('during')
  const [caption, setCaption] = useState('')
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  useEffect(() => {
    fetchPhotos()
    requestPermissions()
  }, [id])

  const requestPermissions = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync()
    const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync()

    if (cameraStatus !== 'granted' || libraryStatus !== 'granted') {
      Alert.alert('Permissions Required', 'Camera and photo library access is required to upload photos')
    }
  }

  const fetchPhotos = async () => {
    try {
      setLoading(true)
      const response = await apiClient.getPhotos(id as string)
      setPhotos(response.photos || [])
    } catch (err: any) {
      console.error('Failed to fetch photos:', err)
      Alert.alert('Error', 'Failed to load photos')
    } finally {
      setLoading(false)
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchPhotos()
    setRefreshing(false)
  }

  const pickImage = async (useCamera: boolean) => {
    try {
      let result
      if (useCamera) {
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        })
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        })
      }

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri)
        setShowAddModal(true)
      }
    } catch (err: any) {
      Alert.alert('Error', 'Failed to pick image')
    }
  }

  const handleUploadPhoto = async () => {
    if (!selectedImage) {
      Alert.alert('Error', 'Please select an image')
      return
    }

    try {
      setUploading(true)

      // For now, we'll send the URI directly
      // In production, you'd upload to Vercel Blob first
      await apiClient.uploadPhoto(id as string, {
        photoUrl: selectedImage,
        thumbnailUrl: selectedImage,
        photoType,
        caption: caption.trim() || null,
      })

      setShowAddModal(false)
      resetForm()
      await fetchPhotos()
      Alert.alert('Success', 'Photo uploaded successfully')
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to upload photo')
    } finally {
      setUploading(false)
    }
  }

  const handleDeletePhoto = (photoId: string) => {
    Alert.alert(
      'Delete Photo',
      'Are you sure you want to delete this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.deletePhoto(id as string, photoId)
              await fetchPhotos()
              setSelectedPhoto(null)
              Alert.alert('Success', 'Photo deleted')
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete photo')
            }
          },
        },
      ]
    )
  }

  const resetForm = () => {
    setPhotoType('during')
    setCaption('')
    setSelectedImage(null)
  }

  const getPhotoTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      before: 'Before',
      during: 'During',
      after: 'After',
      issue: 'Issue',
      completion: 'Completion',
    }
    return labels[type] || type
  }

  const getPhotoTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      before: '#3b82f6',
      during: '#8b5cf6',
      after: '#10b981',
      issue: '#ef4444',
      completion: '#06b6d4',
    }
    return colors[type] || '#666'
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Photos' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Photos' }} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} tintColor="#2563eb" />
        }
      >
        {photos.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="camera-off" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No photos yet</Text>
            <Text style={styles.emptySubtext}>Tap the camera button to add photos</Text>
          </View>
        ) : (
          <View style={styles.photoGrid}>
            {photos.map((photo) => (
              <TouchableOpacity
                key={photo.id}
                style={styles.photoWrapper}
                onPress={() => setSelectedPhoto(photo)}
              >
                <Image
                  source={{ uri: photo.photo_url }}
                  style={styles.thumbnail}
                  resizeMode="cover"
                />
                <View style={[styles.photoTypeBadge, { backgroundColor: getPhotoTypeColor(photo.photo_type) }]}>
                  <Text style={styles.photoTypeBadgeText}>
                    {getPhotoTypeLabel(photo.photo_type)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Photo Detail Modal */}
      <Modal
        visible={!!selectedPhoto}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setSelectedPhoto(null)}
      >
        <View style={styles.photoModalOverlay}>
          <View style={styles.photoModalHeader}>
            <TouchableOpacity
              onPress={() => setSelectedPhoto(null)}
              style={styles.modalCloseButton}
            >
              <MaterialCommunityIcons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => selectedPhoto && handleDeletePhoto(selectedPhoto.id)}
              style={styles.modalDeleteButton}
            >
              <MaterialCommunityIcons name="delete" size={28} color="#fff" />
            </TouchableOpacity>
          </View>

          {selectedPhoto && (
            <>
              <Image
                source={{ uri: selectedPhoto.photo_url }}
                style={styles.fullImage}
                resizeMode="contain"
              />
              <View style={styles.photoModalInfo}>
                <View style={[styles.photoTypeBadge, { backgroundColor: getPhotoTypeColor(selectedPhoto.photo_type) }]}>
                  <Text style={styles.photoTypeBadgeText}>
                    {getPhotoTypeLabel(selectedPhoto.photo_type)}
                  </Text>
                </View>
                {selectedPhoto.caption && (
                  <Text style={styles.photoCaption}>{selectedPhoto.caption}</Text>
                )}
                <Text style={styles.photoDate}>
                  {new Date(selectedPhoto.uploaded_at).toLocaleString()}
                </Text>
              </View>
            </>
          )}
        </View>
      </Modal>

      {/* Add Photo Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Photo</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              {selectedImage && (
                <Image
                  source={{ uri: selectedImage }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
              )}

              <Text style={styles.label}>Photo Type</Text>
              <View style={styles.typeButtons}>
                {['before', 'during', 'after', 'issue', 'completion'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeButton, photoType === type && styles.typeButtonActive]}
                    onPress={() => setPhotoType(type)}
                  >
                    <Text style={[styles.typeButtonText, photoType === type && styles.typeButtonTextActive]}>
                      {getPhotoTypeLabel(type)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Caption (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={caption}
                onChangeText={setCaption}
                placeholder="Add a caption..."
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, uploading && styles.saveButtonDisabled]}
                onPress={handleUploadPhoto}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Upload</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Camera FAB */}
      <View style={styles.fabContainer}>
        <FAB
          icon="camera"
          style={[styles.fab, { backgroundColor: '#10b981' }]}
          onPress={() => pickImage(true)}
          small
        />
        <FAB
          icon="image"
          style={styles.fab}
          onPress={() => pickImage(false)}
          small
        />
      </View>
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
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 80,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoWrapper: {
    width: imageSize,
    height: imageSize,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  photoTypeBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  photoTypeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  photoModalOverlay: {
    flex: 1,
    backgroundColor: '#000',
  },
  photoModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 48,
  },
  modalCloseButton: {
    padding: 8,
  },
  modalDeleteButton: {
    padding: 8,
  },
  fullImage: {
    flex: 1,
    width: '100%',
  },
  photoModalInfo: {
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  photoCaption: {
    fontSize: 16,
    color: '#fff',
    marginTop: 8,
  },
  photoDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  fabContainer: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    gap: 12,
  },
  fab: {
    backgroundColor: '#2563eb',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
  },
  modalScroll: {
    padding: 16,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 12,
  },
  typeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  typeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  typeButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  typeButtonText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  input: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111',
    marginBottom: 8,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
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
