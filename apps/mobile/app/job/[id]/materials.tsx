import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, RefreshControl, Modal, KeyboardAvoidingView, Platform } from 'react-native'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { useState, useEffect } from 'react'
import { apiClient } from '../../../lib/api-client'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { FAB } from 'react-native-paper'

export default function JobMaterialsScreen() {
  const { id } = useLocalSearchParams()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [materials, setMaterials] = useState<any[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form fields
  const [materialType, setMaterialType] = useState('product')
  const [description, setDescription] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unitPrice, setUnitPrice] = useState('')

  useEffect(() => {
    fetchMaterials()
  }, [id])

  const fetchMaterials = async () => {
    try {
      setLoading(true)
      const response = await apiClient.getMaterials(id as string)
      setMaterials(response.materials || [])
    } catch (err: any) {
      console.error('Failed to fetch materials:', err)
      Alert.alert('Error', 'Failed to load materials')
    } finally {
      setLoading(false)
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchMaterials()
    setRefreshing(false)
  }

  const handleAddMaterial = async () => {
    if (!description.trim()) {
      Alert.alert('Validation Error', 'Description is required')
      return
    }

    if (!unitPrice || parseFloat(unitPrice) <= 0) {
      Alert.alert('Validation Error', 'Valid unit price is required')
      return
    }

    try {
      setSaving(true)
      const qty = parseFloat(quantity) || 1
      const price = parseFloat(unitPrice)
      const total = qty * price

      await apiClient.addMaterial(id as string, {
        materialType,
        description: description.trim(),
        supplierName: supplierName.trim() || null,
        quantity: qty,
        unitPrice: price,
        totalCost: total,
        status: 'pending',
      })

      setShowAddModal(false)
      resetForm()
      await fetchMaterials()
      Alert.alert('Success', 'Material added successfully')
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add material')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteMaterial = (materialId: string) => {
    Alert.alert(
      'Delete Material',
      'Are you sure you want to delete this material?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.deleteMaterial(id as string, materialId)
              await fetchMaterials()
              Alert.alert('Success', 'Material deleted')
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete material')
            }
          },
        },
      ]
    )
  }

  const resetForm = () => {
    setMaterialType('product')
    setDescription('')
    setSupplierName('')
    setQuantity('1')
    setUnitPrice('')
  }

  const calculateTotal = () => {
    const qty = parseFloat(quantity) || 0
    const price = parseFloat(unitPrice) || 0
    return (qty * price).toFixed(2)
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Materials & Equipment' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Materials & Equipment' }} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} tintColor="#2563eb" />
        }
      >
        {materials.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="package-variant-closed" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No materials added yet</Text>
            <Text style={styles.emptySubtext}>Tap the + button to add materials</Text>
          </View>
        ) : (
          materials.map((material) => (
            <View key={material.id} style={styles.materialCard}>
              <View style={styles.materialHeader}>
                <View style={styles.materialInfo}>
                  <Text style={styles.materialDescription}>{material.description}</Text>
                  {material.supplier_name && (
                    <Text style={styles.materialSupplier}>{material.supplier_name}</Text>
                  )}
                  <Text style={styles.materialType}>
                    {material.material_type === 'product' ? 'Product' : material.material_type === 'hire_equipment' ? 'Hire Equipment' : 'Part'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteMaterial(material.id)}
                >
                  <MaterialCommunityIcons name="delete" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>

              <View style={styles.materialDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Quantity:</Text>
                  <Text style={styles.detailValue}>{material.quantity}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Unit Price:</Text>
                  <Text style={styles.detailValue}>${parseFloat(material.unit_price).toFixed(2)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Total:</Text>
                  <Text style={styles.detailValueTotal}>${parseFloat(material.total_cost).toFixed(2)}</Text>
                </View>
              </View>

              <View style={[styles.statusBadge, { backgroundColor: material.status === 'approved' ? '#10b981' : material.status === 'rejected' ? '#ef4444' : '#f59e0b' }]}>
                <Text style={styles.statusText}>{material.status}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Add Material Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={styles.modalOverlayTouchable}
            activeOpacity={1}
            onPress={() => setShowAddModal(false)}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Material</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
            >
              <Text style={styles.label}>Type</Text>
              <View style={styles.typeButtons}>
                <TouchableOpacity
                  style={[styles.typeButton, materialType === 'product' && styles.typeButtonActive]}
                  onPress={() => setMaterialType('product')}
                >
                  <Text style={[styles.typeButtonText, materialType === 'product' && styles.typeButtonTextActive]}>Product</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeButton, materialType === 'part' && styles.typeButtonActive]}
                  onPress={() => setMaterialType('part')}
                >
                  <Text style={[styles.typeButtonText, materialType === 'part' && styles.typeButtonTextActive]}>Part</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeButton, materialType === 'hire_equipment' && styles.typeButtonActive]}
                  onPress={() => setMaterialType('hire_equipment')}
                >
                  <Text style={[styles.typeButtonText, materialType === 'hire_equipment' && styles.typeButtonTextActive]}>Equipment</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Description *</Text>
              <TextInput
                style={styles.input}
                value={description}
                onChangeText={setDescription}
                placeholder="Enter description"
                placeholderTextColor="#999"
                multiline
              />

              <Text style={styles.label}>Supplier</Text>
              <TextInput
                style={styles.input}
                value={supplierName}
                onChangeText={setSupplierName}
                placeholder="Supplier name"
                placeholderTextColor="#999"
              />

              <Text style={styles.label}>Quantity *</Text>
              <TextInput
                style={styles.input}
                value={quantity}
                onChangeText={setQuantity}
                placeholder="1"
                placeholderTextColor="#999"
                keyboardType="numeric"
              />

              <Text style={styles.label}>Unit Price * ($)</Text>
              <TextInput
                style={styles.input}
                value={unitPrice}
                onChangeText={setUnitPrice}
                placeholder="0.00"
                placeholderTextColor="#999"
                keyboardType="decimal-pad"
              />

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total:</Text>
                <Text style={styles.totalValue}>${calculateTotal()}</Text>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleAddMaterial}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Add</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => setShowAddModal(true)}
      />
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
  materialCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  materialHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  materialInfo: {
    flex: 1,
  },
  materialDescription: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 4,
  },
  materialSupplier: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  materialType: {
    fontSize: 12,
    color: '#999',
    textTransform: 'capitalize',
  },
  deleteButton: {
    padding: 4,
  },
  materialDetails: {
    gap: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },
  detailValueTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'capitalize',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#2563eb',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalOverlayTouchable: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
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
    maxHeight: 500,
  },
  modalScrollContent: {
    padding: 16,
    paddingBottom: 32,
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
    gap: 8,
    marginBottom: 8,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    alignItems: 'center',
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
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    padding: 16,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  totalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2563eb',
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
