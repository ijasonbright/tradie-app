'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Organization {
  id: string
  name: string
  abn: string | null
  trade_type: string | null
  phone: string | null
  email: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  postcode: string | null
  bank_name: string | null
  bank_bsb: string | null
  bank_account_number: string | null
  bank_account_name: string | null
  default_hourly_rate: string | null
  default_employee_cost: string | null
}

export default function SettingsPage() {
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'business' | 'rates' | 'banking'>('business')

  const [formData, setFormData] = useState({
    name: '',
    abn: '',
    tradeType: '',
    phone: '',
    email: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postcode: '',
    bankName: '',
    bankBsb: '',
    bankAccountNumber: '',
    bankAccountName: '',
    defaultHourlyRate: '',
    defaultEmployeeCost: '',
  })

  useEffect(() => {
    fetchOrganization()
  }, [])

  const fetchOrganization = async () => {
    try {
      const res = await fetch('/api/settings/organization')
      if (res.ok) {
        const data = await res.json()
        setOrganization(data.organization)

        // Pre-fill form
        setFormData({
          name: data.organization.name || '',
          abn: data.organization.abn || '',
          tradeType: data.organization.trade_type || '',
          phone: data.organization.phone || '',
          email: data.organization.email || '',
          addressLine1: data.organization.address_line1 || '',
          addressLine2: data.organization.address_line2 || '',
          city: data.organization.city || '',
          state: data.organization.state || '',
          postcode: data.organization.postcode || '',
          bankName: data.organization.bank_name || '',
          bankBsb: data.organization.bank_bsb || '',
          bankAccountNumber: data.organization.bank_account_number || '',
          bankAccountName: data.organization.bank_account_name || '',
          defaultHourlyRate: data.organization.default_hourly_rate || '0',
          defaultEmployeeCost: data.organization.default_employee_cost || '0',
        })
      }
    } catch (error) {
      console.error('Error fetching organization:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const res = await fetch('/api/settings/organization', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        alert('Settings saved successfully!')
        fetchOrganization()
      } else {
        const error = await res.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error saving settings:', error)
      alert('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const calculateMargin = () => {
    const billing = parseFloat(formData.defaultHourlyRate) || 0
    const cost = parseFloat(formData.defaultEmployeeCost) || 0
    if (cost === 0) return 0
    return (((billing - cost) / cost) * 100).toFixed(1)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading settings...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Organization Settings</h1>
        <p className="mt-1 text-gray-600">Manage your business information and pricing</p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('business')}
            className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium ${
              activeTab === 'business'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Business Information
          </button>
          <button
            onClick={() => setActiveTab('rates')}
            className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium ${
              activeTab === 'rates'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Rates & Pricing
          </button>
          <button
            onClick={() => setActiveTab('banking')}
            className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium ${
              activeTab === 'banking'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Banking Details
          </button>
        </nav>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Business Information Tab */}
        {activeTab === 'business' && (
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-6 text-xl font-semibold">Business Information</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Business Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">ABN</label>
                  <input
                    type="text"
                    value={formData.abn}
                    onChange={(e) => setFormData({ ...formData, abn: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                    placeholder="12 345 678 901"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Trade Type</label>
                  <input
                    type="text"
                    value={formData.tradeType}
                    onChange={(e) => setFormData({ ...formData, tradeType: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                    placeholder="e.g., Plumbing, Electrical"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Address Line 1</label>
                <input
                  type="text"
                  value={formData.addressLine1}
                  onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Address Line 2</label>
                <input
                  type="text"
                  value={formData.addressLine2}
                  onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">State</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                    placeholder="e.g., NSW"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Postcode</label>
                  <input
                    type="text"
                    value={formData.postcode}
                    onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Rates & Pricing Tab */}
        {activeTab === 'rates' && (
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-6 text-xl font-semibold">Rates & Pricing</h2>

            <div className="mb-6 rounded-lg bg-blue-50 p-4">
              <h3 className="mb-2 text-sm font-semibold text-blue-900">How Rates Work</h3>
              <ul className="space-y-1 text-sm text-blue-800">
                <li>• <strong>Client Billing Rate:</strong> What you charge customers per hour</li>
                <li>• <strong>Employee Cost Rate:</strong> What you pay employees per hour</li>
                <li>• <strong>Profit Margin:</strong> Difference between billing and cost</li>
                <li>• You can override these defaults per team member</li>
              </ul>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Default Client Billing Rate ($/hour)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.defaultHourlyRate}
                  onChange={(e) => setFormData({ ...formData, defaultHourlyRate: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  placeholder="0.00"
                />
                <p className="mt-1 text-xs text-gray-500">
                  The rate you charge clients for labor (shown on invoices)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Default Employee Cost Rate ($/hour)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.defaultEmployeeCost}
                  onChange={(e) => setFormData({ ...formData, defaultEmployeeCost: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  placeholder="0.00"
                />
                <p className="mt-1 text-xs text-gray-500">
                  The rate you pay employees (for internal cost tracking)
                </p>
              </div>

              {/* Profit Margin Calculation */}
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Profit Margin</p>
                    <p className="text-xs text-gray-500">Based on rates above</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-600">{calculateMargin()}%</p>
                    <p className="text-xs text-gray-500">
                      ${(parseFloat(formData.defaultHourlyRate) - parseFloat(formData.defaultEmployeeCost)).toFixed(2)} per hour
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Banking Details Tab */}
        {activeTab === 'banking' && (
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-6 text-xl font-semibold">Banking Details</h2>
            <p className="mb-6 text-sm text-gray-600">
              These details will appear on invoices for customers to make payments
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Bank Name</label>
                <input
                  type="text"
                  value={formData.bankName}
                  onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  placeholder="e.g., Commonwealth Bank"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">BSB</label>
                  <input
                    type="text"
                    value={formData.bankBsb}
                    onChange={(e) => setFormData({ ...formData, bankBsb: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                    placeholder="123-456"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Account Number</label>
                  <input
                    type="text"
                    value={formData.bankAccountNumber}
                    onChange={(e) => setFormData({ ...formData, bankAccountNumber: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                    placeholder="12345678"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Account Name</label>
                <input
                  type="text"
                  value={formData.bankAccountName}
                  onChange={(e) => setFormData({ ...formData, bankAccountName: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  placeholder="Business Account Name"
                />
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:bg-blue-300"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          <Link
            href="/dashboard"
            className="rounded bg-gray-200 px-6 py-2 text-gray-700 hover:bg-gray-300"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
