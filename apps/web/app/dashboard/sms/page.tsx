'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface Conversation {
  id: string
  phone_number: string
  client_name: string | null
  last_message: string
  last_message_at: string
  unread_count: number
}

interface Message {
  id: string
  direction: 'inbound' | 'outbound'
  message_body: string
  created_at: string
  status: string
  sender_name: string | null
}

interface CreditBundle {
  credits: number
  price: number
  pricePerCredit: number
}

const CREDIT_BUNDLES: CreditBundle[] = [
  { credits: 100, price: 5, pricePerCredit: 0.05 },
  { credits: 500, price: 25, pricePerCredit: 0.05 },
  { credits: 1000, price: 50, pricePerCredit: 0.05 },
  { credits: 5000, price: 250, pricePerCredit: 0.05 },
]

export default function SMSPage() {
  const searchParams = useSearchParams()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [credits, setCredits] = useState(0)
  const [showPurchaseModal, setShowPurchaseModal] = useState(false)
  const [purchasing, setPurchasing] = useState(false)

  useEffect(() => {
    fetchCredits()
    fetchConversations()

    // Check for success/cancelled from Stripe
    if (searchParams.get('success') === 'true') {
      const creditsAdded = searchParams.get('credits')
      alert(`Successfully purchased ${creditsAdded} SMS credits!`)
      fetchCredits()
    } else if (searchParams.get('cancelled') === 'true') {
      alert('Purchase cancelled')
    }
  }, [searchParams])

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation)
      // Poll for new messages every 5 seconds
      const interval = setInterval(() => {
        fetchMessages(selectedConversation)
      }, 5000)
      return () => clearInterval(interval)
    }
  }, [selectedConversation])

  const fetchCredits = async () => {
    try {
      const res = await fetch('/api/sms/balance')
      const data = await res.json()
      setCredits(data.credits || 0)
    } catch (error) {
      console.error('Error fetching credits:', error)
    }
  }

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/sms/conversations')
      const data = await res.json()
      setConversations(data.conversations || [])
    } catch (error) {
      console.error('Error fetching conversations:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMessages = async (conversationId: string) => {
    try {
      const res = await fetch(`/api/sms/conversations/${conversationId}/messages`)
      const data = await res.json()
      setMessages(data.messages || [])
    } catch (error) {
      console.error('Error fetching messages:', error)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !selectedConversation) return

    const conversation = conversations.find(c => c.id === selectedConversation)
    if (!conversation) return

    setSending(true)
    try {
      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: conversation.phone_number,
          message: newMessage,
          smsType: 'manual',
        }),
      })

      if (res.ok) {
        setNewMessage('')
        fetchMessages(selectedConversation)
        fetchConversations()
        fetchCredits()
      } else {
        const error = await res.json()
        if (res.status === 402) {
          alert(`Insufficient SMS credits. You need ${error.required} credits but only have ${error.available}.`)
          setShowPurchaseModal(true)
        } else {
          alert(error.error || 'Failed to send message')
        }
      }
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const handlePurchaseCredits = async (bundleSize: number) => {
    setPurchasing(true)
    try {
      const res = await fetch('/api/sms/purchase-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bundleSize }),
      })

      const data = await res.json()
      if (res.status === 500 && data.error === 'Service not configured') {
        alert('SMS credit purchases are not yet configured. You have been given 2000 free credits to get started!')
        setShowPurchaseModal(false)
        return
      }
      if (data.url) {
        window.location.href = data.url
      } else {
        alert('Failed to create purchase session')
      }
    } catch (error) {
      console.error('Error purchasing credits:', error)
      alert('Failed to purchase credits')
    } finally {
      setPurchasing(false)
    }
  }

  const calculateMessageCost = (message: string) => {
    const credits = Math.ceil(message.length / 160)
    return credits
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading SMS...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">SMS Messages</h1>
          <p className="mt-2 text-gray-600">Send and receive SMS with your clients</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="rounded-lg bg-white px-6 py-3 shadow">
            <div className="text-sm text-gray-600">SMS Credits</div>
            <div className="text-2xl font-bold">{credits.toLocaleString()}</div>
            <div className="text-xs text-gray-500">5¢ per message</div>
          </div>
          <button
            onClick={() => setShowPurchaseModal(true)}
            className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
          >
            Buy Credits
          </button>
        </div>
      </div>

      {/* SMS Interface */}
      <div className="grid grid-cols-3 gap-6">
        {/* Conversations List */}
        <div className="col-span-1 rounded-lg bg-white shadow">
          <div className="border-b p-4">
            <h2 className="font-semibold">Conversations</h2>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>No conversations yet</p>
                <p className="mt-2 text-sm">Send an SMS from an invoice or quote to start</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv.id)}
                  className={`w-full border-b p-4 text-left hover:bg-gray-50 ${
                    selectedConversation === conv.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-semibold">
                        {conv.client_name || conv.phone_number}
                      </div>
                      {conv.client_name && (
                        <div className="text-sm text-gray-600">{conv.phone_number}</div>
                      )}
                      <div className="mt-1 truncate text-sm text-gray-500">
                        {conv.last_message}
                      </div>
                      <div className="mt-1 text-xs text-gray-400">
                        {new Date(conv.last_message_at).toLocaleString()}
                      </div>
                    </div>
                    {conv.unread_count > 0 && (
                      <div className="ml-2 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs text-white">
                        {conv.unread_count}
                      </div>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="col-span-2 rounded-lg bg-white shadow">
          {selectedConversation ? (
            <>
              {/* Messages Area */}
              <div className="flex h-[600px] flex-col">
                <div className="border-b p-4">
                  <h2 className="font-semibold">
                    {conversations.find(c => c.id === selectedConversation)?.client_name ||
                      conversations.find(c => c.id === selectedConversation)?.phone_number}
                  </h2>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`mb-4 flex ${
                        msg.direction === 'outbound' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg px-4 py-2 ${
                          msg.direction === 'outbound'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        <div className="whitespace-pre-wrap">{msg.message_body}</div>
                        <div
                          className={`mt-1 text-xs ${
                            msg.direction === 'outbound' ? 'text-blue-100' : 'text-gray-500'
                          }`}
                        >
                          {new Date(msg.created_at).toLocaleTimeString()}
                          {msg.direction === 'outbound' && ` • ${msg.status}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Message Input */}
                <form onSubmit={handleSendMessage} className="border-t p-4">
                  <div className="flex gap-2">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your message..."
                      className="flex-1 resize-none rounded-lg border px-4 py-2"
                      rows={2}
                    />
                    <button
                      type="submit"
                      disabled={sending || !newMessage.trim()}
                      className="rounded-lg bg-blue-600 px-6 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {sending ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                  {newMessage && (
                    <div className="mt-2 text-sm text-gray-600">
                      {newMessage.length} characters • {calculateMessageCost(newMessage)} credit
                      {calculateMessageCost(newMessage) !== 1 ? 's' : ''}
                    </div>
                  )}
                </form>
              </div>
            </>
          ) : (
            <div className="flex h-[600px] items-center justify-center text-gray-500">
              Select a conversation to view messages
            </div>
          )}
        </div>
      </div>

      {/* Purchase Credits Modal */}
      {showPurchaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Purchase SMS Credits</h2>
              <button
                onClick={() => setShowPurchaseModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="mb-6">
              <p className="text-gray-600">
                Each SMS message costs <strong>5¢</strong> per 160 characters.
                Choose a credit bundle below:
              </p>
              <p className="mt-2 text-sm text-blue-600">
                Note: All new organizations start with 2000 free SMS credits!
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {CREDIT_BUNDLES.map((bundle) => (
                <button
                  key={bundle.credits}
                  onClick={() => handlePurchaseCredits(bundle.credits)}
                  disabled={purchasing}
                  className="rounded-lg border-2 border-gray-200 p-6 text-left hover:border-blue-600 hover:bg-blue-50 disabled:opacity-50"
                >
                  <div className="mb-2 text-3xl font-bold">{bundle.credits.toLocaleString()}</div>
                  <div className="mb-1 text-sm text-gray-600">SMS Credits</div>
                  <div className="text-2xl font-bold text-blue-600">${bundle.price}</div>
                  <div className="mt-2 text-sm text-gray-500">
                    {bundle.pricePerCredit}¢ per credit
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-6 rounded bg-gray-50 p-4 text-sm text-gray-600">
              <strong>Note:</strong> Credits never expire and can be used for any SMS messages
              including invoices, quotes, job updates, and manual messages.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
