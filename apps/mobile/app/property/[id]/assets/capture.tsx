import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform, Image } from 'react-native'
import { useState, useEffect } from 'react'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { Picker } from '@react-native-picker/picker'
import * as ImagePicker from 'expo-image-picker'
import { apiClient } from '../../../../lib/api-client'

const CATEGORIES = [
  { value: 'APPLIANCE', label: 'Appliance', icon: 'fridge' },
  { value: 'HVAC', label: 'HVAC', icon: 'air-conditioner' },
  { value: 'PLUMBING', label: 'Plumbing', icon: 'water-pump' },
  { value: 'ELECTRICAL', label: 'Electrical', icon: 'flash' },
  { value: 'SECURITY', label: 'Security', icon: 'shield-lock' },
  { value: 'FURNITURE', label: 'Furniture', icon: 'sofa' },
  { value: 'FIXTURE', label: 'Fixture', icon: 'ceiling-light' },
  { value: 'OTHER', label: 'Other', icon: 'package-variant' },
]

const CONDITIONS = [
  { value: 'EXCELLENT', label: 'Excellent', color: '#16a34a' },
  { value: 'GOOD', label: 'Good', color: '#22c55e' },
  { value: 'FAIR', label: 'Fair', color: '#eab308' },
  { value: 'POOR', label: 'Poor', color: '#f97316' },
  { value: 'REPLACEMENT_NEEDED', label: 'Needs Replacement', color: '#ef4444' },
]

const ROOMS = [
  'Kitchen', 'Living Room', 'Dining Room', 'Master Bedroom', 'Bedroom 2',
  'Bedroom 3', 'Bathroom 1', 'Bathroom 2', 'Ensuite', 'Laundry',
  'Garage', 'Outdoor', 'Storage', 'Office', 'Hallway', 'Entry', 'Other'
]

const MAINTENANCE_OPTIONS = [
  { value: 'NONE', label: 'None Required' },
  { value: 'ROUTINE', label: 'Routine Maintenance' },
  { value: 'REPAIR', label: 'Repair Needed' },
  { value: 'REPLACEMENT', label: 'Replacement Required' },
]

export default function AssetCaptureScreen() {
  const { id: propertyId } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [photos, setPhotos] = useState<string[]>([])

  const [formData, setFormData] = useState({
    name: '',
    category: 'APPLIANCE',
    brand: '',
    model: '',
    serial_number: '',
    room: '',
    location: '',
    condition: 'GOOD',
    estimated_age: '',
    current_value: '',
    replacement_cost: '',
    warranty_status: '',
    maintenance_required: 'NONE',
    notes: '',
  })

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission is required to take photos')
      return
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: false,
    })

    if (!result.canceled && result.assets[0]) {
      setPhotos(prev => [...prev, result.assets[0].uri])
    }
  }

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: true,
    })

    if (!result.canceled) {
      setPhotos(prev => [...prev, ...result.assets.map(a => a.uri)])
    }
  }

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Required Field', 'Please enter an asset name')
      return
    }

    setSaving(true)
    try {
      // Create the asset
      const response = await apiClient.createAsset({
        property_id: propertyId,
        name: formData.name,
        category: formData.category,
        brand: formData.brand || undefined,
        model: formData.model || undefined,
        serial_number: formData.serial_number || undefined,
        room: formData.room || undefined,
        location: formData.location || undefined,
        condition: formData.condition,
        estimated_age: formData.estimated_age ? parseInt(formData.estimated_age) : undefined,
        current_value: formData.current_value ? parseFloat(formData.current_value) : undefined,
        replacement_cost: formData.replacement_cost ? parseFloat(formData.replacement_cost) : undefined,
        warranty_status: formData.warranty_status || undefined,
        maintenance_required: formData.maintenance_required,
        notes: formData.notes || undefined,
      })

      // Upload photos if any
      if (photos.length > 0 && response.asset?.id) {
        for (const photoUri of photos) {
          try {
            await apiClient.uploadAssetPhoto(response.asset.id, photoUri, '', 'general')
          } catch (photoErr) {
            console.error('Failed to upload photo:', photoErr)
          }
        }
      }

      Alert.alert('Success', 'Asset saved successfully', [
        { text: 'Add Another', onPress: () => {
          setFormData({
            name: '',
            category: 'APPLIANCE',
            brand: '',
            model: '',
            serial_number: '',
            room: formData.room, // Keep same room
            location: '',
            condition: 'GOOD',
            estimated_age: '',
            current_value: '',
            replacement_cost: '',
            warranty_status: '',
            maintenance_required: 'NONE',
            notes: '',
          })
          setPhotos([])
        }},
        { text: 'Done', onPress: () => router.back() },
      ])
    } catch (err: any) {
      console.error('Failed to save asset:', err)
      Alert.alert('Error', err.message || 'Failed to save asset')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Add Asset',
          headerBackTitle: 'Cancel',
        }}
      />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          {/* Photos Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Photos</Text>
            <View style={styles.photosContainer}>
              {photos.map((uri, index) => (
                <View key={index} style={styles.photoWrapper}>
                  <Image source={{ uri }} style={styles.photo} />
                  <TouchableOpacity
                    style={styles.removePhotoButton}
                    onPress={() => removePhoto(index)}
                  >
                    <MaterialCommunityIcons name="close" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={styles.addPhotoButton} onPress={takePhoto}>
                <MaterialCommunityIcons name="camera" size={28} color="#666" />
                <Text style={styles.addPhotoText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addPhotoButton} onPress={pickPhoto}>
                <MaterialCommunityIcons name="image-multiple" size={28} color="#666" />
                <Text style={styles.addPhotoText}>Gallery</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Basic Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Information</Text>

            <View style={styles.field}>
              <Text style={styles.label}>Asset Name *</Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(v) => updateField('name', v)}
                placeholder="e.g., Dishwasher, Air Conditioner"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Category</Text>
              <View style={styles.categoryGrid}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat.value}
                    style={[
                      styles.categoryButton,
                      formData.category === cat.value && styles.categoryButtonSelected
                    ]}
                    onPress={() => updateField('category', cat.value)}
                  >
                    <MaterialCommunityIcons
                      name={cat.icon as any}
                      size={20}
                      color={formData.category === cat.value ? '#fff' : '#666'}
                    />
                    <Text style={[
                      styles.categoryButtonText,
                      formData.category === cat.value && styles.categoryButtonTextSelected
                    ]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>Brand</Text>
                <TextInput
                  style={styles.input}
                  value={formData.brand}
                  onChangeText={(v) => updateField('brand', v)}
                  placeholder="e.g., Samsung"
                />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>Model</Text>
                <TextInput
                  style={styles.input}
                  value={formData.model}
                  onChangeText={(v) => updateField('model', v)}
                  placeholder="Model number"
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Serial Number</Text>
              <TextInput
                style={styles.input}
                value={formData.serial_number}
                onChangeText={(v) => updateField('serial_number', v)}
                placeholder="Serial number"
              />
            </View>
          </View>

          {/* Location */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location</Text>

            <View style={styles.field}>
              <Text style={styles.label}>Room</Text>
              <View style={styles.roomGrid}>
                {ROOMS.map(room => (
                  <TouchableOpacity
                    key={room}
                    style={[
                      styles.roomButton,
                      formData.room === room && styles.roomButtonSelected
                    ]}
                    onPress={() => updateField('room', room)}
                  >
                    <Text style={[
                      styles.roomButtonText,
                      formData.room === room && styles.roomButtonTextSelected
                    ]}>
                      {room}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Specific Location</Text>
              <TextInput
                style={styles.input}
                value={formData.location}
                onChangeText={(v) => updateField('location', v)}
                placeholder="e.g., Under sink, Above stove"
              />
            </View>
          </View>

          {/* Condition */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Condition & Status</Text>

            <View style={styles.field}>
              <Text style={styles.label}>Condition</Text>
              <View style={styles.conditionRow}>
                {CONDITIONS.map(cond => (
                  <TouchableOpacity
                    key={cond.value}
                    style={[
                      styles.conditionButton,
                      { borderColor: cond.color },
                      formData.condition === cond.value && { backgroundColor: cond.color }
                    ]}
                    onPress={() => updateField('condition', cond.value)}
                  >
                    <Text style={[
                      styles.conditionButtonText,
                      { color: formData.condition === cond.value ? '#fff' : cond.color }
                    ]}>
                      {cond.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>Estimated Age (years)</Text>
                <TextInput
                  style={styles.input}
                  value={formData.estimated_age}
                  onChangeText={(v) => updateField('estimated_age', v)}
                  placeholder="0"
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>Maintenance</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={formData.maintenance_required}
                    onValueChange={(v) => updateField('maintenance_required', v)}
                    style={styles.picker}
                  >
                    {MAINTENANCE_OPTIONS.map(opt => (
                      <Picker.Item key={opt.value} label={opt.label} value={opt.value} />
                    ))}
                  </Picker>
                </View>
              </View>
            </View>
          </View>

          {/* Value */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Value</Text>

            <View style={styles.row}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>Current Value ($)</Text>
                <TextInput
                  style={styles.input}
                  value={formData.current_value}
                  onChangeText={(v) => updateField('current_value', v)}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>Replacement Cost ($)</Text>
                <TextInput
                  style={styles.input}
                  value={formData.replacement_cost}
                  onChangeText={(v) => updateField('replacement_cost', v)}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.notes}
              onChangeText={(v) => updateField('notes', v)}
              placeholder="Additional notes about this asset..."
              multiline
              numberOfLines={4}
            />
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Save Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <MaterialCommunityIcons name="check" size={24} color="#fff" />
            <Text style={styles.saveButtonText}>
              {saving ? 'Saving...' : 'Save Asset'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  photosContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoWrapper: {
    position: 'relative',
  },
  photo: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#ef4444',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoButton: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e5e5e5',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addPhotoText: {
    fontSize: 11,
    color: '#666',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  categoryButtonSelected: {
    backgroundColor: '#2563eb',
  },
  categoryButtonText: {
    fontSize: 13,
    color: '#666',
  },
  categoryButtonTextSelected: {
    color: '#fff',
  },
  roomGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roomButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  roomButtonSelected: {
    backgroundColor: '#2563eb',
  },
  roomButtonText: {
    fontSize: 13,
    color: '#666',
  },
  roomButtonTextSelected: {
    color: '#fff',
  },
  conditionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  conditionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    backgroundColor: '#fff',
  },
  conditionButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  pickerContainer: {
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#16a34a',
    paddingVertical: 16,
    borderRadius: 12,
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
