import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { useState, useEffect } from 'react'
import { apiClient } from '../../../lib/api-client'
import { MaterialCommunityIcons } from '@expo/vector-icons'

export default function EditClientScreen() {
  const { id } = useLocalSearchParams()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Client type
  const [isCompany, setIsCompany] = useState(false)

  // Form fields
  const [companyName, setCompanyName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [mobile, setMobile] = useState('')
  const [abn, setAbn] = useState('')

  // Site address
  const [siteAddressLine1, setSiteAddressLine1] = useState('')
  const [siteAddressLine2, setSiteAddressLine2] = useState('')
  const [siteCity, setSiteCity] = useState('')
  const [siteState, setSiteState] = useState('')
  const [sitePostcode, setSitePostcode] = useState('')

  // Billing address
  const [billingSameAsSite, setBillingSameAsSite] = useState(true)
  const [billingAddressLine1, setBillingAddressLine1] = useState('')
  const [billingAddressLine2, setBillingAddressLine2] = useState('')
  const [billingCity, setBillingCity] = useState('')
  const [billingState, setBillingState] = useState('')
  const [billingPostcode, setBillingPostcode] = useState('')

  const [notes, setNotes] = useState('')

  // Fetch client data
  useEffect(() => {
    fetchClient()
  }, [id])

  const fetchClient = async () => {
    try {
      setLoading(true)
      const response = await apiClient.getClient(id as string)
      const client = response.client

      // Populate form fields
      setIsCompany(client.is_company || false)
      setCompanyName(client.company_name || '')
      setFirstName(client.first_name || '')
      setLastName(client.last_name || '')
      setEmail(client.email || '')
      setPhone(client.phone || '')
      setMobile(client.mobile || '')
      setAbn(client.abn || '')

      setSiteAddressLine1(client.site_address_line1 || '')
      setSiteAddressLine2(client.site_address_line2 || '')
      setSiteCity(client.site_city || '')
      setSiteState(client.site_state || '')
      setSitePostcode(client.site_postcode || '')

      setBillingSameAsSite(client.billing_address_same_as_site !== false)
      setBillingAddressLine1(client.billing_address_line1 || '')
      setBillingAddressLine2(client.billing_address_line2 || '')
      setBillingCity(client.billing_city || '')
      setBillingState(client.billing_state || '')
      setBillingPostcode(client.billing_postcode || '')

      setNotes(client.notes || '')
    } catch (err: any) {
      console.error('Failed to fetch client:', err)
      Alert.alert('Error', 'Failed to load client details')
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

    try {
      setSaving(true)

      const updateData: any = {
        is_company: isCompany,
        company_name: isCompany ? companyName.trim() : null,
        first_name: !isCompany ? firstName.trim() : null,
        last_name: !isCompany ? lastName.trim() : null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        mobile: mobile.trim() || null,
        abn: abn.trim() || null,
        site_address_line1: siteAddressLine1.trim() || null,
        site_address_line2: siteAddressLine2.trim() || null,
        site_city: siteCity.trim() || null,
        site_state: siteState.trim() || null,
        site_postcode: sitePostcode.trim() || null,
        billing_address_same_as_site: billingSameAsSite,
        billing_address_line1: !billingSameAsSite ? billingAddressLine1.trim() || null : null,
        billing_address_line2: !billingSameAsSite ? billingAddressLine2.trim() || null : null,
        billing_city: !billingSameAsSite ? billingCity.trim() || null : null,
        billing_state: !billingSameAsSite ? billingState.trim() || null : null,
        billing_postcode: !billingSameAsSite ? billingPostcode.trim() || null : null,
        notes: notes.trim() || null,
      }

      await apiClient.updateClient(id as string, updateData)

      Alert.alert('Success', 'Client updated successfully', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ])
    } catch (err: any) {
      console.error('Failed to update client:', err)
      Alert.alert('Error', err.message || 'Failed to update client')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Edit Client' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading client details...</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Edit Client' }} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Client Type Toggle */}
        <View style={styles.section}>
          <Text style={styles.label}>Client Type</Text>
          <View style={styles.typeToggle}>
            <TouchableOpacity
              style={[styles.typeButton, !isCompany && styles.typeButtonActive]}
              onPress={() => setIsCompany(false)}
            >
              <Text style={[styles.typeButtonText, !isCompany && styles.typeButtonTextActive]}>
                Individual
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, isCompany && styles.typeButtonActive]}
              onPress={() => setIsCompany(true)}
            >
              <Text style={[styles.typeButtonText, isCompany && styles.typeButtonTextActive]}>
                Company
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Company Name or Individual Name */}
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

        {/* Contact Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>

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
            placeholder="+61 2 1234 5678"
            placeholderTextColor="#999"
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Mobile</Text>
          <TextInput
            style={styles.input}
            value={mobile}
            onChangeText={setMobile}
            placeholder="+61 412 345 678"
            placeholderTextColor="#999"
            keyboardType="phone-pad"
          />

          {isCompany && (
            <>
              <Text style={styles.label}>ABN</Text>
              <TextInput
                style={styles.input}
                value={abn}
                onChangeText={setAbn}
                placeholder="12 345 678 901"
                placeholderTextColor="#999"
                keyboardType="number-pad"
              />
            </>
          )}
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

        {/* Billing Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Billing Address</Text>

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setBillingSameAsSite(!billingSameAsSite)}
          >
            <MaterialCommunityIcons
              name={billingSameAsSite ? 'checkbox-marked' : 'checkbox-blank-outline'}
              size={24}
              color={billingSameAsSite ? '#2563eb' : '#999'}
            />
            <Text style={styles.checkboxLabel}>Same as site address</Text>
          </TouchableOpacity>

          {!billingSameAsSite && (
            <>
              <Text style={styles.label}>Address Line 1</Text>
              <TextInput
                style={styles.input}
                value={billingAddressLine1}
                onChangeText={setBillingAddressLine1}
                placeholder="Street address"
                placeholderTextColor="#999"
              />

              <Text style={styles.label}>Address Line 2</Text>
              <TextInput
                style={styles.input}
                value={billingAddressLine2}
                onChangeText={setBillingAddressLine2}
                placeholder="Apt, suite, etc. (optional)"
                placeholderTextColor="#999"
              />

              <View style={styles.row}>
                <View style={styles.halfWidth}>
                  <Text style={styles.label}>City</Text>
                  <TextInput
                    style={styles.input}
                    value={billingCity}
                    onChangeText={setBillingCity}
                    placeholder="City"
                    placeholderTextColor="#999"
                  />
                </View>
                <View style={styles.halfWidth}>
                  <Text style={styles.label}>State</Text>
                  <TextInput
                    style={styles.input}
                    value={billingState}
                    onChangeText={setBillingState}
                    placeholder="State"
                    placeholderTextColor="#999"
                  />
                </View>
              </View>

              <Text style={styles.label}>Postcode</Text>
              <TextInput
                style={styles.input}
                value={billingPostcode}
                onChangeText={setBillingPostcode}
                placeholder="Postcode"
                placeholderTextColor="#999"
                keyboardType="numeric"
              />
            </>
          )}
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Additional notes about this client"
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
              <MaterialCommunityIcons name="content-save" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Save Changes</Text>
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
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 8,
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
  typeToggle: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  typeButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#333',
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
