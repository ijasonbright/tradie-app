'use client'

import { useState, useEffect } from 'react'

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logoUrl])

  const extractColors = async () => {
    if (!logoUrl) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/organizations/extract-logo-colors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ logoUrl }),
      })

      if (!response.ok) {
        throw new Error('Failed to extract colors')
      }

      const data = await response.json()
      setColors(data.colors || [])
    } catch (err) {
      console.error('Error extracting colors:', err)
      setError('Failed to extract colors from logo')
    } finally {
      setLoading(false)
    }
  }

  if (!logoUrl) {
    return (
      <div className="text-sm text-gray-500">
        Upload a logo first to extract brand colors
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        Extracting colors from logo...
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-sm text-red-600">
        {error}
      </div>
    )
  }

  const darkColors = colors.filter(c => c.isDark)
  const lightColors = colors.filter(c => !c.isDark)

  return (
    <div className="space-y-4">
      {darkColors.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Choose your brand color (recommended - dark colors for best readability)
          </label>
          <div className="flex flex-wrap gap-3">
            {darkColors.map((color) => (
              <button
                key={color.hex}
                onClick={() => onColorSelect(color.hex)}
                className={`group relative w-16 h-16 rounded-lg border-2 transition-all hover:scale-110 ${
                  selectedColor === color.hex
                    ? 'border-gray-900 shadow-lg scale-105'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                style={{ backgroundColor: color.hex }}
                title={`${color.name} - ${color.hex}`}
              >
                {selectedColor === color.hex && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                )}
                <div className="absolute -bottom-6 left-0 right-0 text-xs text-center text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  {color.hex}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {lightColors.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-2">
            Light colors (not recommended - text may be hard to read)
          </label>
          <div className="flex flex-wrap gap-3 opacity-60">
            {lightColors.map((color) => (
              <button
                key={color.hex}
                onClick={() => {
                  if (
                    window.confirm(
                      'This is a light color. Text may be hard to read on it. Are you sure?'
                    )
                  ) {
                    onColorSelect(color.hex)
                  }
                }}
                className={`group relative w-16 h-16 rounded-lg border-2 transition-all hover:scale-110 ${
                  selectedColor === color.hex
                    ? 'border-gray-900 shadow-lg scale-105'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                style={{ backgroundColor: color.hex }}
                title={`${color.name} - ${color.hex} (light)`}
              >
                {selectedColor === color.hex && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-gray-900"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                )}
                <div className="absolute -bottom-6 left-0 right-0 text-xs text-center text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  {color.hex}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {colors.length === 0 && (
        <div className="text-sm text-gray-500">
          Could not extract colors from logo. You can still use the default color.
        </div>
      )}

      <div className="pt-4 border-t">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Or use default color
        </label>
        <button
          onClick={() => onColorSelect(defaultColor)}
          className={`relative w-16 h-16 rounded-lg border-2 transition-all hover:scale-110 ${
            selectedColor === defaultColor
              ? 'border-gray-900 shadow-lg scale-105'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          style={{ backgroundColor: defaultColor }}
          title={`Default - ${defaultColor}`}
        >
          {selectedColor === defaultColor && (
            <div className="absolute inset-0 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          )}
        </button>
      </div>
    </div>
  )
}
