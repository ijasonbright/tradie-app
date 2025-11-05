import React from 'react'
import { TextInput, StyleSheet } from 'react-native'

interface TextAreaFieldProps {
  question: any
  value: string
  onChange: (value: string) => void
}

export function TextAreaField({ question, value, onChange }: TextAreaFieldProps) {
  return (
    <TextInput
      style={styles.input}
      value={value || ''}
      onChangeText={onChange}
      placeholder={question.placeholder || `Enter ${question.question_text.toLowerCase()}`}
      multiline
      numberOfLines={4}
      textAlignVertical="top"
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
    minHeight: 100,
  },
})
