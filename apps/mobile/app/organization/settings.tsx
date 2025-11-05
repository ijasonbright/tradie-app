import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Image } from 'react-native'
import { useState, useEffect } from 'react'
import { useRouter } from 'expo-router'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { apiClient } from '../../lib/api-client'

export default function OrganizationSettingsScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [organization, setOrganization] = useState<any>(null)

  const [name, setName] = useState('')
  const [abn, setAbn] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [addressLine1, setAddressLine1] = useState('')
  const [addressLine2, setAddressLine2] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [postcode, setPostcode] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  useEffect(() => {
    fetchOrganization()
  }, [])

  const fetchOrganization = async () => {
    try {
      const response = await apiClient.getCurrentOrganization()
      const org = response.organization

      setOrganization(org)
      setName(org.name || '')
      setAbn(org.abn || '')
      setPhone(org.phone || '')
      setEmail(org.email || '')
      setAddressLine1(org.address_line1 || '')
      setAddressLine2(org.address_line2 || '')
      setCity(org.city || '')
      setState(org.state || '')
      setPostcode(org.postcode || '')
      setLogoUrl(org.logo_url)
    } catch (err: any) {
      console.error('Failed to fetch organization:', err)
      Alert.alert('Error', 'Failed to load organization details')
    } finally {
      setLoading(false)
    }
  }

  const handleChooseLogo = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync()

    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photo library')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    })

    if (!result.canceled && result.assets[0]) {
      setLogoUrl(result.assets[0].uri)
    }
  }

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Business name is required')
      return
    }

    try {
      setSaving(true)

      await apiClient.updateOrganization({
        name: name.trim(),
        abn: abn.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address_line1: addressLine1.trim(),
        address_line2: addressLine2.trim(),
        city: city.trim(),
        state: state.trim(),
        postcode: postcode.trim(),
        logo_url: logoUrl,
      })

      Alert.alert('Success', 'Organization updated successfully')
      router.back()
    } catch (err: any) {
      console.error('Failed to update organization:', err)
      Alert.alert('Error', err.message || 'Failed to update organization')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading organization...</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Logo Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Business Logo</Text>
          <TouchableOpacity onPress={handleChooseLogo} style={styles.logoContainer}>
            {logoUrl ? (
              <Image source={{ uri: logoUrl }} style={styles.logo} resizeMode="contain" />
            ) : (
              <View style={styles.logoPlaceholder}>
                <MaterialCommunityIcons name="image-plus" size={48} color="#999" />
                <Text style={styles.logoPlaceholderText}>Tap to add logo</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Business Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Business Details</Text>

          <Text style={styles.label}>Business Name *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Enter business name"
            autoCapitalize="words"
          />

          <Text style={styles.label}>ABN</Text>
          <TextInput
            style={styles.input}
            value={abn}
            onChangeText={setAbn}
            placeholder="XX XXX XXX XXX"
            keyboardType="number-pad"
          />
        </View>

        {/* Contact Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>

          <Text style={styles.label}>Phone</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="Enter phone number"
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Enter email address"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        {/* Business Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Business Address</Text>

          <Text style={styles.label}>Address Line 1</Text>
          <TextInput
            style={styles.input}
            value={addressLine1}
            onChangeText={setAddressLine1}
            placeholder="Street address"
          />

          <Text style={styles.label}>Address Line 2</Text>
          <TextInput
            style={styles.input}
            value={addressLine2}
            onChangeText={setAddressLine2}
            placeholder="Unit, suite, etc. (optional)"
          />

          <View style={styles.row}>
            <View style={styles.flex1}>
              <Text style={styles.label}>City</Text>
              <TextInput
                style={styles.input}
                value={city}
                onChangeText={setCity}
                placeholder="City"
              />
            </View>
            <View style={styles.spacer} />
            <View style={styles.flex1}>
              <Text style={styles.label}>State</Text>
              <TextInput
                style={styles.input}
                value={state}
                onChangeText={setState}
                placeholder="State"
              />
            </View>
          </View>

          <Text style={styles.label}>Postcode</Text>
          <TextInput
            style={styles.input}
            value={postcode}
            onChangeText={setPostcode}
            placeholder="Postcode"
            keyboardType="number-pad"
          />
        </View>

        {/* SMS Credits Info */}
        {organization?.sms_credits !== undefined && (
          <View style={styles.infoCard}>
            <MaterialCommunityIcons name="message-text" size={24} color="#2563eb" />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoTitle}>SMS Credits</Text>
              <Text style={styles.infoValue}>{organization.sms_credits} credits remaining</Text>
            </View>
            <TouchableOpacity
              style={styles.infoButton}
              onPress={() => router.push('/sms/purchase-credits')}
            >
              <Text style={styles.infoButtonText}>Buy More</Text>
            </TouchableOpacity>
          </View>
        )}

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
              <Text style={styles.saveButtonText}>Save Changes</Text>
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
  scrollContent: {
    padding: 16,
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
  logoContainer: {
    height: 120,
    backgroundColor: '#f9f9f9',
    borderWidth: 2,
    borderColor: '#e5e5e5',
    borderStyle: 'dashed',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  logoPlaceholder: {
    alignItems: 'center',
    gap: 8,
  },
  logoPlaceholderText: {
    fontSize: 14,
    color: '#999',
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
  row: {
    flexDirection: 'row',
  },
  flex1: {
    flex: 1,
  },
  spacer: {
    width: 12,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  infoButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  infoButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  saveButton: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 8,
    marginBottom: 32,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
})
