import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'

interface MultiCheckboxFieldProps {
  question: any
  value: string[]
  onChange: (value: string[]) => void
}

export function MultiCheckboxField({ question, value = [], onChange }: MultiCheckboxFieldProps) {
  const options = question.answer_options || []

  const toggleOption = (optionText: string) => {
    if (value.includes(optionText)) {
      onChange(value.filter((v) => v !== optionText))
    } else {
      onChange([...value, optionText])
    }
  }

  return (
    <View style={styles.container}>
      {options.map((option: any) => {
        const isChecked = value.includes(option.text) || value.includes(option.id)
        return (
          <TouchableOpacity
            key={option.id || option.text}
            style={styles.option}
            onPress={() => toggleOption(option.text)}
          >
            <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
              {isChecked && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.optionText}>{option.text}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D1D6',
    borderRadius: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 4,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  optionText: {
    fontSize: 16,
    color: '#000',
    flex: 1,
  },
})
