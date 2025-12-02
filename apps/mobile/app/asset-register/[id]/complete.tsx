import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, FlatList } from 'react-native'
import { Button, Card, Divider, Menu } from 'react-native-paper'
import { useState, useRef } from 'react'
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

  const [submitting, setSubmitting] = useState(false)
  const [currentRoomIndex, setCurrentRoomIndex] = useState(0)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null)
  const [currentItemData, setCurrentItemData] = useState<Record<string, any>>({})
  const [assets, setAssets] = useState<AssetItem[]>([])
  const [showSubcategoryMenu, setShowSubcategoryMenu] = useState(false)
  const [technicianName, setTechnicianName] = useState('')
  const [completionNotes, setCompletionNotes] = useState('')

  const currentRoom = ROOMS[currentRoomIndex]
  const currentCategory = selectedCategory ? CATEGORIES[selectedCategory as keyof typeof CATEGORIES] : null

  // Get items for current room
  const roomItems = assets.filter(a => a.room_id === currentRoom.id)

  // Get rooms with items (completed rooms)
  const roomsWithItems = new Set(assets.map(a => a.room_id))

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
    setShowSubcategoryMenu(false)
  }

  const handleAddItem = () => {
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

    setAssets(prev => [...prev, newItem])

    // Reset form for next item
    setCurrentItemData({})
    setSelectedSubcategory(null)

    Alert.alert('Item Added', `${selectedSubcategory || category.name} added to ${currentRoom.name}`)
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
            setAssets(prev => prev.filter(a => a.id !== itemId))
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
    if (!technicianName.trim()) {
      Alert.alert('Required', 'Please enter your name')
      return
    }

    if (assets.length === 0) {
      Alert.alert('No Items', 'Please add at least one item before submitting')
      return
    }

    Alert.alert(
      'Submit Asset Register',
      `You have recorded ${assets.length} items across ${roomsWithItems.size} rooms. Submit this asset register?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
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
                technician_name: technicianName,
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
          },
        },
      ]
    )
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
        {/* Subcategory selector for categories that have them */}
        {currentCategory.subcategories && (
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Type *</Text>
            <Menu
              visible={showSubcategoryMenu}
              onDismiss={() => setShowSubcategoryMenu(false)}
              anchor={
                <TouchableOpacity
                  style={styles.dropdown}
                  onPress={() => setShowSubcategoryMenu(true)}
                >
                  <Text style={selectedSubcategory ? styles.dropdownText : styles.dropdownPlaceholder}>
                    {selectedSubcategory || 'Select type...'}
                  </Text>
                  <MaterialCommunityIcons name="chevron-down" size={20} color="#666" />
                </TouchableOpacity>
              }
            >
              {currentCategory.subcategories.map((sub) => (
                <Menu.Item
                  key={sub}
                  onPress={() => handleSelectSubcategory(sub)}
                  title={sub}
                />
              ))}
            </Menu>
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

        {/* Add Item Button */}
        <Button
          mode="contained"
          onPress={handleAddItem}
          style={styles.addItemButton}
          icon="plus"
        >
          Add {selectedSubcategory || currentCategory.name}
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

        <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
          {/* Current Room Header */}
          <View style={styles.roomHeader}>
            <MaterialCommunityIcons name={currentRoom.icon as any} size={32} color="#2563eb" />
            <Text style={styles.roomTitle}>{currentRoom.name}</Text>
          </View>

          {/* Items already in this room */}
          {renderRoomItems()}

          {/* Category selector */}
          <Card style={styles.card}>
            <Card.Title
              title="Add New Item"
              subtitle="Select category then fill in details"
            />
            <Card.Content>
              <Text style={styles.fieldLabel}>Category *</Text>
              <View style={styles.categoryGrid}>
                {Object.entries(CATEGORIES).map(([key, cat]) => (
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
                ))}
              </View>

              {/* Category-specific fields */}
              {renderCategorySpecificFields()}
            </Card.Content>
          </Card>

          {/* Completion section - show when there are items */}
          {assets.length > 0 && (
            <Card style={styles.card}>
              <Card.Title
                title="Complete Asset Register"
                left={(props) => <MaterialCommunityIcons {...props} name="check-circle" size={24} color="#16a34a" />}
              />
              <Card.Content>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Your Name *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter your name"
                    placeholderTextColor="#999"
                    value={technicianName}
                    onChangeText={setTechnicianName}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Completion Notes</Text>
                  <TextInput
                    style={[styles.textInput, styles.textArea]}
                    placeholder="Any final notes or observations..."
                    placeholderTextColor="#999"
                    value={completionNotes}
                    onChangeText={setCompletionNotes}
                    multiline
                    numberOfLines={4}
                  />
                </View>

                <Button
                  mode="contained"
                  onPress={handleSubmit}
                  loading={submitting}
                  disabled={submitting}
                  style={styles.submitButton}
                  icon="check"
                >
                  Submit Asset Register ({assets.length} items)
                </Button>
              </Card.Content>
            </Card>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Bottom navigation */}
        <View style={styles.navigationContainer}>
          <Button
            mode="outlined"
            onPress={handlePreviousRoom}
            disabled={currentRoomIndex === 0}
            style={styles.navButton}
            icon="chevron-left"
          >
            Previous
          </Button>
          <Button
            mode="contained"
            onPress={handleNextRoom}
            disabled={currentRoomIndex === ROOMS.length - 1}
            style={styles.navButton}
            icon="chevron-right"
            contentStyle={{ flexDirection: 'row-reverse' }}
          >
            Next Room
          </Button>
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
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
  },
  dropdownText: {
    fontSize: 16,
    color: '#111',
  },
  dropdownPlaceholder: {
    fontSize: 16,
    color: '#999',
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
