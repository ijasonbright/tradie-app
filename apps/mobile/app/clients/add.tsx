import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { useState, useEffect } from 'react'
import { apiClient } from '../../lib/api-client'
import { MaterialCommunityIcons } from '@expo/vector-icons'

export default function AddClientScreen() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [organization, setOrganization] = useState<any>(null)

  // Form fields
  const [isCompany, setIsCompany] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [mobile, setMobile] = useState('')

  // Address fields
  const [siteAddressLine1, setSiteAddressLine1] = useState('')
  const [siteAddressLine2, setSiteAddressLine2] = useState('')
  const [siteCity, setSiteCity] = useState('')
  const [siteState, setSiteState] = useState('')
  const [sitePostcode, setSitePostcode] = useState('')

  const [notes, setNotes] = useState('')

  useEffect(() => {
    fetchOrganization()
  }, [])

  const fetchOrganization = async () => {
    try {
      setLoading(true)
      // Get organization ID from first job (workaround)
      const jobsResponse = await apiClient.getJobs()
      if (jobsResponse.jobs && jobsResponse.jobs.length > 0) {
        const orgId = jobsResponse.jobs[0].organization_id
        const orgName = jobsResponse.jobs[0].organization_name
        setOrganization({ id: orgId, name: orgName })
      }
    } catch (err: any) {
      console.error('Failed to fetch organization:', err)
      Alert.alert('Error', 'Failed to load organization')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    // Validation
    if (isCompany && !companyName.trim()) {
      Alert.alert('Validation Error', 'Company name is required')
      return
    }

    if (!isCompany && (!firstName.trim() || !lastName.trim())) {
      Alert.alert('Validation Error', 'First name and last name are required')
      return
    }

    if (!organization) {
      Alert.alert('Error', 'No organization found')
      return
    }

    try {
      setSaving(true)

      const clientData: any = {
        organization_id: organization.id,
        client_type: 'residential',
        is_company: isCompany,
        company_name: isCompany ? companyName.trim() : null,
        first_name: !isCompany ? firstName.trim() : null,
        last_name: !isCompany ? lastName.trim() : null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        mobile: mobile.trim() || null,
        site_address_line1: siteAddressLine1.trim() || null,
        site_address_line2: siteAddressLine2.trim() || null,
        site_city: siteCity.trim() || null,
        site_state: siteState.trim() || null,
        site_postcode: sitePostcode.trim() || null,
        notes: notes.trim() || null,
      }

      await apiClient.createClient(clientData)

      Alert.alert('Success', 'Client created successfully', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ])
    } catch (err: any) {
      console.error('Failed to create client:', err)
      Alert.alert('Error', err.message || 'Failed to create client')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Client Type Toggle */}
        <View style={styles.section}>
          <Text style={styles.label}>Client Type</Text>
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                !isCompany && styles.toggleButtonActive,
              ]}
              onPress={() => setIsCompany(false)}
            >
              <Text
                style={[
                  styles.toggleText,
                  !isCompany && styles.toggleTextActive,
                ]}
              >
                Individual
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                isCompany && styles.toggleButtonActive,
              ]}
              onPress={() => setIsCompany(true)}
            >
              <Text
                style={[
                  styles.toggleText,
                  isCompany && styles.toggleTextActive,
                ]}
              >
                Company
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Company Name or Individual Names */}
        {isCompany ? (
          <View style={styles.section}>
            <Text style={styles.label}>Company Name *</Text>
            <TextInput
              style={styles.input}
              value={companyName}
              onChangeText={setCompanyName}
              placeholder="Enter company name"
              placeholderTextColor="#999"
            />
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.label}>First Name *</Text>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Enter first name"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Last Name *</Text>
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Enter last name"
                placeholderTextColor="#999"
              />
            </View>
          </>
        )}

        {/* Contact Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Details</Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="email@example.com"
            placeholderTextColor="#999"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Phone</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="(02) 1234 5678"
            placeholderTextColor="#999"
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Mobile</Text>
          <TextInput
            style={styles.input}
            value={mobile}
            onChangeText={setMobile}
            placeholder="0412 345 678"
            placeholderTextColor="#999"
            keyboardType="phone-pad"
          />
        </View>

        {/* Site Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Site Address</Text>

          <Text style={styles.label}>Address Line 1</Text>
          <TextInput
            style={styles.input}
            value={siteAddressLine1}
            onChangeText={setSiteAddressLine1}
            placeholder="Street address"
            placeholderTextColor="#999"
          />

          <Text style={styles.label}>Address Line 2</Text>
          <TextInput
            style={styles.input}
            value={siteAddressLine2}
            onChangeText={setSiteAddressLine2}
            placeholder="Apt, suite, etc. (optional)"
            placeholderTextColor="#999"
          />

          <View style={styles.row}>
            <View style={styles.halfWidth}>
              <Text style={styles.label}>City</Text>
              <TextInput
                style={styles.input}
                value={siteCity}
                onChangeText={setSiteCity}
                placeholder="City"
                placeholderTextColor="#999"
              />
            </View>
            <View style={styles.halfWidth}>
              <Text style={styles.label}>State</Text>
              <TextInput
                style={styles.input}
                value={siteState}
                onChangeText={setSiteState}
                placeholder="State"
                placeholderTextColor="#999"
              />
            </View>
          </View>

          <Text style={styles.label}>Postcode</Text>
          <TextInput
            style={styles.input}
            value={sitePostcode}
            onChangeText={setSitePostcode}
            placeholder="Postcode"
            placeholderTextColor="#999"
            keyboardType="numeric"
          />
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Additional notes..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>
      </ScrollView>

      {/* Save Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialCommunityIcons name="check" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Create Client</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  toggleContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  toggleText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  toggleTextActive: {
    color: '#fff',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
    padding: 16,
  },
  saveButton: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
})
