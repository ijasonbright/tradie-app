import { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native'
import { TextInput, Button } from 'react-native-paper'
import { useSignIn, useAuth } from '../../lib/auth'
import { useRouter, Link } from 'expo-router'
import { StatusBar } from 'expo-status-bar'

export default function SignIn() {
  const { signIn, signInWithOAuth, setActive, isLoaded } = useSignIn()
  const { isSignedIn } = useAuth()
  const router = useRouter()

  const [emailAddress, setEmailAddress] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOAuthLoading] = useState(false)

  // Navigate to main app when OAuth completes
  useEffect(() => {
    if (isSignedIn) {
      setOAuthLoading(false)
      router.replace('/(tabs)/jobs')
    }
  }, [isSignedIn, router])

  const onSignInPress = async () => {
    if (!isLoaded) return

    setLoading(true)
    setError('')

    try {
      const completeSignIn = await signIn.create({
        identifier: emailAddress,
        password,
      })

      await setActive()
      router.replace('/(tabs)/jobs')
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  const onOAuthSignIn = async () => {
    if (!isLoaded) return

    setOAuthLoading(true)
    setError('')

    try {
      await signInWithOAuth()
      // Browser will open for sign-in
      // Don't redirect here - the deep link handler in auth.tsx will handle it
    } catch (err: any) {
      setError(err.message || 'Sign in failed')
      setOAuthLoading(false)
    }
    // Keep loading state active until deep link callback completes
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.logo}>🔨</Text>
          <Text style={styles.title}>Tradie App</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            label="Email"
            value={emailAddress}
            onChangeText={setEmailAddress}
            autoCapitalize="none"
            keyboardType="email-address"
            mode="outlined"
            style={styles.input}
            disabled={loading}
          />

          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            mode="outlined"
            style={styles.input}
            disabled={loading}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            mode="contained"
            onPress={onSignInPress}
            loading={loading}
            disabled={loading || !emailAddress || !password}
            style={styles.button}
          >
            Sign In
          </Button>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <Button
            mode="outlined"
            onPress={onOAuthSignIn}
            loading={oauthLoading}
            disabled={oauthLoading || loading}
            style={styles.oauthButton}
            icon="apple"
          >
            Sign in with Apple
          </Button>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Link href="/(auth)/sign-up" asChild>
              <Text style={styles.link}>Sign Up</Text>
            </Link>
          </View>
        </View>
      </ScrollView>
      <StatusBar style="auto" />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 60,
    marginBottom: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2563eb',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  form: {
    width: '100%',
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
    paddingVertical: 8,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#666',
    fontSize: 14,
  },
  oauthButton: {
    paddingVertical: 8,
    borderColor: '#2563eb',
  },
  error: {
    color: '#ef4444',
    marginBottom: 12,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    color: '#666',
    fontSize: 14,
  },
  link: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '600',
  },
})
