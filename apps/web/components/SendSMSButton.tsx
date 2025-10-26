'use client'

import { useState } from 'react'
import { createInvoiceSMS, createQuoteSMS, renderTemplate } from '@/lib/sms/templates'

interface SendSMSButtonProps {
  type: 'invoice' | 'quote'
  recipientPhone: string
  recipientName: string
  data: {
    number: string
    total: string
    link: string
    title?: string
    validUntil?: string
    dueDate?: string
  }
  onSuccess?: () => void
  className?: string
}

export default function SendSMSButton({
  type,
  recipientPhone,
  recipientName,
  data,
  onSuccess,
  className = '',
}: SendSMSButtonProps) {
  const [showModal, setShowModal] = useState(false)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [businessName, setBusinessName] = useState('Your Business')

  const handleOpenModal = () => {
    // Generate default message
    let defaultMessage = ''

    if (type === 'invoice') {
      defaultMessage = createInvoiceSMS({
        clientName: recipientName,
        businessName,
        invoiceNumber: data.number,
        totalAmount: data.total,
        dueDate: data.dueDate,
        link: data.link,
      })
    } else if (type === 'quote') {
      defaultMessage = createQuoteSMS({
        clientName: recipientName,
        businessName,
        quoteNumber: data.number,
        jobTitle: data.title || 'your project',
        validUntil: data.validUntil || '',
        link: data.link,
      })
    }

    setMessage(defaultMessage)
    setShowModal(true)
  }

  const handleSend = async () => {
    setSending(true)
    try {
      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipientPhone,
          message,
          [type === 'invoice' ? 'invoiceId' : 'quoteId']: data.number,
          smsType: `${type}_sent`,
        }),
      })

      if (res.ok) {
        alert('SMS sent successfully!')
        setShowModal(false)
        if (onSuccess) onSuccess()
      } else {
        const error = await res.json()
        if (res.status === 402) {
          alert(`Insufficient SMS credits. You need ${error.required} credits but only have ${error.available}. Please purchase more credits.`)
        } else {
          alert(error.error || 'Failed to send SMS')
        }
      }
    } catch (error) {
      console.error('Error sending SMS:', error)
      alert('Failed to send SMS')
    } finally {
      setSending(false)
    }
  }

  const calculateCredits = () => {
    return Math.ceil(message.length / 160)
  }

  return (
    <>
      <button
        onClick={handleOpenModal}
        className={className || 'rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700'}
        title="Send SMS"
      >
        📱 Send SMS
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold">
                Send {type === 'invoice' ? 'Invoice' : 'Quote'} via SMS
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">
                Recipient
              </label>
              <div className="mt-1 rounded-lg border bg-gray-50 px-4 py-2">
                <div className="font-semibold">{recipientName}</div>
                <div className="text-sm text-gray-600">{recipientPhone}</div>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">
                Message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="mt-1 w-full rounded-lg border px-4 py-2"
                rows={6}
                placeholder="Type your message..."
              />
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  {message.length} characters • {calculateCredits()} credit
                  {calculateCredits() !== 1 ? 's' : ''} (${(calculateCredits() * 0.05).toFixed(2)})
                </span>
                {message.length > 160 && (
                  <span className="text-yellow-600">
                    ⚠️ Will be sent as {Math.ceil(message.length / 160)} messages
                  </span>
                )}
              </div>
            </div>

            <div className="rounded bg-blue-50 p-4 text-sm text-gray-700">
              <strong>💡 Tip:</strong> Keep messages under 160 characters to use only 1 credit (5¢).
              Links are automatically shortened to save space.
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg border px-6 py-2 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sending || !message.trim()}
                className="rounded-lg bg-green-600 px-6 py-2 text-white hover:bg-green-700 disabled:opacity-50"
              >
                {sending ? 'Sending...' : `Send SMS (${calculateCredits()} credits)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
