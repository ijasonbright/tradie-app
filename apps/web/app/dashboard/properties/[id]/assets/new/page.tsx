'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

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

const ROOMS = [
  'Kitchen',
  'Living Room',
  'Bedroom 1',
  'Bedroom 2',
  'Bedroom 3',
  'Bedroom 4',
  'Bathroom 1',
  'Bathroom 2',
  'Laundry',
  'Garage',
  'Garden',
  'Exterior',
  'Hallway',
  'Office',
  'Other',
]

const CONDITIONS = [
  { value: 'excellent', label: 'Excellent', color: 'bg-green-100 text-green-800' },
  { value: 'good', label: 'Good', color: 'bg-blue-100 text-blue-800' },
  { value: 'fair', label: 'Fair', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'poor', label: 'Poor', color: 'bg-orange-100 text-orange-800' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-800' },
]

const WARRANTY_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
  { value: 'unknown', label: 'Unknown' },
]

const ESTIMATED_AGE_OPTIONS = [
  { value: 0, label: 'New', color: 'bg-green-100 text-green-800' },
  { value: 2, label: '1-3 yrs', color: 'bg-emerald-100 text-emerald-800' },
  { value: 5, label: '3-5 yrs', color: 'bg-blue-100 text-blue-800' },
  { value: 8, label: '5-10 yrs', color: 'bg-yellow-100 text-yellow-800' },
  { value: 12, label: '10-15 yrs', color: 'bg-orange-100 text-orange-800' },
  { value: 20, label: '15+ yrs', color: 'bg-red-100 text-red-800' },
]

export default function NewAssetPage() {
  const params = useParams()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    category: 'other',
    brand: '',
    model: '',
    serial_number: '',
    room: '',
    condition: 'good',
    estimated_age: '',
    current_value: '',
    replacement_cost: '',
    warranty_status: 'unknown',
    maintenance_required: false,
    notes: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      alert('Please enter an asset name')
      return
    }

    setSaving(true)

    try {
      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          property_id: params.id,
          estimated_age: form.estimated_age ? parseInt(form.estimated_age) : null,
          current_value: form.current_value ? parseFloat(form.current_value) : null,
          replacement_cost: form.replacement_cost ? parseFloat(form.replacement_cost) : null,
        }),
      })

      if (res.ok) {
        router.push(`/dashboard/properties/${params.id}`)
      } else {
        const error = await res.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error creating asset:', error)
      alert('Failed to create asset')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link
          href={`/dashboard/properties/${params.id}`}
          className="text-blue-600 hover:text-blue-800"
        >
          ← Back to Property
        </Link>
      </div>

      <h2 className="mb-6 text-2xl font-bold">Add New Asset</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-lg bg-white p-6 shadow">
          <h3 className="mb-4 text-lg font-semibold">Basic Information</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Asset Name *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                placeholder="e.g., Split System Air Conditioner"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Category *
              </label>
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setForm({ ...form, category: cat.value })}
                    className={`flex flex-col items-center rounded-lg border-2 p-3 transition-colors ${
                      form.category === cat.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-2xl">{cat.icon}</span>
                    <span className="mt-1 text-xs">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Room</label>
              <select
                value={form.room}
                onChange={(e) => setForm({ ...form, room: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              >
                <option value="">Select Room</option>
                {ROOMS.map((room) => (
                  <option key={room} value={room}>
                    {room}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Condition *
              </label>
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
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <h3 className="mb-4 text-lg font-semibold">Details</h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Brand</label>
              <input
                type="text"
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                placeholder="e.g., Daikin"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Model</label>
              <input
                type="text"
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                placeholder="e.g., FTX-M25Q"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Serial Number
              </label>
              <input
                type="text"
                value={form.serial_number}
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
                    onClick={() => setForm({ ...form, estimated_age: age.value.toString() })}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      form.estimated_age === age.value.toString()
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
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <h3 className="mb-4 text-lg font-semibold">Value & Warranty</h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Current Value ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.current_value}
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
                value={form.replacement_cost}
                onChange={(e) => setForm({ ...form, replacement_cost: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Warranty Status
              </label>
              <select
                value={form.warranty_status}
                onChange={(e) => setForm({ ...form, warranty_status: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              >
                {WARRANTY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.maintenance_required}
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
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <h3 className="mb-4 text-lg font-semibold">Notes</h3>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={4}
            className="block w-full rounded-md border border-gray-300 px-3 py-2"
            placeholder="Any additional notes about the asset..."
          />
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
          >
            {saving ? 'Saving...' : 'Save Asset'}
          </button>
          <Link
            href={`/dashboard/properties/${params.id}`}
            className="rounded border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
