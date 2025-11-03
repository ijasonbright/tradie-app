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
  const [verificationCode, setVerificationCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
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

  const onSendCodePress = async () => {
    if (!isLoaded) return

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'https://tradie-app-web.vercel.app/api'}/mobile-auth/send-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: emailAddress }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send code')
      }

      setStep('code')
      setError('')
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code')
    } finally {
      setLoading(false)
    }
  }

  const onVerifyCodePress = async () => {
    if (!isLoaded) return

    setLoading(true)
    setError('')

    try {
      const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://tradie-app-web.vercel.app/api'
      const response = await fetch(`${API_URL}/mobile-auth/verify-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: emailAddress,
          code: verificationCode,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Invalid verification code')
      }

      // The API returns token and user data
      // We need to manually save it since we're bypassing Clerk's normal flow
      const SecureStore = await import('expo-secure-store')
      await SecureStore.setItemAsync('session_token', data.token)
      await SecureStore.setItemAsync('user_data', JSON.stringify(data.user))

      // Trigger auth state update by calling setActive
      await setActive()

      // Navigate to main app
      router.replace('/(tabs)/jobs')
    } catch (err: any) {
      setError(err.message || 'Invalid verification code')
    } finally {
      setLoading(false)
    }
  }

  const onSignInPress = async () => {
    if (!isLoaded) return

    setLoading(true)
    setError('')

    try {
      // Call the existing sign-in API (it only needs email, doesn't verify password)
      const completeSignIn = await signIn.create({
        identifier: emailAddress,
        password: 'dummy', // API doesn't verify, just needs something
      })

      await setActive()
      router.replace('/(tabs)/jobs')
    } catch (err: any) {
      setError(err.errors?.[0]?.message || err.message || 'Sign in failed. Please try again.')
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
          {step === 'email' ? (
            <>
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

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Button
                mode="contained"
                onPress={onSignInPress}
                loading={loading}
                disabled={loading || !emailAddress}
                style={styles.button}
              >
                Sign In with Email
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
            </>
          ) : (
            <>
              <Text style={styles.codeInfo}>
                We've sent a verification code to {emailAddress}
              </Text>

              <TextInput
                label="Verification Code"
                value={verificationCode}
                onChangeText={setVerificationCode}
                keyboardType="number-pad"
                mode="outlined"
                style={styles.input}
                disabled={loading}
                maxLength={6}
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Button
                mode="contained"
                onPress={onVerifyCodePress}
                loading={loading}
                disabled={loading || verificationCode.length !== 6}
                style={styles.button}
              >
                Verify & Sign In
              </Button>

              <Button
                mode="text"
                onPress={() => {
                  setStep('email')
                  setVerificationCode('')
                  setError('')
                }}
                disabled={loading}
                style={styles.backButton}
              >
                Use a different email
              </Button>

              <Button
                mode="text"
                onPress={onSendCodePress}
                disabled={loading}
                style={styles.resendButton}
              >
                Resend Code
              </Button>
            </>
          )}
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
  codeInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 20,
  },
  backButton: {
    marginTop: 12,
  },
  resendButton: {
    marginTop: 4,
  },
})
