'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface TeamMemberCompliance {
  user_id: string
  full_name: string
  email: string
  role: string
  status: string
  documents: {
    id: string
    document_type: string
    title: string
    expiry_date: string | null
    expiry_status: 'valid' | 'warning' | 'expiring_soon' | 'expired' | 'no_date'
    ai_verification_status: string | null
  }[]
  total_documents: number
  expired_count: number
  expiring_soon_count: number
}

export default function TeamCompliancePage() {
  const [teamCompliance, setTeamCompliance] = useState<TeamMemberCompliance[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'expired' | 'expiring_soon' | 'valid'>('all')

  useEffect(() => {
    fetchTeamCompliance()
  }, [])

  const fetchTeamCompliance = async () => {
    try {
      const res = await fetch('/api/team/compliance')
      const data = await res.json()
      setTeamCompliance(data.teamCompliance || [])
    } catch (error) {
      console.error('Error fetching team compliance:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredTeam = teamCompliance.filter((member) => {
    if (filter === 'all') return true
    if (filter === 'expired') return member.expired_count > 0
    if (filter === 'expiring_soon') return member.expiring_soon_count > 0
    if (filter === 'valid') return member.expired_count === 0 && member.expiring_soon_count === 0
    return true
  })

  const getComplianceStatus = (member: TeamMemberCompliance) => {
    if (member.total_documents === 0) {
      return { status: 'no_docs', color: 'gray', label: 'No documents' }
    }
    if (member.expired_count > 0) {
      return { status: 'expired', color: 'red', label: 'Has expired documents' }
    }
    if (member.expiring_soon_count > 0) {
      return { status: 'expiring_soon', color: 'yellow', label: 'Has expiring documents' }
    }
    return { status: 'compliant', color: 'green', label: 'Compliant' }
  }

  const stats = {
    total: teamCompliance.length,
    compliant: teamCompliance.filter(m => getComplianceStatus(m).status === 'compliant').length,
    expiring_soon: teamCompliance.filter(m => m.expiring_soon_count > 0).length,
    expired: teamCompliance.filter(m => m.expired_count > 0).length,
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading team compliance...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Team Compliance Overview</h1>
          <p className="mt-2 text-gray-600">
            Monitor compliance documents for all team members
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => window.print()}
            className="rounded-lg border px-4 py-2 hover:bg-gray-50"
          >
            📄 Export PDF
          </button>
          <Link
            href="/dashboard/team"
            className="rounded-lg border px-4 py-2 hover:bg-gray-50"
          >
            ← Back to Team
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-600">Team Members</div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="text-2xl font-bold text-green-600">{stats.compliant}</div>
          <div className="text-sm text-gray-600">Compliant</div>
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

      {/* Filters */}
      <div className="mb-6 rounded-lg bg-white p-4 shadow">
        <div className="flex gap-3">
          <button
            onClick={() => setFilter('all')}
            className={`rounded px-4 py-2 ${filter === 'all' ? 'bg-blue-600 text-white' : 'border hover:bg-gray-50'}`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('expired')}
            className={`rounded px-4 py-2 ${filter === 'expired' ? 'bg-red-600 text-white' : 'border hover:bg-gray-50'}`}
          >
            Expired
          </button>
          <button
            onClick={() => setFilter('expiring_soon')}
            className={`rounded px-4 py-2 ${filter === 'expiring_soon' ? 'bg-yellow-600 text-white' : 'border hover:bg-gray-50'}`}
          >
            Expiring Soon
          </button>
          <button
            onClick={() => setFilter('valid')}
            className={`rounded px-4 py-2 ${filter === 'valid' ? 'bg-green-600 text-white' : 'border hover:bg-gray-50'}`}
          >
            Compliant
          </button>
        </div>
      </div>

      {/* Team Members */}
      <div className="space-y-4">
        {filteredTeam.map((member) => {
          const complianceStatus = getComplianceStatus(member)
          return (
            <div key={member.user_id} className="rounded-lg bg-white p-6 shadow">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{member.full_name}</h3>
                  <p className="text-sm text-gray-600">{member.email}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                      {member.role}
                    </span>
                    <span className={`inline-flex items-center rounded-full bg-${complianceStatus.color}-100 px-2 py-1 text-xs font-medium text-${complianceStatus.color}-800`}>
                      {complianceStatus.label}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-600">Documents</div>
                  <div className="text-2xl font-bold">{member.total_documents}</div>
                </div>
              </div>

              {member.documents.length === 0 ? (
                <p className="text-sm text-gray-500">No documents uploaded yet</p>
              ) : (
                <div className="space-y-2">
                  {member.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between rounded border p-3">
                      <div>
                        <p className="font-medium">{doc.title}</p>
                        {doc.expiry_date && (
                          <p className="text-sm text-gray-600">
                            Expires: {new Date(doc.expiry_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {doc.ai_verification_status === 'verified' && (
                          <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-800">
                            ✓ Verified
                          </span>
                        )}
                        <span className={`rounded-full bg-${
                          doc.expiry_status === 'expired' ? 'red' :
                          doc.expiry_status === 'expiring_soon' ? 'yellow' :
                          doc.expiry_status === 'warning' ? 'orange' :
                          doc.expiry_status === 'valid' ? 'green' : 'gray'
                        }-100 px-2 py-1 text-xs font-medium text-${
                          doc.expiry_status === 'expired' ? 'red' :
                          doc.expiry_status === 'expiring_soon' ? 'yellow' :
                          doc.expiry_status === 'warning' ? 'orange' :
                          doc.expiry_status === 'valid' ? 'green' : 'gray'
                        }-800`}>
                          {doc.expiry_status === 'expired' ? 'Expired' :
                           doc.expiry_status === 'expiring_soon' ? 'Expiring Soon' :
                           doc.expiry_status === 'warning' ? 'Warning' :
                           doc.expiry_status === 'valid' ? 'Valid' : 'No Date'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {member.expired_count > 0 && (
                <div className="mt-4 rounded bg-red-50 p-3 text-sm text-red-800">
                  ⚠ This team member has {member.expired_count} expired document{member.expired_count > 1 ? 's' : ''}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {filteredTeam.length === 0 && (
        <div className="rounded-lg bg-white p-12 text-center shadow">
          <p className="text-gray-600">No team members match the selected filter</p>
        </div>
      )}
    </div>
  )
}
