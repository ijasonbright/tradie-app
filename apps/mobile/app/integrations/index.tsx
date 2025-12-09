import { View, Text, StyleSheet, ScrollView, Alert, Linking } from 'react-native'
import { Button, Card, ActivityIndicator, Divider } from 'react-native-paper'
import { useState, useEffect, useCallback } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { Stack } from 'expo-router'
import { apiClient } from '../../lib/api-client'

interface TradieConnectStatus {
  connected: boolean
  tc_user_id?: string
  connected_at?: string
  last_synced_at?: string
  error?: string
}

export default function IntegrationsScreen() {
  const [tcStatus, setTcStatus] = useState<TradieConnectStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [validating, setValidating] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const response = await apiClient.getTradieConnectStatus()
      setTcStatus(response)
    } catch (error) {
      console.error('Failed to fetch TradieConnect status:', error)
      setTcStatus({ connected: false, error: 'Failed to fetch status' })
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch status on mount
  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  // Refetch when screen comes into focus (after returning from browser)
  useFocusEffect(
    useCallback(() => {
      fetchStatus()
    }, [fetchStatus])
  )

  const handleConnect = async () => {
    setConnecting(true)
    try {
      const response = await apiClient.getTradieConnectAuthUrl()
      if (response.authUrl) {
        // Open the auth URL in the browser
        const supported = await Linking.canOpenURL(response.authUrl)
        if (supported) {
          await Linking.openURL(response.authUrl)
          Alert.alert(
            'Complete Authentication',
            'Please complete the authentication in your browser. Return to this app when done.',
            [{ text: 'OK' }]
          )
        } else {
          Alert.alert('Error', 'Cannot open the authentication URL')
        }
      }
    } catch (error) {
      console.error('Failed to initiate connection:', error)
      Alert.alert('Error', 'Failed to initiate TradieConnect connection')
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect TradieConnect',
      'Are you sure you want to disconnect your TradieConnect account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            setDisconnecting(true)
            try {
              const response = await apiClient.disconnectTradieConnect()
              if (response.success) {
                Alert.alert('Success', 'Successfully disconnected from TradieConnect')
                setTcStatus({ connected: false })
              } else {
                Alert.alert('Error', response.message || 'Failed to disconnect')
              }
            } catch (error) {
              console.error('Failed to disconnect:', error)
              Alert.alert('Error', 'Failed to disconnect from TradieConnect')
            } finally {
              setDisconnecting(false)
            }
          },
        },
      ]
    )
  }

  const handleValidate = async () => {
    setValidating(true)
    try {
      const response = await apiClient.validateTradieConnect()
      if (response.valid) {
        Alert.alert(
          'Success',
          response.refreshed
            ? 'Token refreshed successfully!'
            : 'TradieConnect connection is valid!'
        )
        fetchStatus()
      } else if (response.needs_reconnect) {
        Alert.alert(
          'Session Expired',
          'Your TradieConnect session has expired. Please reconnect.'
        )
      } else {
        Alert.alert('Error', response.error || 'Validation failed')
      }
    } catch (error) {
      console.error('Failed to validate:', error)
      Alert.alert('Error', 'Failed to validate TradieConnect connection')
    } finally {
      setValidating(false)
    }
  }

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleString()
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ title: 'Integrations' }} />
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    )
  }

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen options={{ title: 'Integrations' }} />

      {/* TradieConnect Card */}
      <Card style={styles.card}>
        <Card.Title
          title="TradieConnect"
          subtitle="Connect your TradieConnect account to sync your assigned jobs"
          left={(props) => (
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>🔗</Text>
            </View>
          )}
          right={(props) => (
            <View style={styles.statusBadge}>
              <Text
                style={[
                  styles.statusText,
                  tcStatus?.connected ? styles.connectedText : styles.disconnectedText,
                ]}
              >
                {tcStatus?.connected ? 'Connected' : 'Not Connected'}
              </Text>
            </View>
          )}
        />
        <Card.Content>
          {tcStatus?.connected ? (
            <>
              {/* Connection Details */}
              <View style={styles.detailsContainer}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>TradieConnect User ID</Text>
                  <Text style={styles.detailValue}>{tcStatus.tc_user_id}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Connected</Text>
                  <Text style={styles.detailValue}>{formatDate(tcStatus.connected_at)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Last Synced</Text>
                  <Text style={styles.detailValue}>{formatDate(tcStatus.last_synced_at)}</Text>
                </View>
              </View>

              <Divider style={styles.divider} />

              {/* Action Buttons */}
              <View style={styles.buttonRow}>
                <Button
                  mode="contained"
                  onPress={handleValidate}
                  loading={validating}
                  disabled={validating}
                  style={styles.button}
                >
                  Test Connection
                </Button>
                <Button
                  mode="outlined"
                  onPress={handleDisconnect}
                  loading={disconnecting}
                  disabled={disconnecting}
                  textColor="#ef4444"
                  style={[styles.button, styles.disconnectButton]}
                >
                  Disconnect
                </Button>
              </View>
            </>
          ) : (
            <Button
              mode="contained"
              onPress={handleConnect}
              loading={connecting}
              disabled={connecting}
              style={styles.connectButton}
            >
              Connect to TradieConnect
            </Button>
          )}
        </Card.Content>
      </Card>

      {/* Future Integrations Placeholder */}
      <Card style={[styles.card, styles.placeholderCard]}>
        <Card.Content style={styles.placeholderContent}>
          <Text style={styles.placeholderIcon}>🔌</Text>
          <Text style={styles.placeholderTitle}>More Integrations Coming Soon</Text>
          <Text style={styles.placeholderSubtitle}>Xero, QuickBooks, and more</Text>
        </Card.Content>
      </Card>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  card: {
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  iconContainer: {
    width: 40,
    height: 40,
    backgroundColor: '#dbeafe',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 20,
  },
  statusBadge: {
    marginRight: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  connectedText: {
    color: '#16a34a',
  },
  disconnectedText: {
    color: '#6b7280',
  },
  detailsContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  detailValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 8,
  },
  divider: {
    marginVertical: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
  },
  disconnectButton: {
    borderColor: '#ef4444',
  },
  connectButton: {
    marginTop: 8,
  },
  placeholderCard: {
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
  },
  placeholderContent: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  placeholderIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  placeholderTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6b7280',
  },
  placeholderSubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
  },
})
