import { Stack } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PaperProvider } from 'react-native-paper'
import { Image, View, Text } from 'react-native'
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
  const { brandColor, logoUrl } = useTheme()

  // Custom header title component that shows logo
  const HeaderTitle = ({ children }: { children: string }) => {
    if (logoUrl) {
      return (
        <Image
          source={{ uri: logoUrl }}
          style={{ width: 120, height: 40 }}
          resizeMode="contain"
        />
      )
    }
    return (
      <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>
        {children}
      </Text>
    )
  }

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
        headerTitle: (props) => <HeaderTitle>{props.children as string}</HeaderTitle>,
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
