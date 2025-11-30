'use client'

import { useEffect, useState } from 'react'
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
  asset_count: number
  synced_at: string | null
  created_at: string
}

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('')

  useEffect(() => {
    fetchProperties()
  }, [])

  const fetchProperties = async () => {
    try {
      const res = await fetch('/api/properties')
      const data = await res.json()
      setProperties(data.properties || [])
    } catch (error) {
      console.error('Error fetching properties:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredProperties = properties.filter((property) => {
    const searchLower = searchTerm.toLowerCase()
    const address = formatAddress(property)
    const matchesSearch =
      address.toLowerCase().includes(searchLower) ||
      property.owner_name?.toLowerCase().includes(searchLower) ||
      property.tenant_name?.toLowerCase().includes(searchLower) ||
      property.owner_email?.toLowerCase().includes(searchLower) ||
      property.tenant_email?.toLowerCase().includes(searchLower)

    const matchesType = !filterType || property.property_type === filterType

    return matchesSearch && matchesType
  })

  const formatAddress = (property: Property) => {
    const parts = [
      property.address_street,
      property.address_suburb,
      property.address_state,
      property.address_postcode,
    ].filter(Boolean)
    return parts.length > 0 ? parts.join(', ') : 'No address'
  }

  const uniquePropertyTypes = Array.from(
    new Set(properties.map((p) => p.property_type).filter(Boolean))
  )

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Properties</h2>
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row">
        <input
          type="text"
          placeholder="Search by address, owner, or tenant..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 rounded-md border border-gray-300 px-4 py-2"
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-md border border-gray-300 px-4 py-2"
        >
          <option value="">All Types</option>
          {uniquePropertyTypes.map((type) => (
            <option key={type} value={type!}>
              {type}
            </option>
          ))}
        </select>
      </div>

      {filteredProperties.length === 0 ? (
        <div className="rounded-lg bg-white p-12 text-center shadow">
          <h3 className="text-lg font-medium text-gray-900">
            {searchTerm || filterType ? 'No properties found' : 'No properties yet'}
          </h3>
          <p className="mt-2 text-sm text-gray-600">
            {searchTerm || filterType
              ? 'Try adjusting your search or filter'
              : 'Properties will appear here when synced from Property Pal'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProperties.map((property) => (
            <Link
              key={property.id}
              href={`/dashboard/properties/${property.id}`}
              className="block rounded-lg bg-white p-6 shadow hover:shadow-md transition-shadow"
            >
              <div className="mb-2 flex items-start justify-between">
                <h3 className="font-semibold text-gray-900 line-clamp-2">
                  {property.address_street || 'No address'}
                </h3>
                {property.property_type && (
                  <span className="ml-2 inline-flex shrink-0 rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">
                    {property.property_type}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mb-3">
                {property.address_suburb}
                {property.address_suburb && property.address_state ? ', ' : ''}
                {property.address_state} {property.address_postcode}
              </p>

              <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                {property.bedrooms != null && (
                  <span>{property.bedrooms} bed</span>
                )}
                {property.bathrooms != null && (
                  <span>{property.bathrooms} bath</span>
                )}
              </div>

              <div className="flex items-center justify-between border-t pt-3">
                <div className="text-sm">
                  {property.owner_name && (
                    <p className="text-gray-600">
                      <span className="text-gray-500">Owner:</span> {property.owner_name}
                    </p>
                  )}
                  {property.tenant_name && (
                    <p className="text-gray-600">
                      <span className="text-gray-500">Tenant:</span> {property.tenant_name}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1">
                  <span className="text-sm font-medium text-gray-700">
                    {property.asset_count || 0}
                  </span>
                  <span className="text-xs text-gray-500">assets</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-4 text-sm text-gray-500">
        Showing {filteredProperties.length} of {properties.length} properties
      </div>
    </div>
  )
}
