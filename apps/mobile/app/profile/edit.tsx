import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native'
import { useState, useEffect } from 'react'
import { useRouter } from 'expo-router'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { Avatar } from 'react-native-paper'
import { useUser } from '../../lib/auth'
import { apiClient } from '../../lib/api-client'

export default function EditProfileScreen() {
  const router = useRouter()
  const { user: clerkUser } = useUser()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null)

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const response = await apiClient.getCurrentUser()
        const dbUser = response.user

        // Use database values or fall back to Clerk
        setFullName(dbUser.full_name || `${clerkUser?.firstName || ''} ${clerkUser?.lastName || ''}`.trim())
        setEmail(dbUser.email || clerkUser?.primaryEmailAddress?.emailAddress || '')
        setPhone(dbUser.phone || clerkUser?.primaryPhoneNumber?.phoneNumber || '')
        setProfilePhotoUrl(dbUser.profile_photo_url || null)
      } catch (error) {
        console.error('Failed to fetch user profile:', error)
        // Fall back to Clerk data
        if (clerkUser) {
          setFullName(`${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim())
          setEmail(clerkUser.primaryEmailAddress?.emailAddress || '')
          setPhone(clerkUser.primaryPhoneNumber?.phoneNumber || '')
        }
      } finally {
        setLoading(false)
      }
    }

    if (clerkUser) {
      fetchUserProfile()
    }
  }, [clerkUser])

  const handleChoosePhoto = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync()

    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photo library')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })

    if (!result.canceled && result.assets[0]) {
      setProfilePhotoUrl(result.assets[0].uri)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)

      // Update via API
      await apiClient.updateUserProfile({
        full_name: fullName.trim(),
        phone: phone.trim(),
        profile_photo_url: profilePhotoUrl,
      })

      Alert.alert('Success', 'Profile updated successfully')
      router.back()
    } catch (err: any) {
      console.error('Failed to update profile:', err)
      Alert.alert('Error', err.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Photo */}
        <View style={styles.photoSection}>
          <TouchableOpacity onPress={handleChoosePhoto} style={styles.photoContainer}>
            {profilePhotoUrl || clerkUser?.imageUrl ? (
              <Avatar.Image
                size={120}
                source={{ uri: profilePhotoUrl || clerkUser?.imageUrl }}
              />
            ) : (
              <Avatar.Text
                size={120}
                label={fullName.split(' ').map(n => n[0]).join('').toUpperCase() || '?'}
                style={styles.avatar}
              />
            )}
            <View style={styles.photoOverlay}>
              <MaterialCommunityIcons name="camera" size={24} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={styles.photoHint}>Tap to change photo</Text>
        </View>

        {/* Form Fields */}
        <View style={styles.section}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Enter your full name"
            autoCapitalize="words"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[styles.input, styles.inputDisabled]}
            value={email}
            editable={false}
            placeholder="Email address"
          />
          <Text style={styles.hint}>Email cannot be changed</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Phone</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="Enter your phone number"
            keyboardType="phone-pad"
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialCommunityIcons name="check" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Save Changes</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 16,
  },
  photoContainer: {
    position: 'relative',
  },
  avatar: {
    backgroundColor: '#2563eb',
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#2563eb',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  photoHint: {
    fontSize: 14,
    color: '#666',
    marginTop: 12,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: '#111',
  },
  inputDisabled: {
    backgroundColor: '#f5f5f5',
    color: '#999',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  saveButton: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 8,
    marginTop: 12,
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
