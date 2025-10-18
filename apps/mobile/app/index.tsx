import { View, Text, StyleSheet } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { useAuth } from '@clerk/clerk-expo'
import { Button } from 'react-native-paper'

export default function Index() {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tradie App</Text>
      <Text style={styles.subtitle}>Mobile App</Text>
      <Text style={styles.status}>
        {isSignedIn ? 'Signed In' : 'Not Signed In'}
      </Text>
      <StatusBar style="auto" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 20,
  },
  status: {
    fontSize: 16,
    color: '#333',
  },
})
