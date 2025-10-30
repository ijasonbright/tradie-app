import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from 'react-native'
import { useState, useEffect } from 'react'
import { Ionicons } from '@expo/vector-icons'
import apiClient from '../lib/api-client'

interface Color {
  hex: string
  rgb: [number, number, number]
  isDark: boolean
  name: string
}

interface ColorPickerProps {
  logoUrl: string | null
  selectedColor: string | null
  onColorSelect: (color: string) => void
  defaultColor?: string
}

export default function ColorPicker({
  logoUrl,
  selectedColor,
  onColorSelect,
  defaultColor = '#1E40AF',
}: ColorPickerProps) {
  const [colors, setColors] = useState<Color[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (logoUrl) {
      extractColors()
    }
  }, [logoUrl])

  const extractColors = async () => {
    if (!logoUrl) return

    setLoading(true)
    setError(null)

    try {
      const response = await apiClient.extractLogoColors(logoUrl)
      setColors(response.colors || [])
    } catch (err) {
      console.error('Error extracting colors:', err)
      setError('Failed to extract colors from logo')
    } finally {
      setLoading(false)
    }
  }

  if (!logoUrl) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Upload a logo first to extract brand colors</Text>
      </View>
    )
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#2563EB" />
        <Text style={styles.loadingText}>Extracting colors from logo...</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    )
  }

  const darkColors = colors.filter(c => c.isDark)
  const lightColors = colors.filter(c => !c.isDark)

  const handleLightColorPress = (color: string) => {
    Alert.alert(
      'Light Color Warning',
      'This is a light color. Text may be hard to read on it. Are you sure you want to use it?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Use It', onPress: () => onColorSelect(color) },
      ]
    )
  }

  return (
    <View style={styles.container}>
      {darkColors.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            Choose your brand color (recommended - dark colors for best readability)
          </Text>
          <View style={styles.colorGrid}>
            {darkColors.map((color) => (
              <TouchableOpacity
                key={color.hex}
                onPress={() => onColorSelect(color.hex)}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: color.hex },
                  selectedColor === color.hex && styles.selectedSwatch,
                ]}
                activeOpacity={0.7}
              >
                {selectedColor === color.hex && (
                  <Ionicons name="checkmark" size={24} color="white" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {lightColors.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabelWarning}>
            Light colors (not recommended - text may be hard to read)
          </Text>
          <View style={[styles.colorGrid, styles.lightColorsGrid]}>
            {lightColors.map((color) => (
              <TouchableOpacity
                key={color.hex}
                onPress={() => handleLightColorPress(color.hex)}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: color.hex },
                  selectedColor === color.hex && styles.selectedSwatch,
                ]}
                activeOpacity={0.7}
              >
                {selectedColor === color.hex && (
                  <Ionicons name="checkmark" size={24} color="#1F2937" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {colors.length === 0 && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            Could not extract colors from logo. You can still use the default color.
          </Text>
        </View>
      )}

      <View style={[styles.section, styles.defaultSection]}>
        <Text style={styles.sectionLabel}>Or use default color</Text>
        <TouchableOpacity
          onPress={() => onColorSelect(defaultColor)}
          style={[
            styles.colorSwatch,
            { backgroundColor: defaultColor },
            selectedColor === defaultColor && styles.selectedSwatch,
          ]}
          activeOpacity={0.7}
        >
          {selectedColor === defaultColor && (
            <Ionicons name="checkmark" size={24} color="white" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 20,
  },
  section: {
    gap: 12,
  },
  defaultSection: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  sectionLabelWarning: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  lightColorsGrid: {
    opacity: 0.6,
  },
  colorSwatch: {
    width: 64,
    height: 64,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedSwatch: {
    borderColor: '#111827',
    borderWidth: 3,
    transform: [{ scale: 1.05 }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  emptyContainer: {
    padding: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
  },
  errorContainer: {
    padding: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
  },
})
