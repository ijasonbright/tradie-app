import { View, StyleSheet, Alert } from 'react-native'
import { Button, Card, Text } from 'react-native-paper'
import { useState } from 'react'
import { apiClient } from '../lib/api-client'

export default function TestNotificationScreen() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string>('')

  const sendTestNotification = async () => {
    setLoading(true)
    setResult('')
    try {
      const response = await apiClient.sendTestPushNotification()
      setResult(`✅ ${response.message}`)
      Alert.alert(
        'Success!',
        'Test notification sent. You should receive it shortly.',
        [{ text: 'OK' }]
      )
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setResult(`❌ Error: ${errorMessage}`)
      Alert.alert(
        'Error',
        `Failed to send notification: ${errorMessage}`,
        [{ text: 'OK' }]
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="headlineSmall" style={styles.title}>
            Test Push Notifications
          </Text>
          <Text variant="bodyMedium" style={styles.description}>
            Send a test notification to your device to verify that push notifications are working correctly.
          </Text>

          <Button
            mode="contained"
            onPress={sendTestNotification}
            loading={loading}
            disabled={loading}
            style={styles.button}
            icon="bell-ring"
          >
            Send Test Notification
          </Button>

          {result ? (
            <Card style={styles.resultCard}>
              <Card.Content>
                <Text variant="bodyMedium">{result}</Text>
              </Card.Content>
            </Card>
          ) : null}

          <Card style={styles.infoCard}>
            <Card.Content>
              <Text variant="titleSmall" style={styles.infoTitle}>
                ℹ️ Testing Tips
              </Text>
              <Text variant="bodySmall" style={styles.infoText}>
                • Make sure you've granted notification permissions{'\n'}
                • Notifications may take a few seconds to arrive{'\n'}
                • If the app is in the foreground, you'll see an in-app notification{'\n'}
                • If the app is in the background, you'll see a system notification
              </Text>
            </Card.Content>
          </Card>
        </Card.Content>
      </Card>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  card: {
    marginBottom: 16,
  },
  title: {
    marginBottom: 8,
    fontWeight: 'bold',
  },
  description: {
    marginBottom: 24,
    color: '#666',
  },
  button: {
    marginBottom: 16,
  },
  resultCard: {
    marginBottom: 16,
    backgroundColor: '#f0f0f0',
  },
  infoCard: {
    backgroundColor: '#e3f2fd',
  },
  infoTitle: {
    marginBottom: 8,
    fontWeight: 'bold',
  },
  infoText: {
    lineHeight: 20,
  },
})
