import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native'
import { useState } from 'react'
import { useRouter } from 'expo-router'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { apiClient } from '../../lib/api-client'

const ROLES = [
  { value: 'employee', label: 'Employee', description: 'Can manage jobs and clients', icon: 'account' },
  { value: 'subcontractor', label: 'Subcontractor', description: 'View assigned jobs only', icon: 'account-hard-hat' },
  { value: 'admin', label: 'Admin', description: 'Nearly full control', icon: 'shield-account' },
]

export default function InviteTeamMemberScreen() {
  const router = useRouter()
  const [sending, setSending] = useState(false)

  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState('employee')
  const [hourlyRate, setHourlyRate] = useState('')

  // Permissions
  const [canCreateJobs, setCanCreateJobs] = useState(false)
  const [canEditAllJobs, setCanEditAllJobs] = useState(false)
  const [canCreateInvoices, setCanCreateInvoices] = useState(false)
  const [canViewFinancials, setCanViewFinancials] = useState(false)

  const handleSendInvite = async () => {
    if (!email.trim() || !fullName.trim()) {
      Alert.alert('Validation Error', 'Email and full name are required')
      return
    }

    if (!email.includes('@')) {
      Alert.alert('Validation Error', 'Please enter a valid email address')
      return
    }

    try {
      setSending(true)

      await apiClient.inviteTeamMember({
        email: email.trim(),
        fullName: fullName.trim(),
        phone: phone.trim() || null,
        role,
        hourlyRate: hourlyRate ? parseFloat(hourlyRate) : null,
        permissions: {
          canCreateJobs,
          canEditAllJobs,
          canCreateInvoices,
          canViewFinancials,
        },
      })

      Alert.alert(
        'Invitation Sent',
        `An invitation email has been sent to ${email}`,
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      )
    } catch (err: any) {
      console.error('Failed to send invitation:', err)
      Alert.alert('Error', err.message || 'Failed to send invitation')
    } finally {
      setSending(false)
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Info Card */}
        <View style={styles.infoCard}>
          <MaterialCommunityIcons name="information" size={20} color="#2563eb" />
          <Text style={styles.infoText}>
            An invitation email will be sent to the team member. They can sign up and join your organization.
          </Text>
        </View>

        {/* Basic Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>

          <Text style={styles.label}>Email Address *</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="email@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />

          <Text style={styles.label}>Full Name *</Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Enter full name"
            autoCapitalize="words"
          />

          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="Optional"
            keyboardType="phone-pad"
          />
        </View>

        {/* Role Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Role</Text>

          {ROLES.map((r) => (
            <TouchableOpacity
              key={r.value}
              style={[styles.roleOption, role === r.value && styles.roleOptionActive]}
              onPress={() => setRole(r.value)}
            >
              <MaterialCommunityIcons
                name={r.icon as any}
                size={24}
                color={role === r.value ? '#2563eb' : '#666'}
              />
              <View style={styles.roleTextContainer}>
                <Text style={[styles.roleLabel, role === r.value && styles.roleLabelActive]}>
                  {r.label}
                </Text>
                <Text style={styles.roleDescription}>{r.description}</Text>
              </View>
              {role === r.value && (
                <MaterialCommunityIcons name="check-circle" size={24} color="#2563eb" />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Pay Rate (for subcontractors) */}
        {role === 'subcontractor' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pay Rate</Text>
            <Text style={styles.label}>Hourly Rate</Text>
            <View style={styles.inputWithPrefix}>
              <Text style={styles.inputPrefix}>$</Text>
              <TextInput
                style={styles.inputWithPrefixInput}
                value={hourlyRate}
                onChangeText={setHourlyRate}
                placeholder="0.00"
                keyboardType="decimal-pad"
              />
              <Text style={styles.inputSuffix}>/ hour</Text>
            </View>
          </View>
        )}

        {/* Permissions (for employees) */}
        {role === 'employee' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Permissions</Text>

            <TouchableOpacity
              style={styles.permissionRow}
              onPress={() => setCanCreateJobs(!canCreateJobs)}
            >
              <View style={styles.permissionText}>
                <Text style={styles.permissionLabel}>Can Create Jobs</Text>
                <Text style={styles.permissionDescription}>Allow creating new jobs</Text>
              </View>
              <View style={[styles.checkbox, canCreateJobs && styles.checkboxActive]}>
                {canCreateJobs && <MaterialCommunityIcons name="check" size={16} color="#fff" />}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.permissionRow}
              onPress={() => setCanEditAllJobs(!canEditAllJobs)}
            >
              <View style={styles.permissionText}>
                <Text style={styles.permissionLabel}>Can Edit All Jobs</Text>
                <Text style={styles.permissionDescription}>Edit any job, not just created ones</Text>
              </View>
              <View style={[styles.checkbox, canEditAllJobs && styles.checkboxActive]}>
                {canEditAllJobs && <MaterialCommunityIcons name="check" size={16} color="#fff" />}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.permissionRow}
              onPress={() => setCanCreateInvoices(!canCreateInvoices)}
            >
              <View style={styles.permissionText}>
                <Text style={styles.permissionLabel}>Can Create Invoices</Text>
                <Text style={styles.permissionDescription}>Create and send invoices</Text>
              </View>
              <View style={[styles.checkbox, canCreateInvoices && styles.checkboxActive]}>
                {canCreateInvoices && <MaterialCommunityIcons name="check" size={16} color="#fff" />}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.permissionRow}
              onPress={() => setCanViewFinancials(!canViewFinancials)}
            >
              <View style={styles.permissionText}>
                <Text style={styles.permissionLabel}>Can View Financials</Text>
                <Text style={styles.permissionDescription}>View financial reports</Text>
              </View>
              <View style={[styles.checkbox, canViewFinancials && styles.checkboxActive]}>
                {canViewFinancials && <MaterialCommunityIcons name="check" size={16} color="#fff" />}
              </View>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={[styles.sendButton, sending && styles.sendButtonDisabled]}
          onPress={handleSendInvite}
          disabled={sending}
        >
          {sending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialCommunityIcons name="email-send" size={20} color="#fff" />
              <Text style={styles.sendButtonText}>Send Invitation</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 16,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111',
  },
  inputWithPrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  inputPrefix: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginRight: 4,
  },
  inputWithPrefixInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: '#111',
  },
  inputSuffix: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e5e5e5',
    marginBottom: 12,
  },
  roleOptionActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  roleTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  roleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 2,
  },
  roleLabelActive: {
    color: '#2563eb',
  },
  roleDescription: {
    fontSize: 13,
    color: '#666',
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  permissionText: {
    flex: 1,
  },
  permissionLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111',
    marginBottom: 2,
  },
  permissionDescription: {
    fontSize: 13,
    color: '#666',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  sendButton: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 8,
    marginBottom: 32,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
})
