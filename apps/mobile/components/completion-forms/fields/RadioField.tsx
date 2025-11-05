import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'

interface RadioFieldProps {
  question: any
  value: string
  onChange: (value: string) => void
}

export function RadioField({ question, value, onChange }: RadioFieldProps) {
  const options = question.answer_options || []

  return (
    <View style={styles.container}>
      {options.map((option: any) => {
        const isSelected = value === option.text || value === option.id
        return (
          <TouchableOpacity
            key={option.id || option.text}
            style={styles.option}
            onPress={() => onChange(option.text)}
          >
            <View style={styles.radio}>
              {isSelected && <View style={styles.radioSelected} />}
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
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#007AFF',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007AFF',
  },
  optionText: {
    fontSize: 16,
    color: '#000',
    flex: 1,
  },
})
