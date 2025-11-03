import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Switch } from 'react-native'
import { useState, useEffect } from 'react'
import { useRouter, useLocalSearchParams, Stack } from 'expo-router'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { Avatar } from 'react-native-paper'
import { apiClient } from '../../lib/api-client'
import { useTheme } from '../../context/ThemeContext'

const ROLE_COLORS: Record<string, string> = {
  owner: '#10b981',
  admin: '#3b82f6',
  employee: '#8b5cf6',
  subcontractor: '#f59e0b',
}

export default function TeamMemberDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams()
  const { brandColor } = useTheme()

  const [loading, setLoading] = useState(true)
  const [member, setMember] = useState<any>(null)
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
    if (id) {
      fetchMember()
    }
  }, [id])

  const fetchMember = async () => {
    try {
      setLoading(true)
      const response = await apiClient.request<{ member: any }>(`/organizations/members/${id}`)
      setMember(response.member)

      // Initialize edit form
      setEditForm({
        role: response.member.role || '',
        employmentType: response.member.employment_type || '',
        hourlyRate: response.member.hourly_rate || '',
        billingRate: response.member.billing_rate || '',
        canCreateJobs: response.member.can_create_jobs || false,
        canEditAllJobs: response.member.can_edit_all_jobs || false,
        canCreateInvoices: response.member.can_create_invoices || false,
        canViewFinancials: response.member.can_view_financials || false,
        canApproveExpenses: response.member.can_approve_expenses || false,
        canApproveTimesheets: response.member.can_approve_timesheets || false,
      })
    } catch (error: any) {
      console.error('Failed to fetch member:', error)
      Alert.alert('Error', 'Failed to load team member details')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveChanges = async () => {
    setSaving(true)
    try {
      await apiClient.request(`/organizations/members/${id}`, {
        method: 'PUT',
        body: JSON.stringify(editForm),
      })

      Alert.alert('Success', 'Team member updated successfully!')
      setEditing(false)
      fetchMember()
    } catch (error: any) {
      console.error('Failed to update member:', error)
      Alert.alert('Error', error.message || 'Failed to update team member')
    } finally {
      setSaving(false)
    }
  }

  const handleSuspend = async () => {
    if (!member) return

    const action = member.status === 'suspended' ? 'unsuspend' : 'suspend'
    const message = action === 'suspend'
      ? 'Are you sure you want to suspend this team member? They will lose access to the system.'
      : 'Are you sure you want to reactivate this team member?'

    Alert.alert(
      'Confirm',
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action === 'suspend' ? 'Suspend' : 'Reactivate',
          style: action === 'suspend' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await apiClient.request(`/organizations/members/${id}/suspend`, {
                method: 'POST',
                body: JSON.stringify({ action }),
              })

              Alert.alert('Success', `Team member ${action === 'suspend' ? 'suspended' : 'reactivated'} successfully!`)
              fetchMember()
            } catch (error: any) {
              console.error(`Failed to ${action} member:`, error)
              Alert.alert('Error', error.message || `Failed to ${action} team member`)
            }
          },
        },
      ]
    )
  }

  const handleRemove = async () => {
    if (!member) return

    Alert.alert(
      'Remove Team Member',
      'Are you sure you want to remove this team member? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.request(`/organizations/members/${id}`, {
                method: 'DELETE',
              })

              Alert.alert('Success', 'Team member removed successfully!')
              router.back()
            } catch (error: any) {
              console.error('Failed to remove member:', error)
              Alert.alert('Error', error.message || 'Failed to remove team member')
            }
          },
        },
      ]
    )
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const canEdit = member && (member.requester_role === 'owner' || member.requester_role === 'admin')
  const cannotModifyOwner = member && member.role === 'owner'

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={brandColor} />
      </View>
    )
  }

  if (!member) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Team member not found</Text>
      </View>
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: member.full_name || 'Team Member',
          headerBackTitle: 'Team',
        }}
      />

      <ScrollView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Avatar.Text
            size={80}
            label={getInitials(member.full_name || member.email)}
            style={[styles.avatar, { backgroundColor: ROLE_COLORS[member.role as keyof typeof ROLE_COLORS] || '#666' }]}
          />
          <Text style={styles.name}>{member.full_name}</Text>
          <Text style={styles.email}>{member.email}</Text>
          {member.phone && (
            <Text style={styles.phone}>📞 {member.phone}</Text>
          )}

          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: ROLE_COLORS[member.role as keyof typeof ROLE_COLORS] || '#666' }]}>
              <Text style={styles.badgeText}>{member.role}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: member.status === 'active' ? '#10b981' : '#f59e0b' }]}>
              <Text style={styles.badgeText}>{member.status}</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        {canEdit && !cannotModifyOwner && (
          <View style={styles.actions}>
            {!editing ? (
              <>
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: brandColor }]}
                  onPress={() => setEditing(true)}
                >
                  <Text style={styles.buttonText}>Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, { backgroundColor: member.status === 'suspended' ? '#10b981' : '#f59e0b' }]}
                  onPress={handleSuspend}
                >
                  <Text style={styles.buttonText}>{member.status === 'suspended' ? 'Reactivate' : 'Suspend'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.dangerButton]}
                  onPress={handleRemove}
                >
                  <Text style={styles.buttonText}>Remove</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: brandColor }]}
                  onPress={handleSaveChanges}
                  disabled={saving}
                >
                  <Text style={styles.buttonText}>{saving ? 'Saving...' : 'Save'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => setEditing(false)}
                  disabled={saving}
                >
                  <Text style={[styles.buttonText, { color: '#666' }]}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* Employment Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Employment Details</Text>

          {!editing ? (
            <View style={styles.detailsGrid}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Employment Type</Text>
                <Text style={styles.detailValue}>{member.employment_type || 'Not set'}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Primary Trade</Text>
                <Text style={styles.detailValue}>{member.primary_trade_name || 'Not set'}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Hourly Rate (Cost)</Text>
                <Text style={styles.detailValue}>
                  {member.hourly_rate ? `$${parseFloat(member.hourly_rate).toFixed(2)}/hr` : 'Not set'}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Billing Rate (Charge)</Text>
                <Text style={styles.detailValue}>
                  {member.billing_rate ? `$${parseFloat(member.billing_rate).toFixed(2)}/hr` : 'Not set'}
                </Text>
              </View>
              {member.role === 'subcontractor' && member.owed_amount && (
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Amount Owed</Text>
                  <Text style={[styles.detailValue, { color: '#f59e0b' }]}>
                    ${parseFloat(member.owed_amount).toFixed(2)}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.form}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Role</Text>
                <View style={styles.picker}>
                  {['employee', 'admin', 'subcontractor'].map((role) => (
                    <TouchableOpacity
                      key={role}
                      style={[
                        styles.pickerOption,
                        editForm.role === role && styles.pickerOptionSelected,
                      ]}
                      onPress={() => setEditForm({ ...editForm, role })}
                    >
                      <Text style={[
                        styles.pickerText,
                        editForm.role === role && styles.pickerTextSelected,
                      ]}>
                        {role.charAt(0).toUpperCase() + role.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Hourly Rate ($)</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.hourlyRate}
                  onChangeText={(value) => setEditForm({ ...editForm, hourlyRate: value })}
                  keyboardType="decimal-pad"
                  placeholder="35.00"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Billing Rate ($)</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.billingRate}
                  onChangeText={(value) => setEditForm({ ...editForm, billingRate: value })}
                  keyboardType="decimal-pad"
                  placeholder="85.00"
                />
              </View>
            </View>
          )}
        </View>

        {/* Permissions (Employees only) */}
        {(member.role === 'employee' || (editing && editForm.role === 'employee')) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Permissions</Text>

            {!editing ? (
              <View style={styles.permissionsList}>
                <View style={styles.permissionItem}>
                  <Text style={styles.permissionText}>Can create and manage jobs</Text>
                  <Text style={styles.permissionIcon}>{member.can_create_jobs ? '✅' : '❌'}</Text>
                </View>
                <View style={styles.permissionItem}>
                  <Text style={styles.permissionText}>Can edit all jobs</Text>
                  <Text style={styles.permissionIcon}>{member.can_edit_all_jobs ? '✅' : '❌'}</Text>
                </View>
                <View style={styles.permissionItem}>
                  <Text style={styles.permissionText}>Can create and send invoices</Text>
                  <Text style={styles.permissionIcon}>{member.can_create_invoices ? '✅' : '❌'}</Text>
                </View>
                <View style={styles.permissionItem}>
                  <Text style={styles.permissionText}>Can view financial reports</Text>
                  <Text style={styles.permissionIcon}>{member.can_view_financials ? '✅' : '❌'}</Text>
                </View>
                <View style={styles.permissionItem}>
                  <Text style={styles.permissionText}>Can approve expenses</Text>
                  <Text style={styles.permissionIcon}>{member.can_approve_expenses ? '✅' : '❌'}</Text>
                </View>
                <View style={styles.permissionItem}>
                  <Text style={styles.permissionText}>Can approve timesheets</Text>
                  <Text style={styles.permissionIcon}>{member.can_approve_timesheets ? '✅' : '❌'}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.permissionsList}>
                {[
                  { key: 'canCreateJobs', label: 'Can create and manage jobs' },
                  { key: 'canEditAllJobs', label: 'Can edit all jobs' },
                  { key: 'canCreateInvoices', label: 'Can create and send invoices' },
                  { key: 'canViewFinancials', label: 'Can view financial reports' },
                  { key: 'canApproveExpenses', label: 'Can approve expenses' },
                  { key: 'canApproveTimesheets', label: 'Can approve timesheets' },
                ].map((perm) => (
                  <View key={perm.key} style={styles.permissionItem}>
                    <Text style={styles.permissionText}>{perm.label}</Text>
                    <Switch
                      value={editForm[perm.key as keyof typeof editForm] as boolean}
                      onValueChange={(value) => setEditForm({ ...editForm, [perm.key]: value })}
                      trackColor={{ false: '#ccc', true: brandColor }}
                      thumbColor="#fff"
                    />
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Membership Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Membership Information</Text>
          <View style={styles.detailsGrid}>
            {member.invitation_sent_at && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Invited</Text>
                <Text style={styles.detailValue}>{new Date(member.invitation_sent_at).toLocaleDateString()}</Text>
              </View>
            )}
            {member.joined_at && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Joined</Text>
                <Text style={styles.detailValue}>{new Date(member.joined_at).toLocaleDateString()}</Text>
              </View>
            )}
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Organization</Text>
              <Text style={styles.detailValue}>{member.organization_name}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#fff',
    padding: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  avatar: {
    marginBottom: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  phone: {
    fontSize: 14,
    color: '#666',
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    backgroundColor: '#fff',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  dangerButton: {
    backgroundColor: '#ef4444',
  },
  cancelButton: {
    backgroundColor: '#e5e7eb',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 16,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
    marginBottom: 16,
  },
  detailsGrid: {
    gap: 16,
  },
  detailItem: {
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: '#111',
    fontWeight: '500',
  },
  permissionsList: {
    gap: 12,
  },
  permissionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  permissionText: {
    fontSize: 14,
    color: '#111',
    flex: 1,
  },
  permissionIcon: {
    fontSize: 18,
  },
  form: {
    gap: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  picker: {
    flexDirection: 'row',
    gap: 8,
  },
  pickerOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  pickerOptionSelected: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  pickerText: {
    fontSize: 14,
    color: '#666',
  },
  pickerTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
})
