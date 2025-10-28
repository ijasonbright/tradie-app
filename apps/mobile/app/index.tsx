import { View, Text, StyleSheet } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { Button } from 'react-native-paper'

export default function Index() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔨 Tradie App</Text>
      <Text style={styles.subtitle}>Mobile Version</Text>
      <Text style={styles.info}>React Native + Expo</Text>
      <Text style={styles.info}>Ready to build! 🚀</Text>
      <Button
        mode="contained"
        style={styles.button}
        onPress={() => alert('Phase 1 Coming Soon!')}
      >
        Get Started
      </Button>
      <StatusBar style="auto" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 40,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#2563eb',
  },
  subtitle: {
    fontSize: 20,
    color: '#666',
    marginBottom: 10,
  },
  info: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  button: {
    marginTop: 30,
    paddingHorizontal: 20,
  },
})
