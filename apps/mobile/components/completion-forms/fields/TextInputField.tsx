import React from 'react'
import { TextInput, StyleSheet } from 'react-native'

interface TextInputFieldProps {
  question: any
  value: string
  onChange: (value: string) => void
}

export function TextInputField({ question, value, onChange }: TextInputFieldProps) {
  const getKeyboardType = () => {
    switch (question.field_type) {
      case 'email':
        return 'email-address'
      case 'phone':
        return 'phone-pad'
      default:
        return 'default'
    }
  }

  const getAutoCapitalize = () => {
    return question.field_type === 'email' ? 'none' : 'sentences'
  }

  return (
    <TextInput
      style={styles.input}
      value={value || ''}
      onChangeText={onChange}
      placeholder={question.placeholder || `Enter ${question.question_text.toLowerCase()}`}
      keyboardType={getKeyboardType()}
      autoCapitalize={getAutoCapitalize()}
      autoCorrect={question.field_type !== 'email'}
    />
  )
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D1D6',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000',
  },
})
