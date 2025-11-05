import React from 'react'
import { TextInput, StyleSheet } from 'react-native'

interface NumberInputFieldProps {
  question: any
  value: number | string
  onChange: (value: string) => void
}

export function NumberInputField({ question, value, onChange }: NumberInputFieldProps) {
  return (
    <TextInput
      style={styles.input}
      value={value?.toString() || ''}
      onChangeText={onChange}
      placeholder={question.placeholder || '0'}
      keyboardType="numeric"
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
