import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native'
import { useState, useEffect } from 'react'
import { useRouter } from 'expo-router'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { Avatar, FAB } from 'react-native-paper'
import { apiClient } from '../../lib/api-client'

const ROLE_COLORS: Record<string, string> = {
  owner: '#10b981',
  admin: '#3b82f6',
  employee: '#8b5cf6',
  subcontractor: '#f59e0b',
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  employee: 'Employee',
  subcontractor: 'Subcontractor',
}

export default function TeamMembersScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [members, setMembers] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchTeamMembers()
  }, [])

  const fetchTeamMembers = async () => {
    try {
      setError(null)
      const response = await apiClient.getTeamMembers()
      setMembers(response.members || [])
    } catch (err: any) {
      console.error('Failed to fetch team members:', err)
      setError(err.message || 'Failed to load team members')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const onRefresh = () => {
    setRefreshing(true)
    fetchTeamMembers()
  }

  const handleMemberPress = (member: any) => {
    router.push(`/team/${member.id}`)
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const renderMember = (member: any) => {
    const role = member.role as keyof typeof ROLE_COLORS
    const statusColor = member.status === 'active' ? '#10b981' : '#f59e0b'

    return (
      <TouchableOpacity
        key={member.id}
        style={styles.memberCard}
        onPress={() => handleMemberPress(member)}
      >
        <Avatar.Text
          size={48}
          label={getInitials(member.full_name || member.email)}
          style={[styles.avatar, { backgroundColor: ROLE_COLORS[role] || '#666' }]}
        />

        <View style={styles.memberInfo}>
          <View style={styles.memberHeader}>
            <Text style={styles.memberName}>{member.full_name || 'Unknown'}</Text>
            {member.status !== 'active' && (
              <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                <Text style={styles.statusText}>{member.status}</Text>
              </View>
            )}
          </View>

          <Text style={styles.memberEmail}>{member.email}</Text>

          <View style={styles.memberFooter}>
            <View style={[styles.roleChip, { backgroundColor: ROLE_COLORS[role] || '#666' }]}>
              <Text style={styles.roleText}>{ROLE_LABELS[role] || role}</Text>
            </View>

            {member.phone && (
              <View style={styles.phoneContainer}>
                <MaterialCommunityIcons name="phone" size={14} color="#666" />
                <Text style={styles.phoneText}>{member.phone}</Text>
              </View>
            )}
          </View>
        </View>

        <MaterialCommunityIcons name="chevron-right" size={24} color="#ccc" />
      </TouchableOpacity>
    )
  }

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading team members...</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorBanner}>
          <MaterialCommunityIcons name="alert-circle" size={20} color="#fff" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2563eb']}
            tintColor="#2563eb"
          />
        }
      >
        {/* Stats Card */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{members.length}</Text>
            <Text style={styles.statLabel}>Total Members</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {members.filter(m => m.status === 'active').length}
            </Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {members.filter(m => m.status === 'invited').length}
            </Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
        </View>

        {/* Team Members List */}
        {members.length > 0 ? (
          members.map(renderMember)
        ) : (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="account-group" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No team members yet</Text>
            <Text style={styles.emptySubtext}>Tap the + button to invite someone</Text>
          </View>
        )}
      </ScrollView>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => router.push('/team/invite')}
        label="Invite"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
  },
  errorBanner: {
    backgroundColor: '#ef4444',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  errorText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 80,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2563eb',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#e5e5e5',
    marginHorizontal: 8,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  avatar: {
    marginRight: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
  },
  memberEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  memberFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  roleChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
  },
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  phoneText: {
    fontSize: 12,
    color: '#666',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#bbb',
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#2563eb',
  },
})
