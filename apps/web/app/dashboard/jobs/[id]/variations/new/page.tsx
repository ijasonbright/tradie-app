'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface LineItem {
  itemType: string
  description: string
  quantity: string
  unitPrice: string
}

export default function NewVariationPage() {
  const params = useParams()
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    title: '',
    description: '',
  })

  const [lineItems, setLineItems] = useState<LineItem[]>([
    { itemType: 'labor', description: '', quantity: '1', unitPrice: '0' },
  ])

  const addLineItem = () => {
    setLineItems([...lineItems, { itemType: 'labor', description: '', quantity: '1', unitPrice: '0' }])
  }

  const removeLineItem = (index: number) => {
    if (lineItems.length === 1) return // Keep at least one
    setLineItems(lineItems.filter((_, i) => i !== index))
  }

  const updateLineItem = (index: number, field: keyof LineItem, value: string) => {
    const updated = [...lineItems]
    updated[index] = { ...updated[index], [field]: value }
    setLineItems(updated)
  }

  const calculateLineTotal = (item: LineItem) => {
    const qty = parseFloat(item.quantity) || 0
    const price = parseFloat(item.unitPrice) || 0
    return qty * price
  }

  const calculateSubtotal = () => {
    return lineItems.reduce((sum, item) => sum + calculateLineTotal(item), 0)
  }

  const calculateGST = () => {
    return calculateSubtotal() * 0.1
  }

  const calculateTotal = () => {
    return calculateSubtotal() + calculateGST()
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(amount)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const res = await fetch(`/api/jobs/${params.id}/variations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          lineItems: lineItems,
        }),
      })

      if (res.ok) {
        router.push(`/dashboard/jobs/${params.id}?tab=variations`)
      } else {
        const error = await res.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error creating variation:', error)
      alert('Failed to create variation')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link href={`/dashboard/jobs/${params.id}`} className="text-blue-600 hover:text-blue-800">
          ← Back to Job
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Create Quote Variation</h1>

        <form onSubmit={handleSubmit}>
          {/* Title */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Variation Title *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              placeholder="e.g., Additional electrical outlets in kitchen"
            />
          </div>

          {/* Description */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              rows={3}
              placeholder="Additional details about this variation..."
            />
          </div>

          {/* Line Items */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Line Items *
              </label>
              <button
                type="button"
                onClick={addLineItem}
                className="px-3 py-1 bg-purple-100 text-purple-700 rounded text-sm font-medium hover:bg-purple-200"
              >
                + Add Line
              </button>
            </div>

            <div className="space-y-4">
              {lineItems.map((item, index) => (
                <div key={index} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Item Type */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Type *
                        </label>
                        <select
                          required
                          value={item.itemType}
                          onChange={(e) => updateLineItem(index, 'itemType', e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                        >
                          <option value="labor">Labor</option>
                          <option value="material">Material</option>
                          <option value="equipment">Equipment</option>
                          <option value="other">Other</option>
                        </select>
                      </div>

                      {/* Description */}
                      <div className="md:col-span-1">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Description *
                        </label>
                        <input
                          type="text"
                          required
                          value={item.description}
                          onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                          placeholder="Item description"
                        />
                      </div>

                      {/* Quantity */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Quantity *
                        </label>
                        <input
                          type="number"
                          required
                          min="0"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(index, 'quantity', e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                        />
                      </div>

                      {/* Unit Price */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Unit Price *
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-gray-500 text-sm">$</span>
                          <input
                            type="number"
                            required
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => updateLineItem(index, 'unitPrice', e.target.value)}
                            className="w-full rounded-md border border-gray-300 pl-7 pr-3 py-2 text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Line Total & Remove */}
                    <div className="text-right">
                      <p className="text-xs text-gray-600 mb-1">Line Total</p>
                      <p className="text-lg font-bold text-gray-900 mb-2">
                        {formatCurrency(calculateLineTotal(item))}
                      </p>
                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLineItem(index)}
                          className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals Summary */}
          <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Subtotal:</span>
                <span className="font-medium">{formatCurrency(calculateSubtotal())}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">GST (10%):</span>
                <span className="font-medium">{formatCurrency(calculateGST())}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t border-purple-300 pt-2">
                <span className="text-purple-900">Total:</span>
                <span className="text-purple-900">{formatCurrency(calculateTotal())}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Link
              href={`/dashboard/jobs/${params.id}`}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-semibold text-center"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating...' : 'Create Variation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
