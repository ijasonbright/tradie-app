import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, RefreshControl, Modal, KeyboardAvoidingView, Platform } from 'react-native'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { useState, useEffect } from 'react'
import { apiClient } from '../../../lib/api-client'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { FAB } from 'react-native-paper'

export default function JobNotesScreen() {
  const { id } = useLocalSearchParams()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [notes, setNotes] = useState<any[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form fields
  const [noteType, setNoteType] = useState('general')
  const [noteText, setNoteText] = useState('')

  useEffect(() => {
    fetchNotes()
  }, [id])

  const fetchNotes = async () => {
    try {
      setLoading(true)
      const response = await apiClient.getNotes(id as string)
      setNotes(response.notes || [])
    } catch (err: any) {
      console.error('Failed to fetch notes:', err)
      Alert.alert('Error', 'Failed to load notes')
    } finally {
      setLoading(false)
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchNotes()
    setRefreshing(false)
  }

  const handleAddNote = async () => {
    if (!noteText.trim()) {
      Alert.alert('Validation Error', 'Note text is required')
      return
    }

    try {
      setSaving(true)
      await apiClient.addNote(id as string, {
        noteText: noteText.trim(),
        noteType,
      })

      setShowAddModal(false)
      resetForm()
      await fetchNotes()
      Alert.alert('Success', 'Note added successfully')
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add note')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteNote = (noteId: string) => {
    Alert.alert(
      'Delete Note',
      'Are you sure you want to delete this note?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.deleteNote(id as string, noteId)
              await fetchNotes()
              Alert.alert('Success', 'Note deleted')
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete note')
            }
          },
        },
      ]
    )
  }

  const resetForm = () => {
    setNoteType('general')
    setNoteText('')
  }

  const getNoteTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      general: 'General',
      issue: 'Issue',
      client_request: 'Client Request',
      internal: 'Internal',
    }
    return labels[type] || type
  }

  const getNoteTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      general: '#3b82f6',
      issue: '#ef4444',
      client_request: '#f59e0b',
      internal: '#8b5cf6',
    }
    return colors[type] || '#666'
  }

  const getNoteTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      general: 'note-text',
      issue: 'alert-circle',
      client_request: 'account-voice',
      internal: 'lock',
    }
    return icons[type] || 'note-text'
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Notes' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Notes' }} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} tintColor="#2563eb" />
        }
      >
        {notes.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="note-text-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No notes yet</Text>
            <Text style={styles.emptySubtext}>Tap the + button to add a note</Text>
          </View>
        ) : (
          notes.map((note) => (
            <View key={note.id} style={styles.noteCard}>
              <View style={styles.noteHeader}>
                <View style={styles.noteHeaderLeft}>
                  <MaterialCommunityIcons
                    name={getNoteTypeIcon(note.note_type)}
                    size={20}
                    color={getNoteTypeColor(note.note_type)}
                  />
                  <View style={[styles.noteTypeBadge, { backgroundColor: getNoteTypeColor(note.note_type) }]}>
                    <Text style={styles.noteTypeBadgeText}>
                      {getNoteTypeLabel(note.note_type)}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteNote(note.id)}
                >
                  <MaterialCommunityIcons name="delete" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>

              <Text style={styles.noteText}>{note.note_text}</Text>

              <View style={styles.noteFooter}>
                <Text style={styles.noteAuthor}>{note.user_name || 'Unknown'}</Text>
                <Text style={styles.noteDate}>
                  {new Date(note.created_at).toLocaleString('en-AU', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Add Note Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowAddModal(false)
          resetForm()
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Note</Text>
              <TouchableOpacity onPress={() => {
                setShowAddModal(false)
                resetForm()
              }}>
                <MaterialCommunityIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.label}>Note Type</Text>
              <View style={styles.typeButtons}>
                {['general', 'issue', 'client_request', 'internal'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeButton, noteType === type && styles.typeButtonActive]}
                    onPress={() => setNoteType(type)}
                  >
                    <MaterialCommunityIcons
                      name={getNoteTypeIcon(type)}
                      size={18}
                      color={noteType === type ? '#fff' : '#666'}
                    />
                    <Text style={[styles.typeButtonText, noteType === type && styles.typeButtonTextActive]}>
                      {getNoteTypeLabel(type)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Note *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={noteText}
                onChangeText={setNoteText}
                placeholder="Enter your note..."
                placeholderTextColor="#999"
                multiline
                numberOfLines={8}
                textAlignVertical="top"
                autoFocus
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowAddModal(false)
                  resetForm()
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleAddNote}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Add Note</Text>
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
  noteCard: {
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
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  noteHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noteTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  noteTypeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  deleteButton: {
    padding: 4,
  },
  noteText: {
    fontSize: 15,
    color: '#111',
    lineHeight: 22,
    marginBottom: 12,
  },
  noteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  noteAuthor: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  noteDate: {
    fontSize: 12,
    color: '#999',
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
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  typeButton: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
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
    minHeight: 150,
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
