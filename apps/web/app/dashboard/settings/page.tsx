'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { STANDARD_TRADE_TYPES, getStandardTradeType } from '@/../../packages/database/schema/standard-trade-types'

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
  sms_phone_number: string | null
}

interface TradeType {
  id: string
  job_type_id: number
  name: string
  // Client billing rates
  client_hourly_rate: string
  client_first_hour_rate: string | null
  client_callout_fee: string
  client_after_hours_callout_fee: string
  client_after_hours_extra_percent: string
  // Employee/Contractor costs
  default_employee_hourly_rate: string
  default_employee_daily_rate: string | null
  // Deprecated fields
  client_daily_rate: string | null
  default_employee_cost: string
  is_active: boolean
}

export default function SettingsPage() {
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'business' | 'branding' | 'trades' | 'banking'>('business')

  // Trade Types state
  const [tradeTypes, setTradeTypes] = useState<TradeType[]>([])
  const [loadingTrades, setLoadingTrades] = useState(false)
  const [showAddTrade, setShowAddTrade] = useState(false)
  const [editingTrade, setEditingTrade] = useState<TradeType | null>(null)
  const [tradeForm, setTradeForm] = useState({
    jobTypeId: 0,
    name: '',
    clientHourlyRate: '',
    clientFirstHourRate: '',
    clientCalloutFee: '',
    clientAfterHoursCalloutFee: '',
    clientAfterHoursExtraPercent: '',
    defaultEmployeeHourlyRate: '',
    defaultEmployeeDailyRate: '',
  })

  // Branding state
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [primaryColor, setPrimaryColor] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)

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
    smsPhoneNumber: '',
  })

  useEffect(() => {
    const loadData = async () => {
      await fetchOrganization()
      await fetchTradeTypes()
    }
    loadData()
  }, [])

  const fetchOrganization = async () => {
    try {
      const res = await fetch('/api/settings/organization')
      if (res.ok) {
        const data = await res.json()
        setOrganization(data.organization)

        // Load branding
        setLogoUrl(data.organization.logo_url || null)
        setPrimaryColor(data.organization.primary_color || null)

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
          smsPhoneNumber: data.organization.sms_phone_number || '',
        })
      }
    } catch (error) {
      console.error('Error fetching organization:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTradeTypes = async () => {
    setLoadingTrades(true)
    try {
      const res = await fetch('/api/settings/trade-types')
      if (res.ok) {
        const data = await res.json()
        setTradeTypes(data.tradeTypes)
      }
    } catch (error) {
      console.error('Error fetching trade types:', error)
    } finally {
      setLoadingTrades(false)
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

  const handleAddTrade = () => {
    setTradeForm({
      jobTypeId: 0,
      name: '',
      clientHourlyRate: '',
      clientFirstHourRate: '',
      clientCalloutFee: '',
      clientAfterHoursCalloutFee: '',
      clientAfterHoursExtraPercent: '',
      defaultEmployeeHourlyRate: '',
      defaultEmployeeDailyRate: '',
    })
    setEditingTrade(null)
    setShowAddTrade(true)
  }

  const handleEditTrade = (trade: TradeType) => {
    setTradeForm({
      jobTypeId: trade.job_type_id,
      name: trade.name,
      clientHourlyRate: trade.client_hourly_rate,
      clientFirstHourRate: trade.client_first_hour_rate || '',
      clientCalloutFee: trade.client_callout_fee,
      clientAfterHoursCalloutFee: trade.client_after_hours_callout_fee,
      clientAfterHoursExtraPercent: trade.client_after_hours_extra_percent,
      defaultEmployeeHourlyRate: trade.default_employee_hourly_rate,
      defaultEmployeeDailyRate: trade.default_employee_daily_rate || '',
    })
    setEditingTrade(trade)
    setShowAddTrade(true)
  }

  // Handle trade type selection from dropdown
  const handleTradeTypeSelect = (jobTypeId: number) => {
    const standardTrade = getStandardTradeType(jobTypeId)
    if (standardTrade) {
      setTradeForm({
        jobTypeId: standardTrade.jobTypeId,
        name: standardTrade.name,
        clientHourlyRate: standardTrade.clientHourlyRate.toString(),
        clientFirstHourRate: standardTrade.clientFirstHourRate?.toString() || '',
        clientCalloutFee: standardTrade.clientCalloutFee.toString(),
        clientAfterHoursCalloutFee: standardTrade.clientAfterHoursCalloutFee.toString(),
        clientAfterHoursExtraPercent: standardTrade.clientAfterHoursExtraPercent.toString(),
        defaultEmployeeHourlyRate: standardTrade.defaultEmployeeHourlyRate.toString(),
        defaultEmployeeDailyRate: standardTrade.defaultEmployeeDailyRate?.toString() || '',
      })
    }
  }

  // Get available trade types (not already added)
  const getAvailableTradeTypes = () => {
    const existingJobTypeIds = tradeTypes.map(t => t.job_type_id)
    return STANDARD_TRADE_TYPES.filter(t => !existingJobTypeIds.includes(t.jobTypeId))
  }

  const handleSaveTrade = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const url = editingTrade
        ? `/api/settings/trade-types/${editingTrade.id}`
        : '/api/settings/trade-types'

      const res = await fetch(url, {
        method: editingTrade ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tradeForm),
      })

      if (res.ok) {
        alert(editingTrade ? 'Trade updated!' : 'Trade added!')
        setShowAddTrade(false)
        fetchTradeTypes()
      } else {
        const error = await res.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error saving trade:', error)
      alert('Failed to save trade')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (trade: TradeType) => {
    if (!confirm(`${trade.is_active ? 'Deactivate' : 'Activate'} ${trade.name}?`)) return

    try {
      const res = await fetch(`/api/settings/trade-types/${trade.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !trade.is_active }),
      })

      if (res.ok) {
        fetchTradeTypes()
      } else {
        const error = await res.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error toggling trade:', error)
      alert('Failed to update trade')
    }
  }

  const calculateTradeMargin = (clientRate: string, employeeCost: string) => {
    const billing = parseFloat(clientRate) || 0
    const cost = parseFloat(employeeCost) || 0
    if (billing === 0) return 0
    if (cost === 0) return 100
    return (((billing - cost) / billing) * 100).toFixed(1)
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Organization Settings</h1>
            <p className="mt-1 text-gray-600">Manage your business information and pricing</p>
          </div>
          <Link
            href="/dashboard/settings/branding"
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
            Logo & Branding
          </Link>
        </div>
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
            onClick={() => setActiveTab('trades')}
            className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium ${
              activeTab === 'trades'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Trade Types & Rates
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

      {/* Business Information Tab */}
      {activeTab === 'business' && (
        <form onSubmit={handleSubmit} className="space-y-6">
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
                  <label className="block text-sm font-medium text-gray-700">Primary Trade</label>
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
                <label className="block text-sm font-medium text-gray-700">SMS Phone Number (Tall Bob)</label>
                <input
                  type="tel"
                  value={formData.smsPhoneNumber}
                  onChange={(e) => setFormData({ ...formData, smsPhoneNumber: e.target.value })}
                  placeholder="+61412345678"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
                <p className="mt-1 text-xs text-gray-500">
                  The phone number provisioned from Tall Bob for sending SMS. Include country code (e.g., +61 for Australia).
                </p>
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
      )}

      {/* Trade Types & Rates Tab */}
      {activeTab === 'trades' && (
        <div className="space-y-6">
          <div className="rounded-lg bg-white p-6 shadow">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Trade Types & Rates</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Set billing rates and default employee costs per trade type
                </p>
              </div>
              <button
                onClick={handleAddTrade}
                className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                + Add Trade Type
              </button>
            </div>

            <div className="mb-6 rounded-lg bg-blue-50 p-4">
              <h3 className="mb-2 text-sm font-semibold text-blue-900">How Trade-Based Pricing Works</h3>
              <ul className="space-y-1 text-sm text-blue-800">
                <li>• Each trade type has its own client billing rate (what you charge)</li>
                <li>• Set a default employee cost per trade (what you typically pay)</li>
                <li>• Jobs are assigned to trade types for accurate costing</li>
                <li>• Team members can have individual rate overrides</li>
                <li>• Profit margins are calculated per trade type</li>
              </ul>
            </div>

            {loadingTrades ? (
              <p className="text-center text-gray-500">Loading trade types...</p>
            ) : tradeTypes.length === 0 ? (
              <p className="text-center text-gray-500">No trade types yet. Add your first trade type above.</p>
            ) : (
              <div className="space-y-4">
                {tradeTypes.map((trade) => (
                  <div
                    key={trade.id}
                    className={`rounded-lg border p-4 ${
                      trade.is_active ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-50 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="mb-3 flex items-center gap-3">
                          <h3 className="text-lg font-semibold">{trade.name}</h3>
                          <span className="rounded bg-blue-100 px-2 py-1 text-xs font-mono text-blue-700">
                            ID: {trade.job_type_id}
                          </span>
                          {!trade.is_active && (
                            <span className="rounded bg-gray-200 px-2 py-1 text-xs text-gray-600">
                              Inactive
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-xs text-gray-500">Hourly Rate</p>
                            <p className="font-semibold text-gray-900">
                              ${parseFloat(trade.client_hourly_rate).toFixed(2)}/hr
                            </p>
                          </div>
                          {trade.client_first_hour_rate && (
                            <div>
                              <p className="text-xs text-gray-500">First Hour</p>
                              <p className="font-semibold text-gray-900">
                                ${parseFloat(trade.client_first_hour_rate).toFixed(2)}
                              </p>
                            </div>
                          )}
                          <div>
                            <p className="text-xs text-gray-500">Callout Fee</p>
                            <p className="font-semibold text-gray-900">
                              ${parseFloat(trade.client_callout_fee).toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">After Hours</p>
                            <p className="font-semibold text-orange-600">
                              +{parseFloat(trade.client_after_hours_extra_percent).toFixed(0)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Employee Cost/hr</p>
                            <p className="font-semibold text-gray-900">
                              ${parseFloat(trade.default_employee_hourly_rate).toFixed(2)}
                            </p>
                          </div>
                          {trade.default_employee_daily_rate && (
                            <div>
                              <p className="text-xs text-gray-500">Employee Cost/day</p>
                              <p className="font-semibold text-gray-900">
                                ${parseFloat(trade.default_employee_daily_rate).toFixed(2)}
                              </p>
                            </div>
                          )}
                          <div>
                            <p className="text-xs text-gray-500">Profit Margin</p>
                            <p className="font-semibold text-green-600">
                              {calculateTradeMargin(trade.client_hourly_rate, trade.default_employee_hourly_rate)}%
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="ml-4 flex gap-2">
                        <button
                          onClick={() => handleEditTrade(trade)}
                          className="rounded bg-gray-100 px-3 py-1 text-sm text-gray-700 hover:bg-gray-200"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggleActive(trade)}
                          className={`rounded px-3 py-1 text-sm ${
                            trade.is_active
                              ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                        >
                          {trade.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add/Edit Trade Modal */}
          {showAddTrade && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
              <div className="w-full max-w-md rounded-lg bg-white p-6">
                <h3 className="mb-4 text-xl font-semibold">
                  {editingTrade ? 'Edit Trade Type' : 'Add Trade Type'}
                </h3>

                <form onSubmit={handleSaveTrade} className="space-y-4">
                  {!editingTrade && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Select Trade Type *</label>
                      <select
                        required
                        value={tradeForm.jobTypeId}
                        onChange={(e) => handleTradeTypeSelect(parseInt(e.target.value))}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                      >
                        <option value={0}>-- Select a trade type --</option>
                        {getAvailableTradeTypes().map((trade) => (
                          <option key={trade.jobTypeId} value={trade.jobTypeId}>
                            {trade.name} (ID: {trade.jobTypeId})
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-gray-500">
                        Choose from standard trade types. Rates will be pre-filled with defaults.
                      </p>
                    </div>
                  )}

                  {editingTrade && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Trade Type</label>
                      <input
                        type="text"
                        disabled
                        value={`${tradeForm.name} (ID: ${tradeForm.jobTypeId})`}
                        className="mt-1 block w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2"
                      />
                      <p className="mt-1 text-xs text-gray-500">Trade type cannot be changed after creation</p>
                    </div>
                  )}

                  {/* Client Billing Rates Section */}
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <h4 className="mb-3 text-sm font-semibold text-blue-900">Client Billing Rates</h4>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Hourly Rate ($) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          value={tradeForm.clientHourlyRate}
                          onChange={(e) => setTradeForm({ ...tradeForm, clientHourlyRate: e.target.value })}
                          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                          placeholder="0.00"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          First Hour Rate ($)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={tradeForm.clientFirstHourRate}
                          onChange={(e) => setTradeForm({ ...tradeForm, clientFirstHourRate: e.target.value })}
                          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                          placeholder="0.00"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Business Hours Callout ($)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={tradeForm.clientCalloutFee}
                          onChange={(e) => setTradeForm({ ...tradeForm, clientCalloutFee: e.target.value })}
                          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                          placeholder="0.00"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          After Hours Callout ($)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={tradeForm.clientAfterHoursCalloutFee}
                          onChange={(e) => setTradeForm({ ...tradeForm, clientAfterHoursCalloutFee: e.target.value })}
                          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                          placeholder="0.00"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700">
                          After Hours Extra (%)
                        </label>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          max="200"
                          value={tradeForm.clientAfterHoursExtraPercent}
                          onChange={(e) => setTradeForm({ ...tradeForm, clientAfterHoursExtraPercent: e.target.value })}
                          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                          placeholder="50"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Extra percentage added to hourly rate for after hours work
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Employee/Contractor Costs Section */}
                  <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                    <h4 className="mb-3 text-sm font-semibold text-green-900">Employee/Contractor Default Costs</h4>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Hourly Cost ($)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={tradeForm.defaultEmployeeHourlyRate}
                          onChange={(e) => setTradeForm({ ...tradeForm, defaultEmployeeHourlyRate: e.target.value })}
                          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                          placeholder="0.00"
                        />
                        <p className="mt-1 text-xs text-gray-500">What you pay per hour</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Daily Cost ($)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={tradeForm.defaultEmployeeDailyRate}
                          onChange={(e) => setTradeForm({ ...tradeForm, defaultEmployeeDailyRate: e.target.value })}
                          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                          placeholder="0.00"
                        />
                        <p className="mt-1 text-xs text-gray-500">What you pay per day</p>
                      </div>
                    </div>
                  </div>

                  {/* Margin Preview */}
                  {tradeForm.clientHourlyRate && tradeForm.defaultEmployeeHourlyRate && (
                    <div className="rounded-lg bg-gray-50 p-3">
                      <p className="text-sm text-gray-600">Profit Margin Preview:</p>
                      <p className="text-xl font-bold text-green-600">
                        {calculateTradeMargin(tradeForm.clientHourlyRate, tradeForm.defaultEmployeeHourlyRate)}%
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        ${(parseFloat(tradeForm.clientHourlyRate) - parseFloat(tradeForm.defaultEmployeeHourlyRate)).toFixed(2)} profit per hour
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-4">
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-blue-300"
                    >
                      {saving ? 'Saving...' : editingTrade ? 'Update Trade' : 'Add Trade'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddTrade(false)}
                      className="rounded bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Banking Details Tab */}
      {activeTab === 'banking' && (
        <form onSubmit={handleSubmit} className="space-y-6">
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
      )}
    </div>
  )
}
