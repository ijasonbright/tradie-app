'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface TeamMember {
  id: string
  user_id: string
  full_name: string
  email: string
  phone: string | null
  profile_photo_url: string | null
  role: string
  status: string
  employment_type: string | null
  hourly_rate: string | null
  billing_rate: string | null
  owed_amount: string | null
  primary_trade_name: string | null
  invitation_sent_at: string | null
  invitation_accepted_at: string | null
  joined_at: string | null
  organization_id: string
  organization_name: string
  requester_role: string
  // Permissions
  can_create_jobs: boolean
  can_edit_all_jobs: boolean
  can_create_invoices: boolean
  can_view_financials: boolean
  can_approve_expenses: boolean
  can_approve_timesheets: boolean
}

export default function TeamMemberDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [member, setMember] = useState<TeamMember | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  // Edit form state
  const [editForm, setEditForm] = useState({
    role: '',
    employmentType: '',
    hourlyRate: '',
    billingRate: '',
    canCreateJobs: false,
    canEditAllJobs: false,
    canCreateInvoices: false,
    canViewFinancials: false,
    canApproveExpenses: false,
    canApproveTimesheets: false,
  })

  useEffect(() => {
    if (params.id) {
      fetchMember()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  const fetchMember = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/organizations/members/${params.id}`)
      if (!res.ok) throw new Error('Failed to fetch member')

      const data = await res.json()
      setMember(data.member)

      // Initialize edit form with current values
      setEditForm({
        role: data.member.role || '',
        employmentType: data.member.employment_type || '',
        hourlyRate: data.member.hourly_rate || '',
        billingRate: data.member.billing_rate || '',
        canCreateJobs: data.member.can_create_jobs || false,
        canEditAllJobs: data.member.can_edit_all_jobs || false,
        canCreateInvoices: data.member.can_create_invoices || false,
        canViewFinancials: data.member.can_view_financials || false,
        canApproveExpenses: data.member.can_approve_expenses || false,
        canApproveTimesheets: data.member.can_approve_timesheets || false,
      })
    } catch (error) {
      console.error('Error fetching member:', error)
      alert('Failed to load team member')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveChanges = async () => {
    if (!member) return

    setSaving(true)
    try {
      const res = await fetch(`/api/organizations/members/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update member')
      }

      alert('Team member updated successfully!')
      setEditing(false)
      fetchMember()
    } catch (error) {
      console.error('Error updating member:', error)
      alert(error instanceof Error ? error.message : 'Failed to update team member')
    } finally {
      setSaving(false)
    }
  }

  const handleSuspend = async () => {
    if (!member) return

    const action = member.status === 'suspended' ? 'unsuspend' : 'suspend'
    const confirmMessage = action === 'suspend'
      ? 'Are you sure you want to suspend this team member? They will lose access to the system.'
      : 'Are you sure you want to reactivate this team member?'

    if (!confirm(confirmMessage)) return

    try {
      const res = await fetch(`/api/organizations/members/${params.id}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || `Failed to ${action} member`)
      }

      alert(`Team member ${action === 'suspend' ? 'suspended' : 'reactivated'} successfully!`)
      fetchMember()
    } catch (error) {
      console.error(`Error ${action}ing member:`, error)
      alert(error instanceof Error ? error.message : `Failed to ${action} team member`)
    }
  }

  const handleRemove = async () => {
    if (!member) return

    if (!confirm('Are you sure you want to remove this team member? This action cannot be undone.')) return

    try {
      const res = await fetch(`/api/organizations/members/${params.id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to remove member')
      }

      alert('Team member removed successfully!')
      router.push('/dashboard/team')
    } catch (error) {
      console.error('Error removing member:', error)
      alert(error instanceof Error ? error.message : 'Failed to remove team member')
    }
  }

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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading team member...</p>
      </div>
    )
  }

  if (!member) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Team member not found</p>
          <Link href="/dashboard/team" className="text-blue-600 hover:text-blue-700">
            ← Back to Team
          </Link>
        </div>
      </div>
    )
  }

  const canEdit = member.requester_role === 'owner' || member.requester_role === 'admin'
  const cannotModifyOwner = member.role === 'owner'

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link href="/dashboard/team" className="text-sm text-blue-600 hover:text-blue-700 mb-4 inline-block">
          ← Back to Team
        </Link>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-200 text-2xl font-semibold text-gray-700">
              {member.full_name?.charAt(0) || '?'}
            </div>
            <div>
              <h1 className="text-3xl font-bold">{member.full_name}</h1>
              <p className="text-gray-600">{member.email}</p>
              {member.phone && (
                <p className="text-sm text-gray-500">📞 {member.phone}</p>
              )}
            </div>
          </div>

          {canEdit && !cannotModifyOwner && (
            <div className="flex gap-2">
              {!editing ? (
                <>
                  <button
                    onClick={() => setEditing(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleSuspend}
                    className={`px-4 py-2 rounded-md font-medium ${
                      member.status === 'suspended'
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                    }`}
                  >
                    {member.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                  </button>
                  <button
                    onClick={handleRemove}
                    className="px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 font-medium"
                  >
                    Remove
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleSaveChanges}
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    disabled={saving}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 font-medium"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium capitalize ${getRoleBadgeColor(member.role)}`}>
            {member.role}
          </span>
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium capitalize ${getStatusBadgeColor(member.status)}`}>
            {member.status}
          </span>
          {member.primary_trade_name && (
            <span className="inline-flex items-center rounded-full bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-800">
              🔧 {member.primary_trade_name}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="space-y-6">
        {/* Employment Details */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Employment Details</h2>

          {!editing ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-gray-600">Employment Type</p>
                <p className="font-medium capitalize">{member.employment_type || 'Not set'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Primary Trade</p>
                <p className="font-medium">{member.primary_trade_name || 'Not set'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Hourly Rate (Cost)</p>
                <p className="font-medium">{member.hourly_rate ? `$${parseFloat(member.hourly_rate).toFixed(2)}/hr` : 'Not set'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Billing Rate (Charge)</p>
                <p className="font-medium">{member.billing_rate ? `$${parseFloat(member.billing_rate).toFixed(2)}/hr` : 'Not set'}</p>
              </div>
              {member.role === 'subcontractor' && member.owed_amount && (
                <div>
                  <p className="text-sm text-gray-600">Amount Owed</p>
                  <p className="font-medium text-orange-600">${parseFloat(member.owed_amount).toFixed(2)}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employment Type</label>
                <select
                  value={editForm.employmentType}
                  onChange={(e) => setEditForm({ ...editForm, employmentType: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2"
                >
                  <option value="">Not set</option>
                  <option value="full_time">Full Time</option>
                  <option value="part_time">Part Time</option>
                  <option value="casual">Casual</option>
                  <option value="contract">Contract</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2"
                  disabled={member.role === 'owner'}
                >
                  <option value="employee">Employee</option>
                  <option value="admin">Admin</option>
                  <option value="subcontractor">Subcontractor</option>
                  {member.role === 'owner' && <option value="owner">Owner</option>}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hourly Rate ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.hourlyRate}
                  onChange={(e) => setEditForm({ ...editForm, hourlyRate: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2"
                  placeholder="35.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Billing Rate ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.billingRate}
                  onChange={(e) => setEditForm({ ...editForm, billingRate: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2"
                  placeholder="85.00"
                />
              </div>
            </div>
          )}
        </div>

        {/* Permissions (Employees only) */}
        {(member.role === 'employee' || (editing && editForm.role === 'employee')) && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Permissions</h2>

            {!editing ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {member.can_create_jobs ? '✅' : '❌'}
                  <span>Can create and manage jobs</span>
                </div>
                <div className="flex items-center gap-2">
                  {member.can_edit_all_jobs ? '✅' : '❌'}
                  <span>Can edit all jobs</span>
                </div>
                <div className="flex items-center gap-2">
                  {member.can_create_invoices ? '✅' : '❌'}
                  <span>Can create and send invoices</span>
                </div>
                <div className="flex items-center gap-2">
                  {member.can_view_financials ? '✅' : '❌'}
                  <span>Can view financial reports</span>
                </div>
                <div className="flex items-center gap-2">
                  {member.can_approve_expenses ? '✅' : '❌'}
                  <span>Can approve expenses</span>
                </div>
                <div className="flex items-center gap-2">
                  {member.can_approve_timesheets ? '✅' : '❌'}
                  <span>Can approve timesheets</span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editForm.canCreateJobs}
                    onChange={(e) => setEditForm({ ...editForm, canCreateJobs: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm">Can create and manage jobs</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editForm.canEditAllJobs}
                    onChange={(e) => setEditForm({ ...editForm, canEditAllJobs: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm">Can edit all jobs (not just assigned)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editForm.canCreateInvoices}
                    onChange={(e) => setEditForm({ ...editForm, canCreateInvoices: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm">Can create and send invoices</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editForm.canViewFinancials}
                    onChange={(e) => setEditForm({ ...editForm, canViewFinancials: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm">Can view financial reports</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editForm.canApproveExpenses}
                    onChange={(e) => setEditForm({ ...editForm, canApproveExpenses: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm">Can approve expenses</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editForm.canApproveTimesheets}
                    onChange={(e) => setEditForm({ ...editForm, canApproveTimesheets: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm">Can approve timesheets</span>
                </label>
              </div>
            )}
          </div>
        )}

        {/* Membership Info */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Membership Information</h2>
          <div className="space-y-3 text-sm">
            {member.invitation_sent_at && (
              <div>
                <span className="text-gray-600">Invited:</span>
                <span className="ml-2 font-medium">{new Date(member.invitation_sent_at).toLocaleString()}</span>
              </div>
            )}
            {member.invitation_accepted_at && (
              <div>
                <span className="text-gray-600">Accepted Invitation:</span>
                <span className="ml-2 font-medium">{new Date(member.invitation_accepted_at).toLocaleString()}</span>
              </div>
            )}
            {member.joined_at && (
              <div>
                <span className="text-gray-600">Joined:</span>
                <span className="ml-2 font-medium">{new Date(member.joined_at).toLocaleString()}</span>
              </div>
            )}
            <div>
              <span className="text-gray-600">Organization:</span>
              <span className="ml-2 font-medium">{member.organization_name}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
