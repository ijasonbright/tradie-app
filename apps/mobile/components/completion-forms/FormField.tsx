import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { TextInputField } from './fields/TextInputField'
import { TextAreaField } from './fields/TextAreaField'
import { NumberInputField } from './fields/NumberInputField'
import { DropdownField } from './fields/DropdownField'
import { RadioField } from './fields/RadioField'
import { CheckboxField } from './fields/CheckboxField'
import { MultiCheckboxField } from './fields/MultiCheckboxField'
import { DateField } from './fields/DateField'
import { FileField } from './fields/FileField'

interface FormFieldProps {
  question: any
  value: any
  error?: string
  onChange: (value: any) => void
}

export function FormField({ question, value, error, onChange }: FormFieldProps) {
  const renderField = () => {
    switch (question.field_type) {
      case 'text':
      case 'email':
      case 'phone':
        return <TextInputField question={question} value={value} onChange={onChange} />

      case 'textarea':
        return <TextAreaField question={question} value={value} onChange={onChange} />

      case 'number':
        return <NumberInputField question={question} value={value} onChange={onChange} />

      case 'dropdown':
        return <DropdownField question={question} value={value} onChange={onChange} />

      case 'radio':
        return <RadioField question={question} value={value} onChange={onChange} />

      case 'checkbox':
        return <CheckboxField question={question} value={value} onChange={onChange} />

      case 'multi_checkbox':
      case 'checkboxlist':
        return <MultiCheckboxField question={question} value={value} onChange={onChange} />

      case 'date':
      case 'datepicker':
        return <DateField question={question} value={value} onChange={onChange} />

      case 'file':
        return <FileField question={question} value={value} onChange={onChange} />

      default:
        return (
          <View style={styles.unsupportedField}>
            <Text style={styles.unsupportedText}>
              Unsupported field type: {question.field_type}
            </Text>
          </View>
        )
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.labelContainer}>
        <Text style={styles.label}>
          {question.question_text}
          {question.is_required && <Text style={styles.required}> *</Text>}
        </Text>
        {question.help_text && <Text style={styles.helpText}>{question.help_text}</Text>}
      </View>

      {renderField()}

      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  labelContainer: {
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    lineHeight: 22,
  },
  required: {
    color: '#FF3B30',
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    lineHeight: 18,
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    marginTop: 4,
  },
  unsupportedField: {
    padding: 12,
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFE69C',
  },
  unsupportedText: {
    fontSize: 14,
    color: '#856404',
  },
})
