'use client'

import { useEffect, useState } from 'react'

interface TeamMember {
  user_id: string
  full_name: string
  email: string
  role: string
  organization_name: string
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)

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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading team members...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Team Members</h1>
        <p className="mt-2 text-gray-600">
          Manage your organization&apos;s team members and their roles
        </p>
      </div>

      {members.length === 0 ? (
        <div className="rounded-lg bg-white p-12 text-center shadow">
          <p className="text-gray-500">No team members found</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {members.map((member) => (
            <div
              key={member.user_id}
              className="rounded-lg bg-white p-6 shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{member.full_name}</h3>
                  <p className="text-sm text-gray-600">{member.email}</p>
                  <p className="mt-1 text-sm text-gray-500">
                    Organization: {member.organization_name}
                  </p>
                </div>
                <div>
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-medium capitalize text-blue-800">
                    {member.role}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
