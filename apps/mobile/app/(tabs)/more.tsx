import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native'
import { Avatar, List, Divider, Button } from 'react-native-paper'
import { useUser, useAuth } from '../../lib/auth'
import { useRouter } from 'expo-router'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useState, useEffect, useCallback } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { apiClient } from '../../lib/api-client'

export default function MoreScreen() {
  const { user: clerkUser } = useUser()
  const { signOut } = useAuth()
  const router = useRouter()
  const [dbUser, setDbUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Fetch user data from database
  const fetchUserProfile = useCallback(async () => {
    try {
      const response = await apiClient.getCurrentUser()
      setDbUser(response.user)
    } catch (error) {
      console.error('Failed to fetch user profile:', error)
      // Fallback to Clerk data if API fails
      setDbUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    if (clerkUser) {
      fetchUserProfile()
    }
  }, [clerkUser, fetchUserProfile])

  // Refetch when screen comes into focus (after editing profile)
  useFocusEffect(
    useCallback(() => {
      if (clerkUser) {
        fetchUserProfile()
      }
    }, [clerkUser, fetchUserProfile])
  )

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut()
          router.replace('/(auth)/sign-in')
        },
      },
    ])
  }

  const getInitials = () => {
    // Use database user's full_name or fall back to Clerk
    const name = dbUser?.full_name || `${clerkUser?.firstName || ''} ${clerkUser?.lastName || ''}`.trim()
    if (!name) return '?'

    const parts = name.split(' ')
    if (parts.length >= 2) {
      return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase()
    }
    return (name[0] || '?').toUpperCase()
  }

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    )
  }

  // Use database user data or fall back to Clerk
  const displayName = dbUser?.full_name || `${clerkUser?.firstName || ''} ${clerkUser?.lastName || ''}`.trim() || 'User'
  const displayEmail = dbUser?.email || clerkUser?.primaryEmailAddress?.emailAddress || ''
  const displayPhone = dbUser?.phone || clerkUser?.primaryPhoneNumber?.phoneNumber || ''
  const displayPhoto = dbUser?.profile_photo_url || clerkUser?.imageUrl

  return (
    <ScrollView style={styles.container}>
      {/* Profile Section */}
      <View style={styles.profileSection}>
        {displayPhoto ? (
          <Avatar.Image
            size={80}
            source={{ uri: displayPhoto }}
            style={styles.avatar}
          />
        ) : (
          <Avatar.Text
            size={80}
            label={getInitials()}
            style={styles.avatar}
          />
        )}
        <Text style={styles.name}>
          {displayName}
        </Text>
        <Text style={styles.email}>{displayEmail}</Text>
        {displayPhone && <Text style={styles.phone}>{displayPhone}</Text>}
        <Button
          mode="outlined"
          onPress={() => router.push('/profile/edit')}
          style={styles.editButton}
        >
          Edit Profile
        </Button>
      </View>

      <Divider />

      {/* Settings Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ORGANIZATION</Text>

        <List.Item
          title="My Organization"
          description="View and manage organization"
          left={(props) => <List.Icon {...props} icon="domain" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/organization/settings')}
        />

        <List.Item
          title="Team Members"
          description="Manage team and permissions"
          left={(props) => <List.Icon {...props} icon="account-group" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/team')}
        />

        <List.Item
          title="Documents"
          description="Licenses and certificates"
          left={(props) => <List.Icon {...props} icon="file-document" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/documents')}
        />

        <List.Item
          title="Reminders & Statements"
          description="Automated invoice reminders and monthly statements"
          left={(props) => <List.Icon {...props} icon="bell-alert" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/organization/reminders')}
        />
      </View>

      <Divider />

      {/* Features Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>FEATURES</Text>

        <List.Item
          title="Clients"
          description="View and manage all clients"
          left={(props) => <List.Icon {...props} icon="account-multiple" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/clients')}
        />

        <List.Item
          title="Asset Register"
          description="Property inspections and asset tracking"
          left={(props) => <List.Icon {...props} icon="clipboard-list" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/asset-register')}
        />

        <List.Item
          title="SMS & Messaging"
          description="Purchase credits and send messages"
          left={(props) => <List.Icon {...props} icon="message-text" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/sms/purchase-credits')}
        />

        <List.Item
          title="Reports"
          description="Financial and performance reports"
          left={(props) => <List.Icon {...props} icon="chart-line" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => alert('Reports - Coming soon!')}
        />

        <List.Item
          title="Integrations"
          description="Xero, Stripe, and more"
          left={(props) => <List.Icon {...props} icon="link-variant" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => alert('Integrations - Coming soon!')}
        />
      </View>

      <Divider />

      {/* App Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>APP SETTINGS</Text>

        <List.Item
          title="Location Tracking"
          description="Share your location with team"
          left={(props) => <List.Icon {...props} icon="map-marker-radius" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/profile/location')}
        />

        <List.Item
          title="Notifications"
          description="Manage push notifications"
          left={(props) => <List.Icon {...props} icon="bell" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => alert('Notifications - Coming soon!')}
        />

        <List.Item
          title="Test Push Notification"
          description="Send a test notification to this device"
          left={(props) => <List.Icon {...props} icon="bell-ring" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/test-notification')}
        />

        <List.Item
          title="Privacy & Security"
          description="Manage your data and security"
          left={(props) => <List.Icon {...props} icon="shield-lock" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => alert('Privacy - Coming soon!')}
        />

        <List.Item
          title="Help & Support"
          description="Get help and contact support"
          left={(props) => <List.Icon {...props} icon="help-circle" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => alert('Help - Coming soon!')}
        />

        <List.Item
          title="About"
          description="Version 0.1.0"
          left={(props) => <List.Icon {...props} icon="information" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => alert('Tradie App v0.1.0\\nPhase 1: MVP Complete')}
        />
      </View>

      <Divider />

      {/* Sign Out */}
      <View style={styles.section}>
        <Button
          mode="outlined"
          onPress={handleSignOut}
          style={styles.signOutButton}
          textColor="#ef4444"
        >
          Sign Out
        </Button>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Made with ❤️ for tradies</Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  profileSection: {
    backgroundColor: '#fff',
    alignItems: 'center',
    padding: 24,
    paddingTop: 32,
  },
  avatar: {
    backgroundColor: '#2563eb',
    marginBottom: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  phone: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  editButton: {
    borderColor: '#2563eb',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 1,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    paddingHorizontal: 16,
    paddingVertical: 8,
    letterSpacing: 1,
  },
  signOutButton: {
    margin: 16,
    borderColor: '#ef4444',
  },
  footer: {
    alignItems: 'center',
    padding: 24,
  },
  footerText: {
    fontSize: 12,
    color: '#999',
  },
})
