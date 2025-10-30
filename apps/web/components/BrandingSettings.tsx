'use client'

import { useState } from 'react'
import ColorPicker from './ColorPicker'

interface BrandingSettingsProps {
  logoUrl: string | null
  primaryColor: string | null
  onSave: (logoUrl: string | null, primaryColor: string | null) => Promise<void>
}

export default function BrandingSettings({ logoUrl: initialLogoUrl, primaryColor: initialPrimaryColor, onSave }: BrandingSettingsProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl)
  const [primaryColor, setPrimaryColor] = useState<string | null>(initialPrimaryColor)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        const data = await res.json()
        setLogoUrl(data.url)
        alert('Logo uploaded! Now select your brand color below.')
      } else {
        const error = await res.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error uploading logo:', error)
      alert('Failed to upload logo')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(logoUrl, primaryColor)
      alert('Branding saved successfully!')
    } catch (error) {
      console.error('Error saving branding:', error)
      alert('Failed to save branding')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-6 text-xl font-semibold">Logo & Brand Colors</h2>
        <p className="mb-6 text-sm text-gray-600">
          Upload your business logo and select your brand color. These will be used throughout the app and on invoices.
        </p>

        {/* Logo Upload */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-gray-700 mb-2">Business Logo</label>

          {logoUrl && (
            <div className="mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <img
                src={logoUrl}
                alt="Business Logo"
                className="max-h-32 object-contain"
              />
            </div>
          )}

          <input
            type="file"
            accept="image/*"
            onChange={handleLogoUpload}
            disabled={uploading}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {uploading && <p className="mt-2 text-sm text-gray-600">Uploading...</p>}
          <p className="mt-2 text-xs text-gray-500">
            Recommended: PNG or JPG, transparent background, max 2MB
          </p>
        </div>

        {/* Color Picker */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-4">Brand Color</label>
          <ColorPicker
            logoUrl={logoUrl}
            selectedColor={primaryColor}
            onColorSelect={setPrimaryColor}
          />

          {primaryColor && (
            <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <p className="text-sm font-medium text-gray-700 mb-2">Selected Color Preview:</p>
              <div
                className="h-16 w-full rounded-lg flex items-center justify-center text-white font-semibold shadow-md"
                style={{ backgroundColor: primaryColor }}
              >
                {primaryColor}
              </div>
              <p className="mt-2 text-xs text-gray-600">
                This color will be used in app headers, buttons, and invoices
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:bg-blue-300"
        >
          {saving ? 'Saving...' : 'Save Branding'}
        </button>
      </div>
    </div>
  )
}
