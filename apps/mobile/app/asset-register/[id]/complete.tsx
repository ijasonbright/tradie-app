import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
import { Button, Card, Checkbox, RadioButton } from 'react-native-paper'
import { useState, useEffect } from 'react'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { apiClient } from '../../../lib/api-client'

// Simple asset register completion form
// This captures key information about the property's assets
const FORM_SECTIONS = [
  {
    title: 'General Information',
    fields: [
      { id: 'property_condition', label: 'Overall Property Condition', type: 'radio', options: ['Excellent', 'Good', 'Fair', 'Poor'] },
      { id: 'general_notes', label: 'General Notes', type: 'textarea', placeholder: 'Any general observations about the property...' },
    ],
  },
  {
    title: 'HVAC Systems',
    fields: [
      { id: 'hvac_present', label: 'HVAC System Present', type: 'checkbox' },
      { id: 'hvac_type', label: 'Type', type: 'text', placeholder: 'e.g., Split system, Ducted' },
      { id: 'hvac_brand', label: 'Brand/Model', type: 'text', placeholder: 'e.g., Daikin FTX35' },
      { id: 'hvac_condition', label: 'Condition', type: 'radio', options: ['Excellent', 'Good', 'Fair', 'Poor', 'N/A'] },
      { id: 'hvac_notes', label: 'Notes', type: 'textarea', placeholder: 'Service history, issues, etc.' },
    ],
  },
  {
    title: 'Hot Water System',
    fields: [
      { id: 'hw_present', label: 'Hot Water System Present', type: 'checkbox' },
      { id: 'hw_type', label: 'Type', type: 'text', placeholder: 'e.g., Electric, Gas, Solar' },
      { id: 'hw_brand', label: 'Brand/Model', type: 'text', placeholder: 'e.g., Rheem 315L' },
      { id: 'hw_condition', label: 'Condition', type: 'radio', options: ['Excellent', 'Good', 'Fair', 'Poor', 'N/A'] },
      { id: 'hw_notes', label: 'Notes', type: 'textarea', placeholder: 'Age, capacity, issues, etc.' },
    ],
  },
  {
    title: 'Kitchen Appliances',
    fields: [
      { id: 'oven_brand', label: 'Oven Brand/Model', type: 'text', placeholder: 'e.g., Westinghouse WVE614' },
      { id: 'cooktop_brand', label: 'Cooktop Brand/Model', type: 'text', placeholder: 'e.g., Bosch Gas' },
      { id: 'rangehood_brand', label: 'Range Hood Brand', type: 'text' },
      { id: 'dishwasher_brand', label: 'Dishwasher Brand/Model', type: 'text' },
      { id: 'kitchen_condition', label: 'Kitchen Appliances Condition', type: 'radio', options: ['Excellent', 'Good', 'Fair', 'Poor'] },
      { id: 'kitchen_notes', label: 'Notes', type: 'textarea', placeholder: 'Any issues or observations...' },
    ],
  },
  {
    title: 'Smoke Alarms',
    fields: [
      { id: 'smoke_alarm_count', label: 'Number of Smoke Alarms', type: 'number' },
      { id: 'smoke_alarm_type', label: 'Type', type: 'radio', options: ['Photoelectric', 'Ionisation', 'Combination', 'Unknown'] },
      { id: 'smoke_alarm_compliant', label: 'Appear Compliant', type: 'radio', options: ['Yes', 'No', 'Unknown'] },
      { id: 'smoke_alarm_notes', label: 'Notes', type: 'textarea', placeholder: 'Last test date, any issues...' },
    ],
  },
  {
    title: 'Completion',
    fields: [
      { id: 'completion_notes', label: 'Completion Notes', type: 'textarea', placeholder: 'Any final notes or recommendations...' },
      { id: 'technician_name', label: 'Technician Name', type: 'text', required: true },
    ],
  },
]

export default function AssetRegisterCompleteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(false)
  const [currentSection, setCurrentSection] = useState(0)

  const updateField = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }))
  }

  const renderField = (field: any) => {
    switch (field.type) {
      case 'text':
      case 'number':
        return (
          <TextInput
            style={styles.textInput}
            placeholder={field.placeholder}
            placeholderTextColor="#999"
            value={formData[field.id] || ''}
            onChangeText={(value) => updateField(field.id, value)}
            keyboardType={field.type === 'number' ? 'numeric' : 'default'}
          />
        )

      case 'textarea':
        return (
          <TextInput
            style={[styles.textInput, styles.textArea]}
            placeholder={field.placeholder}
            placeholderTextColor="#999"
            value={formData[field.id] || ''}
            onChangeText={(value) => updateField(field.id, value)}
            multiline
            numberOfLines={4}
          />
        )

      case 'checkbox':
        return (
          <Checkbox.Item
            label={field.label}
            status={formData[field.id] ? 'checked' : 'unchecked'}
            onPress={() => updateField(field.id, !formData[field.id])}
            style={styles.checkbox}
          />
        )

      case 'radio':
        return (
          <RadioButton.Group
            value={formData[field.id] || ''}
            onValueChange={(value) => updateField(field.id, value)}
          >
            <View style={styles.radioGroup}>
              {field.options?.map((option: string) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.radioOption,
                    formData[field.id] === option && styles.radioOptionSelected
                  ]}
                  onPress={() => updateField(field.id, option)}
                >
                  <RadioButton value={option} />
                  <Text style={styles.radioLabel}>{option}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </RadioButton.Group>
        )

      default:
        return null
    }
  }

  const handleNext = () => {
    if (currentSection < FORM_SECTIONS.length - 1) {
      setCurrentSection(prev => prev + 1)
    }
  }

  const handlePrevious = () => {
    if (currentSection > 0) {
      setCurrentSection(prev => prev - 1)
    }
  }

  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.technician_name) {
      Alert.alert('Required', 'Please enter your name')
      return
    }

    Alert.alert(
      'Submit Asset Register',
      'Are you sure you want to submit this asset register? This will mark the job as completed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            try {
              setLoading(true)
              await apiClient.completeAssetRegisterJob(id!, {
                form_data: formData,
                completion_notes: formData.completion_notes || '',
                technician_name: formData.technician_name,
                report_data: {
                  sections: FORM_SECTIONS.map(section => ({
                    title: section.title,
                    fields: section.fields.map(field => ({
                      id: field.id,
                      label: field.label,
                      value: formData[field.id] || null,
                    })),
                  })),
                  completed_at: new Date().toISOString(),
                },
              })

              Alert.alert(
                'Success',
                'Asset register has been submitted successfully!',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      router.replace('/asset-register')
                    },
                  },
                ]
              )
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to submit asset register')
            } finally {
              setLoading(false)
            }
          },
        },
      ]
    )
  }

  const section = FORM_SECTIONS[currentSection]

  return (
    <>
      <Stack.Screen
        options={{
          title: `Asset Register (${currentSection + 1}/${FORM_SECTIONS.length})`,
        }}
      />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          {FORM_SECTIONS.map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressDot,
                index <= currentSection && styles.progressDotActive,
              ]}
            />
          ))}
        </View>

        <ScrollView style={styles.scrollView}>
          <Card style={styles.card}>
            <Card.Title
              title={section.title}
              titleStyle={styles.sectionTitle}
            />
            <Card.Content>
              {section.fields.map((field) => (
                <View key={field.id} style={styles.fieldContainer}>
                  {field.type !== 'checkbox' && (
                    <Text style={styles.fieldLabel}>
                      {field.label}
                      {field.required && <Text style={styles.required}> *</Text>}
                    </Text>
                  )}
                  {renderField(field)}
                </View>
              ))}
            </Card.Content>
          </Card>
        </ScrollView>

        {/* Navigation Buttons */}
        <View style={styles.navigationContainer}>
          <Button
            mode="outlined"
            onPress={handlePrevious}
            disabled={currentSection === 0}
            style={styles.navButton}
          >
            Previous
          </Button>

          {currentSection < FORM_SECTIONS.length - 1 ? (
            <Button
              mode="contained"
              onPress={handleNext}
              style={styles.navButton}
            >
              Next
            </Button>
          ) : (
            <Button
              mode="contained"
              onPress={handleSubmit}
              loading={loading}
              disabled={loading}
              style={[styles.navButton, styles.submitButton]}
            >
              Submit
            </Button>
          )}
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
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    gap: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ddd',
  },
  progressDotActive: {
    backgroundColor: '#2563eb',
  },
  scrollView: {
    flex: 1,
  },
  card: {
    margin: 16,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  required: {
    color: '#ef4444',
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
    minHeight: 100,
    textAlignVertical: 'top',
  },
  checkbox: {
    paddingLeft: 0,
    marginLeft: -8,
  },
  radioGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingRight: 12,
    backgroundColor: '#fff',
  },
  radioOptionSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  radioLabel: {
    fontSize: 14,
    color: '#333',
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
  submitButton: {
    backgroundColor: '#16a34a',
  },
})
