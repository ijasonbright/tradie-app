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

interface TradeType {
  id: string
  name: string
}

interface InviteFormData {
  email: string
  full_name: string
  phone: string
  role: 'employee' | 'subcontractor'
  employment_type: string
  primary_trade_id: string
  hourly_rate: string
  billing_rate: string
  // Permissions
  can_create_jobs: boolean
  can_edit_all_jobs: boolean
  can_create_invoices: boolean
  can_view_financials: boolean
  can_approve_expenses: boolean
  can_approve_timesheets: boolean
  // Compliance requirements
  requires_trade_license: boolean
  requires_police_check: boolean
  requires_working_with_children: boolean
  requires_public_liability: boolean // subcontractors only
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all') // all, owner, admin, employee, subcontractor
  const [statusFilter, setStatusFilter] = useState<string>('all') // all, active, invited, suspended
  const [searchQuery, setSearchQuery] = useState('')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [tradeTypes, setTradeTypes] = useState<TradeType[]>([])
  const [submitting, setSubmitting] = useState(false)

  const [inviteForm, setInviteForm] = useState<InviteFormData>({
    email: '',
    full_name: '',
    phone: '',
    role: 'employee',
    employment_type: 'full_time',
    primary_trade_id: '',
    hourly_rate: '',
    billing_rate: '',
    can_create_jobs: false,
    can_edit_all_jobs: false,
    can_create_invoices: false,
    can_view_financials: false,
    can_approve_expenses: false,
    can_approve_timesheets: false,
    requires_trade_license: false,
    requires_police_check: false,
    requires_working_with_children: false,
    requires_public_liability: false,
  })

  useEffect(() => {
    fetchTeamMembers()
    fetchTradeTypes()
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

  const fetchTradeTypes = async () => {
    try {
      const res = await fetch('/api/settings/trade-types')
      const data = await res.json()
      setTradeTypes(data.tradeTypes || [])
    } catch (error) {
      console.error('Error fetching trade types:', error)
    }
  }

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const res = await fetch('/api/organizations/members/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteForm),
      })

      if (res.ok) {
        alert('Invitation sent successfully!')
        setShowInviteModal(false)
        // Reset form
        setInviteForm({
          email: '',
          full_name: '',
          phone: '',
          role: 'employee',
          employment_type: 'full_time',
          primary_trade_id: '',
          hourly_rate: '',
          billing_rate: '',
          can_create_jobs: false,
          can_edit_all_jobs: false,
          can_create_invoices: false,
          can_view_financials: false,
          can_approve_expenses: false,
          can_approve_timesheets: false,
          requires_trade_license: false,
          requires_police_check: false,
          requires_working_with_children: false,
          requires_public_liability: false,
        })
        fetchTeamMembers()
      } else {
        const error = await res.json()
        console.error('API Error:', error)
        alert(`Error: ${error.error}\n\nDetails: ${error.details || 'No details available'}`)
      }
    } catch (error) {
      console.error('Error sending invitation:', error)
      alert(`Failed to send invitation: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setSubmitting(false)
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
                  <button
                    onClick={() => alert('Member detail page coming soon')}
                    className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 text-center"
                  >
                    View Details
                  </button>
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

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Invite Team Member</h2>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="space-y-6">
              {/* Basic Information */}
              <div className="rounded-lg border p-4">
                <h3 className="mb-4 text-lg font-semibold">Basic Information</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={inviteForm.full_name}
                      onChange={(e) => setInviteForm({ ...inviteForm, full_name: e.target.value })}
                      className="mt-1 w-full rounded-lg border px-3 py-2"
                      placeholder="John Smith"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email *</label>
                    <input
                      type="email"
                      required
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                      className="mt-1 w-full rounded-lg border px-3 py-2"
                      placeholder="john@example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Phone</label>
                    <input
                      type="tel"
                      value={inviteForm.phone}
                      onChange={(e) => setInviteForm({ ...inviteForm, phone: e.target.value })}
                      className="mt-1 w-full rounded-lg border px-3 py-2"
                      placeholder="+61 4XX XXX XXX"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Role *</label>
                    <select
                      required
                      value={inviteForm.role}
                      onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as 'employee' | 'subcontractor' })}
                      className="mt-1 w-full rounded-lg border px-3 py-2"
                    >
                      <option value="employee">Employee</option>
                      <option value="subcontractor">Subcontractor</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Employment Details */}
              <div className="rounded-lg border p-4">
                <h3 className="mb-4 text-lg font-semibold">Employment Details</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Employment Type</label>
                    <select
                      value={inviteForm.employment_type}
                      onChange={(e) => setInviteForm({ ...inviteForm, employment_type: e.target.value })}
                      className="mt-1 w-full rounded-lg border px-3 py-2"
                    >
                      <option value="full_time">Full Time</option>
                      <option value="part_time">Part Time</option>
                      <option value="casual">Casual</option>
                      <option value="contract">Contract</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Primary Trade <span className="text-gray-400">(Optional)</span>
                    </label>
                    <select
                      value={inviteForm.primary_trade_id}
                      onChange={(e) => setInviteForm({ ...inviteForm, primary_trade_id: e.target.value })}
                      className="mt-1 w-full rounded-lg border px-3 py-2"
                    >
                      <option value="">Select trade...</option>
                      {tradeTypes.map((trade) => (
                        <option key={trade.id} value={trade.id}>
                          {trade.name}
                        </option>
                      ))}
                    </select>
                    {tradeTypes.length === 0 && (
                      <p className="mt-1 text-xs text-gray-500">
                        No trades configured yet. You can set up trades in Settings later.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Hourly Rate ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={inviteForm.hourly_rate}
                      onChange={(e) => setInviteForm({ ...inviteForm, hourly_rate: e.target.value })}
                      className="mt-1 w-full rounded-lg border px-3 py-2"
                      placeholder="35.00"
                    />
                    <p className="mt-1 text-xs text-gray-500">Cost to your business</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Billing Rate ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={inviteForm.billing_rate}
                      onChange={(e) => setInviteForm({ ...inviteForm, billing_rate: e.target.value })}
                      className="mt-1 w-full rounded-lg border px-3 py-2"
                      placeholder="85.00"
                    />
                    <p className="mt-1 text-xs text-gray-500">Rate charged to clients</p>
                  </div>
                </div>
              </div>

              {/* Permissions (Employees Only) */}
              {inviteForm.role === 'employee' && (
                <div className="rounded-lg border p-4">
                  <h3 className="mb-4 text-lg font-semibold">Permissions</h3>
                  <div className="space-y-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={inviteForm.can_create_jobs}
                        onChange={(e) => setInviteForm({ ...inviteForm, can_create_jobs: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm">Can create and manage jobs</span>
                    </label>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={inviteForm.can_edit_all_jobs}
                        onChange={(e) => setInviteForm({ ...inviteForm, can_edit_all_jobs: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm">Can edit all jobs (not just assigned)</span>
                    </label>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={inviteForm.can_create_invoices}
                        onChange={(e) => setInviteForm({ ...inviteForm, can_create_invoices: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm">Can create and send invoices</span>
                    </label>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={inviteForm.can_view_financials}
                        onChange={(e) => setInviteForm({ ...inviteForm, can_view_financials: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm">Can view financial reports</span>
                    </label>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={inviteForm.can_approve_expenses}
                        onChange={(e) => setInviteForm({ ...inviteForm, can_approve_expenses: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm">Can approve expenses</span>
                    </label>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={inviteForm.can_approve_timesheets}
                        onChange={(e) => setInviteForm({ ...inviteForm, can_approve_timesheets: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm">Can approve timesheets</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Compliance Requirements */}
              <div className="rounded-lg border p-4">
                <h3 className="mb-4 text-lg font-semibold">Compliance Requirements</h3>
                <p className="mb-4 text-sm text-gray-600">
                  Select which documents this team member must upload to complete their profile
                </p>
                <div className="space-y-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={inviteForm.requires_trade_license}
                      onChange={(e) => setInviteForm({ ...inviteForm, requires_trade_license: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm">Trade License / Certification</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={inviteForm.requires_police_check}
                      onChange={(e) => setInviteForm({ ...inviteForm, requires_police_check: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm">Police Check (Optional)</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={inviteForm.requires_working_with_children}
                      onChange={(e) => setInviteForm({ ...inviteForm, requires_working_with_children: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm">Working with Children Check (Optional)</span>
                  </label>

                  {inviteForm.role === 'subcontractor' && (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={inviteForm.requires_public_liability}
                        onChange={(e) => setInviteForm({ ...inviteForm, requires_public_liability: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm">Public Liability Insurance</span>
                    </label>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 rounded-lg border px-4 py-2 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
