import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native'
import { Avatar, List, Divider, Button } from 'react-native-paper'
import { useUser, useAuth } from '../../lib/auth'
import { useRouter } from 'expo-router'
import { MaterialCommunityIcons } from '@expo/vector-icons'

export default function MoreScreen() {
  const { user } = useUser()
  const { signOut } = useAuth()
  const router = useRouter()

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
    if (!user) return '?'
    const firstName = user.firstName || ''
    const lastName = user.lastName || ''
    return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase()
  }

  return (
    <ScrollView style={styles.container}>
      {/* Profile Section */}
      <View style={styles.profileSection}>
        <Avatar.Text
          size={80}
          label={getInitials()}
          style={styles.avatar}
        />
        <Text style={styles.name}>
          {user?.firstName} {user?.lastName}
        </Text>
        <Text style={styles.email}>{user?.primaryEmailAddress?.emailAddress}</Text>
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
          title="SMS & Messaging"
          description="View credits and conversations"
          left={(props) => <List.Icon {...props} icon="message-text" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => alert('SMS - Coming soon!')}
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
          title="Notifications"
          description="Manage push notifications"
          left={(props) => <List.Icon {...props} icon="bell" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => alert('Notifications - Coming soon!')}
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
