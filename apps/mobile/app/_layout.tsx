import { Stack } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PaperProvider } from 'react-native-paper'
import { AuthProvider } from '../lib/auth'
import { ThemeProvider } from '../context/ThemeContext'

const queryClient = new QueryClient()

export default function RootLayout() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <PaperProvider>
            <ThemedStack />
          </PaperProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </AuthProvider>
  )
}

// Separate component to access theme context
function ThemedStack() {
  // Dynamic import to avoid circular dependency
  const { useTheme } = require('../context/ThemeContext')
  const { brandColor } = useTheme()

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: brandColor,
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="(auth)"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="(tabs)"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="job/[id]"
        options={{
          presentation: 'card',
          headerShown: true,
        }}
      />
    </Stack>
  )
}
