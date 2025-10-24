'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface TeamMember {
  id: string
  user_id: string
  full_name: string
  email: string
  phone: string | null
  role: string
  status: string
  employment_type: string | null
  hourly_rate: string | null
  billing_rate: string | null
  primary_trade_name: string | null
  invitation_sent_at: string | null
  invitation_accepted_at: string | null
  joined_at: string | null
  // Permissions
  can_create_jobs: boolean
  can_edit_all_jobs: boolean
  can_create_invoices: boolean
  can_view_financials: boolean
  can_approve_expenses: boolean
  // Documents count
  documents_count?: number
  expired_documents_count?: number
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all') // all, owner, admin, employee, subcontractor
  const [statusFilter, setStatusFilter] = useState<string>('all') // all, active, invited, suspended
  const [searchQuery, setSearchQuery] = useState('')
  const [showInviteModal, setShowInviteModal] = useState(false)

  useEffect(() => {
    fetchTeamMembers()
  }, [])

  const fetchTeamMembers = async () => {
    try {
      const res = await fetch('/api/organizations/members')
      const data = await res.json()
      setMembers(data.members || [])
    } catch (error) {
      console.error('Error fetching team members:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredMembers = members.filter((member) => {
    // Role filter
    if (filter !== 'all' && member.role !== filter) return false

    // Status filter
    if (statusFilter !== 'all' && member.status !== statusFilter) return false

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        member.full_name?.toLowerCase().includes(query) ||
        member.email?.toLowerCase().includes(query)
      )
    }

    return true
  })

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      owner: 'bg-purple-100 text-purple-800',
      admin: 'bg-blue-100 text-blue-800',
      employee: 'bg-green-100 text-green-800',
      subcontractor: 'bg-orange-100 text-orange-800',
    }
    return colors[role] || 'bg-gray-100 text-gray-800'
  }

  const getStatusBadgeColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      invited: 'bg-yellow-100 text-yellow-800',
      suspended: 'bg-red-100 text-red-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getRoleStats = () => {
    return {
      all: members.length,
      owner: members.filter(m => m.role === 'owner').length,
      admin: members.filter(m => m.role === 'admin').length,
      employee: members.filter(m => m.role === 'employee').length,
      subcontractor: members.filter(m => m.role === 'subcontractor').length,
    }
  }

  const stats = getRoleStats()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading team members...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Team Members</h1>
          <p className="mt-2 text-gray-600">
            Manage your organization&apos;s team members, roles, and permissions
          </p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
        >
          + Invite Team Member
        </button>
      </div>

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="text-2xl font-bold text-gray-900">{stats.all}</div>
          <div className="text-sm text-gray-600">Total Members</div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="text-2xl font-bold text-purple-600">{stats.owner}</div>
          <div className="text-sm text-gray-600">Owners</div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="text-2xl font-bold text-blue-600">{stats.admin}</div>
          <div className="text-sm text-gray-600">Admins</div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="text-2xl font-bold text-green-600">{stats.employee}</div>
          <div className="text-sm text-gray-600">Employees</div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="text-2xl font-bold text-orange-600">{stats.subcontractor}</div>
          <div className="text-sm text-gray-600">Subcontractors</div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="mb-6 rounded-lg bg-white p-4 shadow">
        <div className="flex flex-wrap gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border px-4 py-2"
            />
          </div>

          {/* Role Filter */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-lg border px-4 py-2"
          >
            <option value="all">All Roles</option>
            <option value="owner">Owners</option>
            <option value="admin">Admins</option>
            <option value="employee">Employees</option>
            <option value="subcontractor">Subcontractors</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border px-4 py-2"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="invited">Invited</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* Team Members List */}
      {filteredMembers.length === 0 ? (
        <div className="rounded-lg bg-white p-12 text-center shadow">
          <p className="text-gray-500">
            {searchQuery || filter !== 'all' || statusFilter !== 'all'
              ? 'No team members match your filters'
              : 'No team members yet. Invite your first team member!'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredMembers.map((member) => (
            <div
              key={member.id}
              className="rounded-lg bg-white p-6 shadow hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 text-lg font-semibold text-gray-700">
                      {member.full_name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">{member.full_name}</h3>
                      <p className="text-sm text-gray-600">{member.email}</p>
                      {member.phone && (
                        <p className="text-sm text-gray-500">📞 {member.phone}</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium capitalize ${getRoleBadgeColor(member.role)}`}>
                      {member.role}
                    </span>
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium capitalize ${getStatusBadgeColor(member.status)}`}>
                      {member.status}
                    </span>
                    {member.primary_trade_name && (
                      <span className="inline-flex items-center rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-800">
                        🔧 {member.primary_trade_name}
                      </span>
                    )}
                    {member.employment_type && (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">
                        {member.employment_type}
                      </span>
                    )}
                  </div>

                  {/* Rates */}
                  {(member.hourly_rate || member.billing_rate) && (
                    <div className="mt-3 flex gap-4 text-sm">
                      {member.hourly_rate && (
                        <span className="text-gray-600">
                          💰 Cost: ${parseFloat(member.hourly_rate).toFixed(2)}/hr
                        </span>
                      )}
                      {member.billing_rate && (
                        <span className="text-gray-600">
                          💵 Bill: ${parseFloat(member.billing_rate).toFixed(2)}/hr
                        </span>
                      )}
                    </div>
                  )}

                  {/* Permissions Summary */}
                  {member.role === 'employee' && (
                    <div className="mt-3 text-xs text-gray-500">
                      <span className="font-medium">Permissions:</span>
                      {member.can_create_jobs && <span className="ml-2">✓ Jobs</span>}
                      {member.can_create_invoices && <span className="ml-2">✓ Invoices</span>}
                      {member.can_view_financials && <span className="ml-2">✓ Financials</span>}
                      {member.can_approve_expenses && <span className="ml-2">✓ Approvals</span>}
                    </div>
                  )}

                  {/* Status Info */}
                  {member.status === 'invited' && member.invitation_sent_at && (
                    <p className="mt-2 text-xs text-gray-500">
                      Invited {new Date(member.invitation_sent_at).toLocaleDateString()}
                    </p>
                  )}
                  {member.status === 'active' && member.joined_at && (
                    <p className="mt-2 text-xs text-gray-500">
                      Joined {new Date(member.joined_at).toLocaleDateString()}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="ml-4 flex flex-col gap-2">
                  <Link
                    href={`/dashboard/team/${member.id}`}
                    className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 text-center"
                  >
                    View Details
                  </Link>
                  {member.status === 'invited' && (
                    <button
                      onClick={() => alert('Resend invitation functionality coming soon')}
                      className="rounded bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
                    >
                      Resend Invite
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Invite Modal Placeholder */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Invite Team Member</h2>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <p className="text-gray-600">Invite form coming next...</p>
          </div>
        </div>
      )}
    </div>
  )
}
