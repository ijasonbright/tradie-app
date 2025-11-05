import React, { useState } from 'react'
import { View, Text, TouchableOpacity, Platform, StyleSheet } from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'

interface DateFieldProps {
  question: any
  value: string
  onChange: (value: string) => void
}

export function DateField({ question, value, onChange }: DateFieldProps) {
  const [show, setShow] = useState(false)
  const [date, setDate] = useState(value ? new Date(value) : new Date())

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShow(Platform.OS === 'ios')
    if (selectedDate) {
      setDate(selectedDate)
      onChange(selectedDate.toISOString().split('T')[0])
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Select a date'
    const d = new Date(dateString)
    return d.toLocaleDateString('en-AU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <View>
      <TouchableOpacity style={styles.button} onPress={() => setShow(true)}>
        <Text style={[styles.buttonText, !value && styles.placeholder]}>
          {formatDate(value)}
        </Text>
        <Text style={styles.icon}>📅</Text>
      </TouchableOpacity>

      {show && (
        <DateTimePicker
          value={date}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onDateChange}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D1D6',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    color: '#000',
  },
  placeholder: {
    color: '#999',
  },
  icon: {
    fontSize: 20,
  },
})
