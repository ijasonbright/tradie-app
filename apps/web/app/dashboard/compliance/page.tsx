'use client'

import { useEffect, useState } from 'react'
import DocumentUpload from '@/components/DocumentUpload'

interface Document {
  id: string
  document_type: string
  document_category: string
  title: string
  document_number: string | null
  file_url: string
  expiry_date: string | null
  issue_date: string | null
  issuing_authority: string | null
  ai_verification_status: string | null
  ai_verification_notes: string | null
  ai_extracted_expiry_date: string | null
  created_at: string
  updated_at: string
}

export default function CompliancePage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadType, setUploadType] = useState({ type: '', category: '', title: '' })

  useEffect(() => {
    fetchDocuments()
  }, [])

  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/documents')
      const data = await res.json()
      setDocuments(data.documents || [])
    } catch (error) {
      console.error('Error fetching documents:', error)
    } finally {
      setLoading(false)
    }
  }

  const getExpiryStatus = (expiryDate: string | null) => {
    if (!expiryDate) return { status: 'no_date', color: 'gray', label: 'No expiry date' }

    const today = new Date()
    const expiry = new Date(expiryDate)
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    if (daysUntilExpiry < 0) {
      return { status: 'expired', color: 'red', label: 'Expired' }
    } else if (daysUntilExpiry <= 30) {
      return { status: 'expiring_soon', color: 'yellow', label: 'Expiring soon' }
    } else if (daysUntilExpiry <= 90) {
      return { status: 'warning', color: 'orange', label: 'Expiring in 90 days' }
    } else {
      return { status: 'valid', color: 'green', label: 'Valid' }
    }
  }

  const getVerificationBadge = (doc: Document) => {
    if (!doc.ai_verification_status) return null

    const statusConfig: Record<string, { color: string; label: string }> = {
      verified: { color: 'green', label: '✓ AI Verified' },
      mismatch: { color: 'yellow', label: '⚠ Date Mismatch' },
      no_date_found: { color: 'gray', label: 'No date found' },
      error: { color: 'red', label: 'Verification error' },
      pending: { color: 'blue', label: 'Verifying...' },
    }

    const config = statusConfig[doc.ai_verification_status] || statusConfig.error

    return (
      <span className={`inline-flex items-center rounded-full bg-${config.color}-100 px-2 py-1 text-xs font-medium text-${config.color}-800`}>
        {config.label}
      </span>
    )
  }

  const documentTypes = [
    { type: 'trade_license', category: 'license', title: 'Trade License' },
    { type: 'drivers_license', category: 'license', title: "Driver's License" },
    { type: 'police_check', category: 'certification', title: 'Police Check' },
    { type: 'working_with_children', category: 'certification', title: 'Working with Children' },
    { type: 'public_liability', category: 'insurance', title: 'Public Liability Insurance' },
    { type: 'workers_comp', category: 'insurance', title: 'Workers Compensation' },
    { type: 'professional_indemnity', category: 'insurance', title: 'Professional Indemnity' },
    { type: 'white_card', category: 'certification', title: 'White Card' },
    { type: 'other', category: 'other', title: 'Other Document' },
  ]

  const stats = {
    total: documents.length,
    expired: documents.filter(d => getExpiryStatus(d.expiry_date).status === 'expired').length,
    expiring_soon: documents.filter(d => ['expiring_soon', 'warning'].includes(getExpiryStatus(d.expiry_date).status)).length,
    valid: documents.filter(d => getExpiryStatus(d.expiry_date).status === 'valid').length,
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading documents...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Compliance Documents</h1>
          <p className="mt-2 text-gray-600">
            Manage your licenses, certifications, and insurance documents
          </p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
        >
          + Upload Document
        </button>
      </div>

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-600">Total Documents</div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="text-2xl font-bold text-green-600">{stats.valid}</div>
          <div className="text-sm text-gray-600">Valid</div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="text-2xl font-bold text-yellow-600">{stats.expiring_soon}</div>
          <div className="text-sm text-gray-600">Expiring Soon</div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="text-2xl font-bold text-red-600">{stats.expired}</div>
          <div className="text-sm text-gray-600">Expired</div>
        </div>
      </div>

      {/* Documents List */}
      {documents.length === 0 ? (
        <div className="rounded-lg bg-white p-12 text-center shadow">
          <div className="mb-4 text-6xl">📄</div>
          <h3 className="mb-2 text-xl font-semibold">No documents uploaded yet</h3>
          <p className="mb-6 text-gray-600">Upload your first compliance document to get started</p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
          >
            Upload Document
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => {
            const expiryStatus = getExpiryStatus(doc.expiry_date)
            return (
              <div key={doc.id} className="rounded-lg bg-white p-6 shadow">
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{doc.title}</h3>
                    <p className="text-sm text-gray-600">{doc.document_type.replace('_', ' ')}</p>
                  </div>
                  <span className={`rounded-full bg-${expiryStatus.color}-100 px-3 py-1 text-xs font-medium text-${expiryStatus.color}-800`}>
                    {expiryStatus.label}
                  </span>
                </div>

                {doc.document_number && (
                  <p className="mb-2 text-sm">
                    <span className="font-medium">Number:</span> {doc.document_number}
                  </p>
                )}

                {doc.issue_date && (
                  <p className="mb-2 text-sm">
                    <span className="font-medium">Issued:</span>{' '}
                    {new Date(doc.issue_date).toLocaleDateString()}
                  </p>
                )}

                {doc.expiry_date && (
                  <p className="mb-2 text-sm">
                    <span className="font-medium">Expires:</span>{' '}
                    {new Date(doc.expiry_date).toLocaleDateString()}
                  </p>
                )}

                {doc.issuing_authority && (
                  <p className="mb-2 text-sm">
                    <span className="font-medium">Authority:</span> {doc.issuing_authority}
                  </p>
                )}

                {getVerificationBadge(doc)}

                {doc.ai_verification_notes && (
                  <p className="mt-2 text-xs text-gray-600">{doc.ai_verification_notes}</p>
                )}

                <div className="mt-4 flex gap-2">
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 rounded bg-blue-600 px-3 py-2 text-center text-sm text-white hover:bg-blue-700"
                  >
                    View
                  </a>
                  <button className="flex-1 rounded border px-3 py-2 text-sm hover:bg-gray-50">
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Upload Document</h2>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {!uploadType.type ? (
              <div>
                <h3 className="mb-4 text-lg font-semibold">Select Document Type</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  {documentTypes.map((docType) => (
                    <button
                      key={docType.type}
                      onClick={() => setUploadType(docType)}
                      className="rounded-lg border p-4 text-left hover:border-blue-600 hover:bg-blue-50"
                    >
                      <h4 className="font-semibold">{docType.title}</h4>
                      <p className="text-sm text-gray-600">{docType.category}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <button
                  onClick={() => setUploadType({ type: '', category: '', title: '' })}
                  className="mb-4 text-sm text-blue-600 hover:underline"
                >
                  ← Change document type
                </button>
                <DocumentUpload
                  documentType={uploadType.type}
                  documentCategory={uploadType.category}
                  title={uploadType.title}
                  onUploadComplete={() => {
                    setShowUploadModal(false)
                    setUploadType({ type: '', category: '', title: '' })
                    fetchDocuments()
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
