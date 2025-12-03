import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, FlatList, ActivityIndicator } from 'react-native'
import { Button, Card, Divider } from 'react-native-paper'
import { useState, useRef, useEffect } from 'react'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { apiClient } from '../../../lib/api-client'

// Room definitions
const ROOMS = [
  { id: 'living', name: 'Living Room', icon: 'sofa' },
  { id: 'kitchen', name: 'Kitchen', icon: 'stove' },
  { id: 'dining', name: 'Dining Room', icon: 'table-furniture' },
  { id: 'master_bed', name: 'Master Bedroom', icon: 'bed' },
  { id: 'bed_2', name: 'Bedroom 2', icon: 'bed-outline' },
  { id: 'bed_3', name: 'Bedroom 3', icon: 'bed-outline' },
  { id: 'bed_4', name: 'Bedroom 4', icon: 'bed-outline' },
  { id: 'bathroom_1', name: 'Bathroom 1', icon: 'shower' },
  { id: 'bathroom_2', name: 'Bathroom 2', icon: 'shower' },
  { id: 'ensuite', name: 'Ensuite', icon: 'shower-head' },
  { id: 'laundry', name: 'Laundry', icon: 'washing-machine' },
  { id: 'garage', name: 'Garage', icon: 'garage' },
  { id: 'outdoor', name: 'Outdoor/Garden', icon: 'flower' },
  { id: 'hallway', name: 'Hallway', icon: 'door' },
  { id: 'study', name: 'Study/Office', icon: 'desk' },
  { id: 'other', name: 'Other', icon: 'dots-horizontal' },
]

// Category definitions with their specific fields
const CATEGORIES = {
  appliance: {
    name: 'Appliance',
    icon: 'toaster-oven',
    fields: ['brand', 'model', 'serial_number', 'condition', 'maintenance_required', 'notes'],
    subcategories: ['Oven', 'Cooktop', 'Range Hood', 'Dishwasher', 'Microwave', 'Refrigerator', 'Washing Machine', 'Dryer', 'Other Appliance'],
  },
  hvac: {
    name: 'HVAC',
    icon: 'air-conditioner',
    fields: ['brand', 'model', 'serial_number', 'hvac_type', 'condition', 'maintenance_required', 'notes'],
    subcategories: ['Split System', 'Ducted', 'Evaporative', 'Wall Unit', 'Ceiling Fan', 'Exhaust Fan', 'Other HVAC'],
  },
  plumbing: {
    name: 'Plumbing',
    icon: 'pipe-leak',
    fields: ['brand', 'model', 'serial_number', 'plumbing_type', 'condition', 'maintenance_required', 'notes'],
    subcategories: ['Hot Water System', 'Toilet', 'Sink', 'Shower', 'Bath', 'Tap/Faucet', 'Other Plumbing'],
  },
  electrical: {
    name: 'Electrical',
    icon: 'lightning-bolt',
    fields: ['brand', 'model', 'serial_number', 'electrical_type', 'condition', 'maintenance_required', 'notes'],
    subcategories: ['Light Fitting', 'Power Point', 'Switch', 'Smoke Alarm', 'Safety Switch', 'Other Electrical'],
  },
  flooring: {
    name: 'Flooring',
    icon: 'texture-box',
    fields: ['flooring_type', 'condition', 'maintenance_required', 'notes'],
    subcategories: null,
  },
  paint: {
    name: 'Paint/Walls',
    icon: 'format-paint',
    fields: ['paint_color', 'paint_finish', 'condition', 'maintenance_required', 'notes'],
    subcategories: null,
  },
  curtains: {
    name: 'Window Coverings',
    icon: 'blinds',
    fields: ['curtain_type', 'condition', 'maintenance_required', 'notes'],
    subcategories: null,
  },
  doors_windows: {
    name: 'Doors & Windows',
    icon: 'door',
    fields: ['door_window_type', 'condition', 'maintenance_required', 'notes'],
    subcategories: ['Entry Door', 'Internal Door', 'Sliding Door', 'Window', 'Screen Door', 'Other'],
  },
  other: {
    name: 'Other',
    icon: 'package-variant',
    fields: ['item_name', 'brand', 'model', 'condition', 'maintenance_required', 'notes'],
    subcategories: null,
  },
}

// Room-specific category filtering - only show relevant categories for each room
const ROOM_CATEGORIES: Record<string, string[]> = {
  kitchen: ['appliance', 'hvac', 'plumbing', 'electrical', 'flooring', 'paint', 'curtains', 'doors_windows', 'other'],
  living: ['hvac', 'electrical', 'flooring', 'paint', 'curtains', 'doors_windows', 'other'],
  dining: ['hvac', 'electrical', 'flooring', 'paint', 'curtains', 'doors_windows', 'other'],
  master_bed: ['hvac', 'electrical', 'flooring', 'paint', 'curtains', 'doors_windows', 'other'],
  bed_2: ['hvac', 'electrical', 'flooring', 'paint', 'curtains', 'doors_windows', 'other'],
  bed_3: ['hvac', 'electrical', 'flooring', 'paint', 'curtains', 'doors_windows', 'other'],
  bed_4: ['hvac', 'electrical', 'flooring', 'paint', 'curtains', 'doors_windows', 'other'],
  bathroom_1: ['plumbing', 'hvac', 'electrical', 'flooring', 'paint', 'curtains', 'doors_windows', 'other'],
  bathroom_2: ['plumbing', 'hvac', 'electrical', 'flooring', 'paint', 'curtains', 'doors_windows', 'other'],
  ensuite: ['plumbing', 'hvac', 'electrical', 'flooring', 'paint', 'curtains', 'doors_windows', 'other'],
  laundry: ['appliance', 'plumbing', 'hvac', 'electrical', 'flooring', 'paint', 'curtains', 'doors_windows', 'other'],
  garage: ['appliance', 'hvac', 'plumbing', 'electrical', 'flooring', 'paint', 'doors_windows', 'other'],
  outdoor: ['hvac', 'plumbing', 'electrical', 'other'],
  hallway: ['electrical', 'flooring', 'paint', 'doors_windows', 'other'],
  study: ['hvac', 'electrical', 'flooring', 'paint', 'curtains', 'doors_windows', 'other'],
  other: ['appliance', 'hvac', 'plumbing', 'electrical', 'flooring', 'paint', 'curtains', 'doors_windows', 'other'],
}

const CONDITION_OPTIONS = ['Excellent', 'Good', 'Fair', 'Poor', 'Needs Repair', 'Not Working']
const MAINTENANCE_OPTIONS = ['None Required', 'Minor Maintenance', 'Major Repair Needed', 'Replacement Recommended']
const FLOORING_TYPES = ['Carpet', 'Tiles', 'Hardwood', 'Laminate', 'Vinyl/Lino', 'Polished Concrete', 'Other']
const PAINT_FINISHES = ['Gloss', 'Semi-Gloss', 'Satin', 'Matte', 'Flat']
const CURTAIN_TYPES = ['Curtains', 'Blinds (Vertical)', 'Blinds (Venetian)', 'Blinds (Roller)', 'Shutters', 'Sheer', 'None']
const HVAC_TYPES = ['Electric', 'Gas', 'Reverse Cycle', 'Cooling Only', 'Heating Only']
const PLUMBING_TYPES = ['Electric', 'Gas', 'Solar', 'Heat Pump']

interface AssetItem {
  id: string
  room_id: string
  category: string
  subcategory?: string
  data: Record<string, any>
  created_at: string
}

export default function AssetRegisterCompleteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const roomsScrollRef = useRef<FlatList>(null)
  const mainScrollRef = useRef<ScrollView>(null)

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [currentRoomIndex, setCurrentRoomIndex] = useState(0)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null)
  const [currentItemData, setCurrentItemData] = useState<Record<string, any>>({})
  const [assets, setAssets] = useState<AssetItem[]>([])
  const [saving, setSaving] = useState(false)
  const [inspectorName, setInspectorName] = useState('')
  const [completionNotes, setCompletionNotes] = useState('')

  const currentRoom = ROOMS[currentRoomIndex]
  const currentCategory = selectedCategory ? CATEGORIES[selectedCategory as keyof typeof CATEGORIES] : null

  // Get available categories for current room
  const availableCategories = ROOM_CATEGORIES[currentRoom.id] || Object.keys(CATEGORIES)

  // Get items for current room
  const roomItems = assets.filter(a => a.room_id === currentRoom.id)

  // Get rooms with items (completed rooms)
  const roomsWithItems = new Set(assets.map(a => a.room_id))

  // Load job data and user on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)

        // Load user data for inspector name
        const userResponse = await apiClient.getCurrentUser()
        if (userResponse.user?.full_name) {
          setInspectorName(userResponse.user.full_name)
        }

        // Load existing job data including any previous completion form data
        if (id) {
          const jobResponse = await apiClient.getAssetRegisterJob(id)

          // If there are completion forms, load the most recent one's data
          if (jobResponse.completionForms && jobResponse.completionForms.length > 0) {
            const latestForm = jobResponse.completionForms[0]

            // Load previous assets if available
            if (latestForm.form_data?.assets && Array.isArray(latestForm.form_data.assets)) {
              setAssets(latestForm.form_data.assets)
            }

            // Override inspector name if saved from previous submission
            if (latestForm.technician_name) {
              setInspectorName(latestForm.technician_name)
            }
          }

          // Load completion notes from the job itself
          if (jobResponse.job?.completion_notes) {
            setCompletionNotes(jobResponse.job.completion_notes)
          }
        }
      } catch (err) {
        console.error('Failed to load data:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [id])

  const updateField = (fieldId: string, value: any) => {
    setCurrentItemData(prev => ({ ...prev, [fieldId]: value }))
  }

  const handleSelectRoom = (index: number) => {
    setCurrentRoomIndex(index)
    setSelectedCategory(null)
    setSelectedSubcategory(null)
    setCurrentItemData({})

    // Scroll to the selected room
    roomsScrollRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 })
  }

  const handleSelectCategory = (categoryId: string) => {
    setSelectedCategory(categoryId)
    setSelectedSubcategory(null)
    setCurrentItemData({})
  }

  const handleSelectSubcategory = (subcategory: string) => {
    setSelectedSubcategory(subcategory)
  }

  // Save assets to database (called after each add to prevent data loss)
  const saveAssetsToDatabase = async (updatedAssets: AssetItem[]) => {
    try {
      setSaving(true)
      const roomsData: Record<string, AssetItem[]> = {}
      updatedAssets.forEach(asset => {
        if (!roomsData[asset.room_id]) {
          roomsData[asset.room_id] = []
        }
        roomsData[asset.room_id].push(asset)
      })
      const roomsWithItemsSet = new Set(updatedAssets.map(a => a.room_id))

      await apiClient.updateAssetRegisterJob(id!, {
        status: 'IN_PROGRESS',
        completion_notes: completionNotes,
      })

      // Save form data via a partial completion (not final submit)
      await apiClient.saveAssetRegisterProgress(id!, {
        form_data: {
          assets: updatedAssets,
          rooms_completed: Array.from(roomsWithItemsSet),
        },
        technician_name: inspectorName,
        report_data: {
          total_items: updatedAssets.length,
          rooms_completed: roomsWithItemsSet.size,
          rooms_data: roomsData,
        },
      })
    } catch (err) {
      console.error('Failed to save assets:', err)
      // Don't show error to user - silent save in background
    } finally {
      setSaving(false)
    }
  }

  const handleAddItem = async () => {
    if (!selectedCategory) {
      Alert.alert('Select Category', 'Please select a category first')
      return
    }

    // Validate required fields
    const category = CATEGORIES[selectedCategory as keyof typeof CATEGORIES]
    if (category.subcategories && !selectedSubcategory) {
      Alert.alert('Select Type', 'Please select a type first')
      return
    }

    if (!currentItemData.condition) {
      Alert.alert('Required Field', 'Please select a condition')
      return
    }

    const newItem: AssetItem = {
      id: Date.now().toString(),
      room_id: currentRoom.id,
      category: selectedCategory,
      subcategory: selectedSubcategory || undefined,
      data: { ...currentItemData },
      created_at: new Date().toISOString(),
    }

    const updatedAssets = [...assets, newItem]
    setAssets(updatedAssets)

    // Reset form completely - scroll to top to select next category
    setCurrentItemData({})
    setSelectedSubcategory(null)
    setSelectedCategory(null)

    // Scroll to top to select next category
    setTimeout(() => {
      mainScrollRef.current?.scrollTo({ y: 0, animated: true })
    }, 100)

    // Save to database in background to prevent data loss
    saveAssetsToDatabase(updatedAssets)
  }

  const handleRemoveItem = (itemId: string) => {
    Alert.alert(
      'Remove Item',
      'Are you sure you want to remove this item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const updatedAssets = assets.filter(a => a.id !== itemId)
            setAssets(updatedAssets)
            // Save to database after removal
            saveAssetsToDatabase(updatedAssets)
          },
        },
      ]
    )
  }

  const handleNextRoom = () => {
    if (currentRoomIndex < ROOMS.length - 1) {
      handleSelectRoom(currentRoomIndex + 1)
    }
  }

  const handlePreviousRoom = () => {
    if (currentRoomIndex > 0) {
      handleSelectRoom(currentRoomIndex - 1)
    }
  }

  const handleSubmit = async () => {
    if (assets.length === 0) {
      Alert.alert('No Items', 'Please add at least one item before completing the asset register.')
      return
    }

    // First confirmation
    Alert.alert(
      'Complete Asset Register',
      `You have recorded ${assets.length} items across ${roomsWithItems.size} rooms.\n\nThis will submit all results to PropertyPal. Are you sure you want to complete this asset register?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Complete',
          onPress: () => {
            // Second confirmation
            Alert.alert(
              'Confirm Submission',
              'Once submitted, the asset register will be marked as complete and sent to the property manager.\n\nDo you want to proceed?',
              [
                { text: 'Go Back', style: 'cancel' },
                {
                  text: 'Submit Now',
                  style: 'destructive',
                  onPress: performSubmit,
                },
              ]
            )
          },
        },
      ]
    )
  }

  const performSubmit = async () => {
    try {
      setSubmitting(true)

      // Organize assets by room for report
      const roomsData: Record<string, AssetItem[]> = {}
      assets.forEach(asset => {
        if (!roomsData[asset.room_id]) {
          roomsData[asset.room_id] = []
        }
        roomsData[asset.room_id].push(asset)
      })

      await apiClient.completeAssetRegisterJob(id!, {
        form_data: {
          assets,
          rooms_completed: Array.from(roomsWithItems),
        },
        completion_notes: completionNotes,
        technician_name: inspectorName,
        report_data: {
          total_items: assets.length,
          rooms_completed: roomsWithItems.size,
          rooms_data: roomsData,
          completed_at: new Date().toISOString(),
        },
      })

      Alert.alert(
        'Success',
        'Asset register has been submitted successfully!',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/asset-register'),
          },
        ]
      )
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit asset register')
    } finally {
      setSubmitting(false)
    }
  }

  const renderRoomChip = ({ item, index }: { item: typeof ROOMS[0], index: number }) => {
    const isSelected = index === currentRoomIndex
    const hasItems = roomsWithItems.has(item.id)
    const itemCount = assets.filter(a => a.room_id === item.id).length

    return (
      <TouchableOpacity
        style={[
          styles.roomChip,
          isSelected && styles.roomChipSelected,
          hasItems && !isSelected && styles.roomChipCompleted,
        ]}
        onPress={() => handleSelectRoom(index)}
      >
        <MaterialCommunityIcons
          name={item.icon as any}
          size={18}
          color={isSelected ? '#fff' : hasItems ? '#16a34a' : '#666'}
        />
        <Text
          style={[
            styles.roomChipText,
            isSelected && styles.roomChipTextSelected,
            hasItems && !isSelected && styles.roomChipTextCompleted,
          ]}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        {hasItems && (
          <View style={[styles.itemCountBadge, isSelected && styles.itemCountBadgeSelected]}>
            <Text style={[styles.itemCountText, isSelected && styles.itemCountTextSelected]}>
              {itemCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    )
  }

  const renderCategorySpecificFields = () => {
    if (!currentCategory) return null

    const fields = currentCategory.fields

    return (
      <View style={styles.fieldsContainer}>
        {/* Subcategory selector as tiles for categories that have them */}
        {currentCategory.subcategories && (
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Type *</Text>
            <View style={styles.subcategoryGrid}>
              {currentCategory.subcategories.map((sub) => (
                <TouchableOpacity
                  key={sub}
                  style={[
                    styles.subcategoryButton,
                    selectedSubcategory === sub && styles.subcategoryButtonSelected,
                  ]}
                  onPress={() => handleSelectSubcategory(sub)}
                >
                  <Text
                    style={[
                      styles.subcategoryButtonText,
                      selectedSubcategory === sub && styles.subcategoryButtonTextSelected,
                    ]}
                    numberOfLines={2}
                  >
                    {sub}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Brand/Model/Serial for appliances, HVAC, plumbing, electrical */}
        {fields.includes('brand') && (
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Brand</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g., Samsung, Bosch"
              placeholderTextColor="#999"
              value={currentItemData.brand || ''}
              onChangeText={(value) => updateField('brand', value)}
            />
          </View>
        )}

        {fields.includes('model') && (
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Model</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Model number"
              placeholderTextColor="#999"
              value={currentItemData.model || ''}
              onChangeText={(value) => updateField('model', value)}
            />
          </View>
        )}

        {fields.includes('serial_number') && (
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Serial Number</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Serial number"
              placeholderTextColor="#999"
              value={currentItemData.serial_number || ''}
              onChangeText={(value) => updateField('serial_number', value)}
            />
          </View>
        )}

        {/* Item name for "Other" category */}
        {fields.includes('item_name') && (
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Item Name *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="What is this item?"
              placeholderTextColor="#999"
              value={currentItemData.item_name || ''}
              onChangeText={(value) => updateField('item_name', value)}
            />
          </View>
        )}

        {/* HVAC type */}
        {fields.includes('hvac_type') && (
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>HVAC Type</Text>
            <View style={styles.optionsRow}>
              {HVAC_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.optionChip,
                    currentItemData.hvac_type === type && styles.optionChipSelected,
                  ]}
                  onPress={() => updateField('hvac_type', type)}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      currentItemData.hvac_type === type && styles.optionChipTextSelected,
                    ]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Plumbing type (hot water) */}
        {fields.includes('plumbing_type') && selectedSubcategory === 'Hot Water System' && (
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Hot Water Type</Text>
            <View style={styles.optionsRow}>
              {PLUMBING_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.optionChip,
                    currentItemData.plumbing_type === type && styles.optionChipSelected,
                  ]}
                  onPress={() => updateField('plumbing_type', type)}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      currentItemData.plumbing_type === type && styles.optionChipTextSelected,
                    ]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Flooring type */}
        {fields.includes('flooring_type') && (
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Flooring Type *</Text>
            <View style={styles.optionsRow}>
              {FLOORING_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.optionChip,
                    currentItemData.flooring_type === type && styles.optionChipSelected,
                  ]}
                  onPress={() => updateField('flooring_type', type)}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      currentItemData.flooring_type === type && styles.optionChipTextSelected,
                    ]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Paint fields */}
        {fields.includes('paint_color') && (
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Paint Color</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g., White, Cream, Grey"
              placeholderTextColor="#999"
              value={currentItemData.paint_color || ''}
              onChangeText={(value) => updateField('paint_color', value)}
            />
          </View>
        )}

        {fields.includes('paint_finish') && (
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Paint Finish</Text>
            <View style={styles.optionsRow}>
              {PAINT_FINISHES.map((finish) => (
                <TouchableOpacity
                  key={finish}
                  style={[
                    styles.optionChip,
                    currentItemData.paint_finish === finish && styles.optionChipSelected,
                  ]}
                  onPress={() => updateField('paint_finish', finish)}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      currentItemData.paint_finish === finish && styles.optionChipTextSelected,
                    ]}
                  >
                    {finish}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Curtain type */}
        {fields.includes('curtain_type') && (
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Window Covering Type *</Text>
            <View style={styles.optionsRow}>
              {CURTAIN_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.optionChip,
                    currentItemData.curtain_type === type && styles.optionChipSelected,
                  ]}
                  onPress={() => updateField('curtain_type', type)}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      currentItemData.curtain_type === type && styles.optionChipTextSelected,
                    ]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Condition - always shown */}
        {fields.includes('condition') && (
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Condition *</Text>
            <View style={styles.optionsRow}>
              {CONDITION_OPTIONS.map((condition) => (
                <TouchableOpacity
                  key={condition}
                  style={[
                    styles.optionChip,
                    currentItemData.condition === condition && styles.optionChipSelected,
                    (condition === 'Needs Repair' || condition === 'Poor') && currentItemData.condition === condition && styles.optionChipWarning,
                    condition === 'Not Working' && currentItemData.condition === condition && styles.optionChipDanger,
                  ]}
                  onPress={() => updateField('condition', condition)}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      currentItemData.condition === condition && styles.optionChipTextSelected,
                    ]}
                  >
                    {condition}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Maintenance Required - always shown */}
        {fields.includes('maintenance_required') && (
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Maintenance Required</Text>
            <View style={styles.optionsRow}>
              {MAINTENANCE_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.optionChip,
                    currentItemData.maintenance_required === option && styles.optionChipSelected,
                    option === 'Minor Maintenance' && currentItemData.maintenance_required === option && styles.optionChipWarningBg,
                    (option === 'Major Repair Needed' || option === 'Replacement Recommended') && currentItemData.maintenance_required === option && styles.optionChipDangerBg,
                  ]}
                  onPress={() => updateField('maintenance_required', option)}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      currentItemData.maintenance_required === option && styles.optionChipTextSelected,
                    ]}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Notes - always shown */}
        {fields.includes('notes') && (
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Notes</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Any additional notes..."
              placeholderTextColor="#999"
              value={currentItemData.notes || ''}
              onChangeText={(value) => updateField('notes', value)}
              multiline
              numberOfLines={3}
            />
          </View>
        )}

        {/* Save Item Button */}
        <Button
          mode="contained"
          onPress={handleAddItem}
          style={styles.addItemButton}
          icon="content-save"
          loading={saving}
          disabled={saving}
        >
          Save
        </Button>
      </View>
    )
  }

  const renderRoomItems = () => {
    if (roomItems.length === 0) return null

    return (
      <Card style={styles.itemsCard}>
        <Card.Title
          title={`Items in ${currentRoom.name}`}
          subtitle={`${roomItems.length} item${roomItems.length !== 1 ? 's' : ''}`}
          left={(props) => <MaterialCommunityIcons {...props} name="clipboard-list" size={24} color="#16a34a" />}
        />
        <Card.Content>
          {roomItems.map((item, index) => {
            const category = CATEGORIES[item.category as keyof typeof CATEGORIES]
            const needsMaintenance = item.data.maintenance_required && item.data.maintenance_required !== 'None Required'
            return (
              <View key={item.id}>
                {index > 0 && <Divider style={styles.itemDivider} />}
                <View style={styles.itemRow}>
                  <View style={styles.itemInfo}>
                    <MaterialCommunityIcons
                      name={category.icon as any}
                      size={20}
                      color={needsMaintenance ? '#f59e0b' : '#666'}
                    />
                    <View style={styles.itemTextContainer}>
                      <Text style={styles.itemName}>
                        {item.subcategory || category.name}
                        {item.data.brand && ` - ${item.data.brand}`}
                      </Text>
                      <Text style={styles.itemCondition}>
                        {item.data.condition}
                        {item.data.model && ` • ${item.data.model}`}
                      </Text>
                      {needsMaintenance && (
                        <Text style={styles.itemMaintenance}>
                          ⚠️ {item.data.maintenance_required}
                        </Text>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleRemoveItem(item.id)}
                    style={styles.removeButton}
                  >
                    <MaterialCommunityIcons name="close-circle" size={24} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            )
          })}
        </Card.Content>
      </Card>
    )
  }

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Asset Register' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading asset data...</Text>
        </View>
      </>
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: `Asset Register`,
          headerRight: () => (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{assets.length} items</Text>
            </View>
          ),
        }}
      />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Room selector at top */}
        <View style={styles.roomSelectorContainer}>
          <FlatList
            ref={roomsScrollRef}
            data={ROOMS}
            renderItem={renderRoomChip}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.roomsList}
            getItemLayout={(_, index) => ({
              length: 130,
              offset: 130 * index,
              index,
            })}
          />
        </View>

        <ScrollView ref={mainScrollRef} style={styles.scrollView} keyboardShouldPersistTaps="handled">
          {/* Current Room Header */}
          <View style={styles.roomHeader}>
            <MaterialCommunityIcons name={currentRoom.icon as any} size={32} color="#2563eb" />
            <Text style={styles.roomTitle}>{currentRoom.name}</Text>
          </View>

          {/* Category selector - Add new item form */}
          <Card style={styles.card}>
            <Card.Title
              title="Add New Item"
              subtitle="Select category then fill in details"
            />
            <Card.Content>
              <Text style={styles.fieldLabel}>Category *</Text>
              <View style={styles.categoryGrid}>
                {availableCategories.map((key) => {
                  const cat = CATEGORIES[key as keyof typeof CATEGORIES]
                  return (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.categoryButton,
                      selectedCategory === key && styles.categoryButtonSelected,
                    ]}
                    onPress={() => handleSelectCategory(key)}
                  >
                    <MaterialCommunityIcons
                      name={cat.icon as any}
                      size={24}
                      color={selectedCategory === key ? '#fff' : '#666'}
                    />
                    <Text
                      style={[
                        styles.categoryButtonText,
                        selectedCategory === key && styles.categoryButtonTextSelected,
                      ]}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                  )
                })}
              </View>

              {/* Category-specific fields */}
              {renderCategorySpecificFields()}
            </Card.Content>
          </Card>

          {/* Items already in this room - shown below the add form */}
          {renderRoomItems()}

          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Bottom navigation - 3 buttons */}
        <View style={styles.navigationContainer}>
          <Button
            mode="outlined"
            onPress={handlePreviousRoom}
            disabled={currentRoomIndex === 0}
            style={styles.navButtonSmall}
            compact
          >
            Previous
          </Button>
          <Button
            mode="contained"
            onPress={handleNextRoom}
            disabled={currentRoomIndex === ROOMS.length - 1}
            style={styles.navButtonSmall}
            compact
          >
            Next Room
          </Button>
          <Button
            mode="contained"
            onPress={handleSubmit}
            disabled={submitting || assets.length === 0}
            loading={submitting}
            style={styles.completeButton}
            buttonColor="#16a34a"
            compact
          >
            Complete
          </Button>
        </View>
      </KeyboardAvoidingView>
    </>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  roomSelectorContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  roomsList: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  roomChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    gap: 6,
    minWidth: 120,
  },
  roomChipSelected: {
    backgroundColor: '#2563eb',
  },
  roomChipCompleted: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#16a34a',
  },
  roomChipText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  roomChipTextSelected: {
    color: '#fff',
  },
  roomChipTextCompleted: {
    color: '#16a34a',
  },
  itemCountBadge: {
    backgroundColor: '#16a34a',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  itemCountBadgeSelected: {
    backgroundColor: '#fff',
  },
  itemCountText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  itemCountTextSelected: {
    color: '#2563eb',
  },
  scrollView: {
    flex: 1,
  },
  roomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  roomTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111',
  },
  card: {
    margin: 16,
    marginTop: 0,
    marginBottom: 8,
    elevation: 2,
  },
  itemsCard: {
    margin: 16,
    marginTop: 0,
    marginBottom: 8,
    backgroundColor: '#f0fdf4',
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  categoryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    width: '31%',
    aspectRatio: 1,
  },
  categoryButtonSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  categoryButtonText: {
    fontSize: 11,
    color: '#666',
    marginTop: 6,
    textAlign: 'center',
  },
  categoryButtonTextSelected: {
    color: '#fff',
  },
  fieldsContainer: {
    marginTop: 8,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  optionChipSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  optionChipWarning: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  optionChipWarningBg: {
    backgroundColor: '#fbbf24',
    borderColor: '#fbbf24',
  },
  optionChipDanger: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  optionChipDangerBg: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  optionChipText: {
    fontSize: 13,
    color: '#666',
  },
  optionChipTextSelected: {
    color: '#fff',
  },
  addItemButton: {
    marginTop: 8,
    backgroundColor: '#16a34a',
  },
  itemDivider: {
    marginVertical: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  itemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  itemTextContainer: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },
  itemCondition: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  itemMaintenance: {
    fontSize: 12,
    color: '#f59e0b',
    marginTop: 2,
    fontWeight: '500',
  },
  removeButton: {
    padding: 4,
  },
  submitButton: {
    marginTop: 8,
    backgroundColor: '#16a34a',
  },
  navigationContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
  },
  navButton: {
    flex: 1,
  },
  navButtonSmall: {
    flex: 1,
  },
  completeButton: {
    flex: 1,
  },
  subcategoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  subcategoryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    minWidth: '30%',
    flexGrow: 1,
  },
  subcategoryButtonSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  subcategoryButtonText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  subcategoryButtonTextSelected: {
    color: '#fff',
  },
  headerBadge: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  headerBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  bottomSpacer: {
    height: 32,
  },
})
