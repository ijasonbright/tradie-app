'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface Property {
  id: string
  organization_id: string
  organization_name: string
  external_property_id: number
  address_street: string | null
  address_suburb: string | null
  address_state: string | null
  address_postcode: string | null
  property_type: string | null
  bedrooms: number | null
  bathrooms: number | null
  owner_name: string | null
  owner_phone: string | null
  owner_email: string | null
  tenant_name: string | null
  tenant_phone: string | null
  tenant_email: string | null
  access_instructions: string | null
  notes: string | null
  synced_at: string | null
  created_at: string
}

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
  photo_count: number
  created_at: string
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

const CONDITION_COLORS: Record<string, string> = {
  excellent: 'bg-green-100 text-green-800',
  good: 'bg-blue-100 text-blue-800',
  fair: 'bg-yellow-100 text-yellow-800',
  poor: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
}

export default function PropertyDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [property, setProperty] = useState<Property | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [assetsLoading, setAssetsLoading] = useState(true)
  const [filterCategory, setFilterCategory] = useState('')
  const [filterRoom, setFilterRoom] = useState('')
  const [filterCondition, setFilterCondition] = useState('')

  const fetchProperty = async () => {
    try {
      const res = await fetch(`/api/properties/${params.id}`)
      if (res.ok) {
        const data = await res.json()
        setProperty(data.property)
      } else {
        alert('Property not found')
        router.push('/dashboard/properties')
      }
    } catch (error) {
      console.error('Error fetching property:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAssets = async () => {
    if (!params.id) return

    try {
      const res = await fetch(`/api/assets?property_id=${params.id}`)
      if (res.ok) {
        const data = await res.json()
        setAssets(data.assets || [])
      }
    } catch (error) {
      console.error('Error fetching assets:', error)
    } finally {
      setAssetsLoading(false)
    }
  }

  useEffect(() => {
    if (params.id) {
      fetchProperty()
      fetchAssets()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  const formatAddress = () => {
    if (!property) return ''
    const parts = [
      property.address_street,
      property.address_suburb,
      property.address_state,
      property.address_postcode,
    ].filter(Boolean)
    return parts.join(', ')
  }

  const uniqueCategories = Array.from(
    new Set(assets.map((a) => a.category).filter(Boolean))
  )
  const uniqueRooms = Array.from(
    new Set(assets.map((a) => a.room).filter(Boolean))
  )
  const uniqueConditions = Array.from(
    new Set(assets.map((a) => a.condition).filter(Boolean))
  )

  const filteredAssets = assets.filter((asset) => {
    const matchesCategory = !filterCategory || asset.category === filterCategory
    const matchesRoom = !filterRoom || asset.room === filterRoom
    const matchesCondition = !filterCondition || asset.condition === filterCondition
    return matchesCategory && matchesRoom && matchesCondition
  })

  // Group assets by room
  const assetsByRoom = filteredAssets.reduce((acc, asset) => {
    const room = asset.room || 'Other'
    if (!acc[room]) acc[room] = []
    acc[room].push(asset)
    return acc
  }, {} as Record<string, Asset[]>)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    )
  }

  if (!property) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Property not found</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link href="/dashboard/properties" className="text-blue-600 hover:text-blue-800">
          ← Back to Properties
        </Link>
      </div>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold">{property.address_street || 'Property'}</h2>
          <p className="mt-1 text-gray-600">
            {property.address_suburb}
            {property.address_suburb && property.address_state ? ', ' : ''}
            {property.address_state} {property.address_postcode}
          </p>
          <div className="mt-2 flex gap-2">
            {property.property_type && (
              <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-800">
                {property.property_type}
              </span>
            )}
            {property.bedrooms != null && (
              <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-800">
                {property.bedrooms} bed
              </span>
            )}
            {property.bathrooms != null && (
              <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-800">
                {property.bathrooms} bath
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Owner Information */}
        {(property.owner_name || property.owner_phone || property.owner_email) && (
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="mb-4 text-lg font-semibold">Owner</h3>
            <dl className="space-y-3">
              {property.owner_name && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Name</dt>
                  <dd className="mt-1 text-sm text-gray-900">{property.owner_name}</dd>
                </div>
              )}
              {property.owner_phone && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Phone</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    <a href={`tel:${property.owner_phone}`} className="text-blue-600 hover:text-blue-800">
                      {property.owner_phone}
                    </a>
                  </dd>
                </div>
              )}
              {property.owner_email && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Email</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    <a href={`mailto:${property.owner_email}`} className="text-blue-600 hover:text-blue-800">
                      {property.owner_email}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* Tenant Information */}
        {(property.tenant_name || property.tenant_phone || property.tenant_email) && (
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="mb-4 text-lg font-semibold">Tenant</h3>
            <dl className="space-y-3">
              {property.tenant_name && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Name</dt>
                  <dd className="mt-1 text-sm text-gray-900">{property.tenant_name}</dd>
                </div>
              )}
              {property.tenant_phone && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Phone</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    <a href={`tel:${property.tenant_phone}`} className="text-blue-600 hover:text-blue-800">
                      {property.tenant_phone}
                    </a>
                  </dd>
                </div>
              )}
              {property.tenant_email && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Email</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    <a href={`mailto:${property.tenant_email}`} className="text-blue-600 hover:text-blue-800">
                      {property.tenant_email}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* Access Instructions */}
        {property.access_instructions && (
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="mb-4 text-lg font-semibold">Access Instructions</h3>
            <p className="whitespace-pre-wrap text-sm text-gray-900">
              {property.access_instructions}
            </p>
          </div>
        )}

        {/* Notes */}
        {property.notes && (
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="mb-4 text-lg font-semibold">Notes</h3>
            <p className="whitespace-pre-wrap text-sm text-gray-900">{property.notes}</p>
          </div>
        )}
      </div>

      {/* Assets Section */}
      <div className="mt-8">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-xl font-semibold">Assets ({assets.length})</h3>
          <Link
            href={`/dashboard/properties/${property.id}/assets/new`}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Add Asset
          </Link>
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap gap-4">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">All Categories</option>
            {uniqueCategories.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_ICONS[cat] || '📦'} {cat}
              </option>
            ))}
          </select>
          <select
            value={filterRoom}
            onChange={(e) => setFilterRoom(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">All Rooms</option>
            {uniqueRooms.map((room) => (
              <option key={room} value={room!}>
                {room}
              </option>
            ))}
          </select>
          <select
            value={filterCondition}
            onChange={(e) => setFilterCondition(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">All Conditions</option>
            {uniqueConditions.map((cond) => (
              <option key={cond} value={cond}>
                {cond}
              </option>
            ))}
          </select>
        </div>

        {assetsLoading ? (
          <p className="text-gray-500">Loading assets...</p>
        ) : filteredAssets.length === 0 ? (
          <div className="rounded-lg bg-white p-12 text-center shadow">
            <h3 className="text-lg font-medium text-gray-900">
              {assets.length === 0 ? 'No assets yet' : 'No matching assets'}
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              {assets.length === 0
                ? 'Start by adding assets to this property'
                : 'Try adjusting your filters'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(assetsByRoom).map(([room, roomAssets]) => (
              <div key={room} className="rounded-lg bg-white shadow">
                <div className="border-b px-6 py-4">
                  <h4 className="text-lg font-medium text-gray-900">{room}</h4>
                  <p className="text-sm text-gray-500">{roomAssets.length} assets</p>
                </div>
                <div className="divide-y">
                  {roomAssets.map((asset) => (
                    <Link
                      key={asset.id}
                      href={`/dashboard/properties/${property.id}/assets/${asset.id}`}
                      className="flex items-center justify-between px-6 py-4 hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-2xl">
                          {CATEGORY_ICONS[asset.category] || '📦'}
                        </span>
                        <div>
                          <p className="font-medium text-gray-900">{asset.name}</p>
                          <p className="text-sm text-gray-500">
                            {asset.brand && `${asset.brand} `}
                            {asset.model && `${asset.model}`}
                            {!asset.brand && !asset.model && asset.category}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {asset.maintenance_required && (
                          <span className="inline-flex rounded-full bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-800">
                            Maintenance
                          </span>
                        )}
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                            CONDITION_COLORS[asset.condition] || 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {asset.condition}
                        </span>
                        {asset.photo_count > 0 && (
                          <span className="text-sm text-gray-500">
                            {asset.photo_count} photo{asset.photo_count !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
