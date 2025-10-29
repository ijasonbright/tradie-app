'use client'

import { useState } from 'react'

interface DocumentUploadProps {
  documentType: string
  documentCategory: string
  title: string
  required?: boolean
  onUploadComplete?: (documentId: string) => void
}

export default function DocumentUpload({
  documentType,
  documentCategory,
  title,
  required = false,
  onUploadComplete,
}: DocumentUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState(false)
  const [error, setError] = useState('')
  const [documentNumber, setDocumentNumber] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [issueDate, setIssueDate] = useState('')
  const [aiVerifying, setAiVerifying] = useState(false)
  const [aiResult, setAiResult] = useState<any>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setError('')
      setUploaded(false)
      setAiResult(null)
    }
  }

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file')
      return
    }

    setUploading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('documentType', documentType)
      formData.append('documentCategory', documentCategory)
      formData.append('title', title)
      formData.append('documentNumber', documentNumber)
      formData.append('expiryDate', expiryDate)
      formData.append('issueDate', issueDate)
      formData.append('enableAIVerification', 'true')

      const res = await fetch('/api/docs/upload', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        const data = await res.json()
        setUploaded(true)
        setAiVerifying(true)

        // Poll for AI verification result
        if (expiryDate) {
          pollForAiResult(data.document.id)
        }

        if (onUploadComplete) {
          onUploadComplete(data.document.id)
        }
      } else {
        const errorData = await res.json()
        setError(errorData.error || 'Upload failed')
      }
    } catch (err) {
      console.error('Upload error:', err)
      setError('Failed to upload document')
    } finally {
      setUploading(false)
    }
  }

  const pollForAiResult = async (documentId: string) => {
    let attempts = 0
    const maxAttempts = 20 // 20 seconds max

    const poll = setInterval(async () => {
      attempts++

      try {
        const res = await fetch(`/api/documents/${documentId}`)
        if (res.ok) {
          const data = await res.json()
          if (data.document.ai_verification_status && data.document.ai_verification_status !== 'pending') {
            setAiResult({
              status: data.document.ai_verification_status,
              notes: data.document.ai_verification_notes,
              extractedDate: data.document.ai_extracted_expiry_date,
            })
            setAiVerifying(false)
            clearInterval(poll)
          }
        }
      } catch (err) {
        console.error('Polling error:', err)
      }

      if (attempts >= maxAttempts) {
        setAiVerifying(false)
        clearInterval(poll)
      }
    }, 1000)
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        {required && <span className="text-sm text-red-600">Required</span>}
        {uploaded && <span className="text-sm text-green-600">✓ Uploaded</span>}
      </div>

      {!uploaded ? (
        <div className="space-y-4">
          {/* File Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Upload File</label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileChange}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
            {file && (
              <p className="mt-1 text-sm text-gray-600">Selected: {file.name}</p>
            )}
          </div>

          {/* Document Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Document/License Number</label>
            <input
              type="text"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              placeholder="e.g., ABC123456"
            />
          </div>

          {/* Issue Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Issue Date</label>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </div>

          {/* Expiry Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Expiry Date</label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
            <p className="mt-1 text-xs text-gray-500">
              AI will verify this date matches your document
            </p>
          </div>

          {error && (
            <div className="rounded bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Upload Document'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded bg-green-50 p-3">
            <p className="text-sm text-green-800">✓ Document uploaded successfully</p>
          </div>

          {aiVerifying && (
            <div className="rounded bg-blue-50 p-3">
              <p className="text-sm text-blue-800">🤖 AI is verifying the expiry date...</p>
            </div>
          )}

          {aiResult && (
            <div className={`rounded p-3 ${
              aiResult.status === 'verified' ? 'bg-green-50' :
              aiResult.status === 'mismatch' ? 'bg-yellow-50' :
              'bg-gray-50'
            }`}>
              <p className={`text-sm font-medium ${
                aiResult.status === 'verified' ? 'text-green-800' :
                aiResult.status === 'mismatch' ? 'text-yellow-800' :
                'text-gray-800'
              }`}>
                {aiResult.notes}
              </p>
              {aiResult.extractedDate && (
                <p className="mt-1 text-xs text-gray-600">
                  AI extracted date: {aiResult.extractedDate}
                </p>
              )}
            </div>
          )}

          <button
            onClick={() => {
              setUploaded(false)
              setFile(null)
              setDocumentNumber('')
              setExpiryDate('')
              setIssueDate('')
              setAiResult(null)
            }}
            className="text-sm text-blue-600 hover:underline"
          >
            Upload a different file
          </button>
        </div>
      )}
    </div>
  )
}
