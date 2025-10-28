import { Slot } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PaperProvider } from 'react-native-paper'
import { AuthProvider } from '../lib/auth'

const queryClient = new QueryClient()

export default function RootLayout() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <PaperProvider>
          <Slot />
        </PaperProvider>
      </QueryClientProvider>
    </AuthProvider>
  )
}
