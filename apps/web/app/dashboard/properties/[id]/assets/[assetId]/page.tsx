'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface Asset {
  id: string
  property_id: string
  name: string
  category: string
  brand: string | null
  model: string | null
  serial_number: string | null
  room: string | null
  condition: string
  estimated_age: string | null
  current_value: string | null
  replacement_cost: string | null
  warranty_status: string | null
  maintenance_required: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

interface Photo {
  id: string
  asset_id: string
  url: string
  caption: string | null
  is_primary: boolean
  created_at: string
}

const CATEGORIES = [
  { value: 'hvac', label: 'HVAC', icon: '🌡️' },
  { value: 'plumbing', label: 'Plumbing', icon: '🚿' },
  { value: 'electrical', label: 'Electrical', icon: '⚡' },
  { value: 'appliance', label: 'Appliance', icon: '🔌' },
  { value: 'fixture', label: 'Fixture', icon: '💡' },
  { value: 'structural', label: 'Structural', icon: '🏗️' },
  { value: 'safety', label: 'Safety', icon: '🔥' },
  { value: 'outdoor', label: 'Outdoor', icon: '🌳' },
  { value: 'other', label: 'Other', icon: '📦' },
]

const CONDITIONS = [
  { value: 'excellent', label: 'Excellent', color: 'bg-green-100 text-green-800' },
  { value: 'good', label: 'Good', color: 'bg-blue-100 text-blue-800' },
  { value: 'fair', label: 'Fair', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'poor', label: 'Poor', color: 'bg-orange-100 text-orange-800' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-800' },
]

const CONDITION_COLORS: Record<string, string> = {
  excellent: 'bg-green-100 text-green-800',
  good: 'bg-blue-100 text-blue-800',
  fair: 'bg-yellow-100 text-yellow-800',
  poor: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
}

const CATEGORY_ICONS: Record<string, string> = {
  hvac: '🌡️',
  plumbing: '🚿',
  electrical: '⚡',
  appliance: '🔌',
  fixture: '💡',
  structural: '🏗️',
  safety: '🔥',
  outdoor: '🌳',
  other: '📦',
}

const ESTIMATED_AGE_OPTIONS = [
  { value: 0, label: 'New', color: 'bg-green-100 text-green-800' },
  { value: 2, label: '1-3 yrs', color: 'bg-emerald-100 text-emerald-800' },
  { value: 5, label: '3-5 yrs', color: 'bg-blue-100 text-blue-800' },
  { value: 8, label: '5-10 yrs', color: 'bg-yellow-100 text-yellow-800' },
  { value: 12, label: '10-15 yrs', color: 'bg-orange-100 text-orange-800' },
  { value: 20, label: '15+ yrs', color: 'bg-red-100 text-red-800' },
]

export default function AssetDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [asset, setAsset] = useState<Asset | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState<Partial<Asset>>({})

  const fetchAsset = async () => {
    try {
      const res = await fetch(`/api/assets/${params.assetId}`)
      if (res.ok) {
        const data = await res.json()
        setAsset(data.asset)
        setPhotos(data.photos || [])
        setForm(data.asset)
      } else {
        alert('Asset not found')
        router.push(`/dashboard/properties/${params.id}`)
      }
    } catch (error) {
      console.error('Error fetching asset:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (params.assetId) {
      fetchAsset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.assetId])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/assets/${params.assetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          current_value: form.current_value ? parseFloat(form.current_value as string) : null,
          replacement_cost: form.replacement_cost
            ? parseFloat(form.replacement_cost as string)
            : null,
          estimated_age: form.estimated_age ? parseInt(form.estimated_age as string) : null,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setAsset(data.asset)
        setForm(data.asset)
        setEditing(false)
      } else {
        const error = await res.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error updating asset:', error)
      alert('Failed to update asset')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this asset? This action cannot be undone.')) {
      return
    }

    setDeleting(true)
    try {
      const res = await fetch(`/api/assets/${params.assetId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        router.push(`/dashboard/properties/${params.id}`)
      } else {
        const error = await res.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error deleting asset:', error)
      alert('Failed to delete asset')
    } finally {
      setDeleting(false)
    }
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`/api/assets/${params.assetId}/photos`, {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        const data = await res.json()
        setPhotos([...photos, data.photo])
      } else {
        const error = await res.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error uploading photo:', error)
      alert('Failed to upload photo')
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    )
  }

  if (!asset) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Asset not found</p>
      </div>
    )
  }

  const getCategoryInfo = () => {
    return CATEGORIES.find((c) => c.value === asset.category) || CATEGORIES[8]
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link
          href={`/dashboard/properties/${params.id}`}
          className="text-blue-600 hover:text-blue-800"
        >
          ← Back to Property
        </Link>
      </div>

      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-center gap-4">
          <span className="text-4xl">{CATEGORY_ICONS[asset.category] || '📦'}</span>
          <div>
            <h2 className="text-3xl font-bold">{asset.name}</h2>
            <div className="mt-2 flex gap-2">
              <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-800">
                {getCategoryInfo().label}
              </span>
              {asset.room && (
                <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-800">
                  {asset.room}
                </span>
              )}
              <span
                className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${
                  CONDITION_COLORS[asset.condition] || 'bg-gray-100 text-gray-800'
                }`}
              >
                {asset.condition}
              </span>
              {asset.maintenance_required && (
                <span className="inline-flex rounded-full bg-yellow-100 px-3 py-1 text-sm font-semibold text-yellow-800">
                  Maintenance Required
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {!editing ? (
            <>
              <button
                onClick={() => setEditing(true)}
                className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:bg-red-300"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:bg-green-300"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setForm(asset)
                  setEditing(false)
                }}
                className="rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Photos Section */}
      <div className="mb-6 rounded-lg bg-white p-6 shadow">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Photos ({photos.length})</h3>
          <label className="cursor-pointer rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
            {uploading ? 'Uploading...' : 'Add Photo'}
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>
        {photos.length === 0 ? (
          <p className="text-sm text-gray-500">No photos yet</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {photos.map((photo) => (
              <div key={photo.id} className="relative">
                <img
                  src={photo.url}
                  alt={photo.caption || asset.name}
                  className="h-32 w-full rounded-lg object-cover"
                />
                {photo.is_primary && (
                  <span className="absolute bottom-2 left-2 rounded bg-blue-600 px-2 py-1 text-xs text-white">
                    Primary
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Details */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h3 className="mb-4 text-lg font-semibold">Details</h3>
          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  value={form.name || ''}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Brand</label>
                <input
                  type="text"
                  value={form.brand || ''}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Model</label>
                <input
                  type="text"
                  value={form.model || ''}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Serial Number
                </label>
                <input
                  type="text"
                  value={form.serial_number || ''}
                  onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  Estimated Age
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ESTIMATED_AGE_OPTIONS.map((age) => (
                    <button
                      key={age.value}
                      type="button"
                      onClick={() => setForm({ ...form, estimated_age: age.value })}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                        String(form.estimated_age) === String(age.value)
                          ? age.color + ' ring-2 ring-offset-2'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {age.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <dl className="space-y-3">
              {asset.brand && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Brand</dt>
                  <dd className="mt-1 text-sm text-gray-900">{asset.brand}</dd>
                </div>
              )}
              {asset.model && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Model</dt>
                  <dd className="mt-1 text-sm text-gray-900">{asset.model}</dd>
                </div>
              )}
              {asset.serial_number && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Serial Number</dt>
                  <dd className="mt-1 text-sm text-gray-900">{asset.serial_number}</dd>
                </div>
              )}
              {asset.estimated_age && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Estimated Age</dt>
                  <dd className="mt-1 text-sm text-gray-900">{asset.estimated_age}</dd>
                </div>
              )}
              {!asset.brand && !asset.model && !asset.serial_number && !asset.estimated_age && (
                <p className="text-sm text-gray-500">No details provided</p>
              )}
            </dl>
          )}
        </div>

        {/* Value & Warranty */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h3 className="mb-4 text-lg font-semibold">Value & Warranty</h3>
          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Current Value ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.current_value || ''}
                  onChange={(e) => setForm({ ...form, current_value: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Replacement Cost ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.replacement_cost || ''}
                  onChange={(e) => setForm({ ...form, replacement_cost: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Warranty Status
                </label>
                <select
                  value={form.warranty_status || 'unknown'}
                  onChange={(e) => setForm({ ...form, warranty_status: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                >
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>
              <div className="flex items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.maintenance_required || false}
                    onChange={(e) =>
                      setForm({ ...form, maintenance_required: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Maintenance Required
                  </span>
                </label>
              </div>
            </div>
          ) : (
            <dl className="space-y-3">
              {asset.current_value && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Current Value</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    ${parseFloat(asset.current_value).toFixed(2)}
                  </dd>
                </div>
              )}
              {asset.replacement_cost && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Replacement Cost</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    ${parseFloat(asset.replacement_cost).toFixed(2)}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-sm font-medium text-gray-500">Warranty Status</dt>
                <dd className="mt-1 text-sm text-gray-900 capitalize">
                  {asset.warranty_status || 'Unknown'}
                </dd>
              </div>
              {!asset.current_value && !asset.replacement_cost && (
                <p className="text-sm text-gray-500">No value information provided</p>
              )}
            </dl>
          )}
        </div>

        {/* Condition & Location */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h3 className="mb-4 text-lg font-semibold">Condition & Location</h3>
          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Condition</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {CONDITIONS.map((cond) => (
                    <button
                      key={cond.value}
                      type="button"
                      onClick={() => setForm({ ...form, condition: cond.value })}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                        form.condition === cond.value
                          ? cond.color + ' ring-2 ring-offset-2'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {cond.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Room</label>
                <input
                  type="text"
                  value={form.room || ''}
                  onChange={(e) => setForm({ ...form, room: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Category</label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setForm({ ...form, category: cat.value })}
                      className={`flex flex-col items-center rounded-lg border-2 p-2 transition-colors ${
                        form.category === cat.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-xl">{cat.icon}</span>
                      <span className="mt-1 text-xs">{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">Condition</dt>
                <dd className="mt-1">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${
                      CONDITION_COLORS[asset.condition] || 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {asset.condition}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Room</dt>
                <dd className="mt-1 text-sm text-gray-900">{asset.room || 'Not specified'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Category</dt>
                <dd className="mt-1 text-sm text-gray-900">{getCategoryInfo().label}</dd>
              </div>
            </dl>
          )}
        </div>

        {/* Notes */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h3 className="mb-4 text-lg font-semibold">Notes</h3>
          {editing ? (
            <textarea
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={4}
              className="block w-full rounded-md border border-gray-300 px-3 py-2"
              placeholder="Any additional notes about the asset..."
            />
          ) : (
            <p className="whitespace-pre-wrap text-sm text-gray-900">
              {asset.notes || 'No notes'}
            </p>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="mt-6 text-sm text-gray-500">
        <p>Created: {new Date(asset.created_at).toLocaleString()}</p>
        <p>Last updated: {new Date(asset.updated_at).toLocaleString()}</p>
      </div>
    </div>
  )
}
