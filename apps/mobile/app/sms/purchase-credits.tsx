import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, RefreshControl } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useState, useEffect } from 'react'
import { useRouter } from 'expo-router'
import { apiClient } from '../../lib/api-client'
import * as WebBrowser from 'expo-web-browser'

// Credit bundles with pricing
const CREDIT_BUNDLES = [
  { size: '100', credits: 100, price: 5.00, popular: false },
  { size: '500', credits: 500, price: 25.00, popular: true },
  { size: '1000', credits: 1000, price: 50.00, popular: false },
  { size: '5000', credits: 5000, price: 250.00, popular: false },
]

export default function PurchaseCreditsScreen() {
  const router = useRouter()
  const [currentBalance, setCurrentBalance] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchBalance()
  }, [])

  const fetchBalance = async () => {
    try {
      const response = await apiClient.getSMSBalance()
      setCurrentBalance(response.credits)
    } catch (error) {
      console.error('Failed to fetch SMS balance:', error)
      Alert.alert('Error', 'Failed to load current balance')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const onRefresh = () => {
    setRefreshing(true)
    fetchBalance()
  }

  const handlePurchase = async (bundleSize: string) => {
    try {
      setPurchasing(bundleSize)

      // Call backend to create Stripe checkout session
      const response = await apiClient.purchaseSMSCredits(bundleSize)

      // Open Stripe Checkout in browser
      const result = await WebBrowser.openAuthSessionAsync(
        response.url,
        // Success/cancel URLs will be handled by Stripe and redirect back here
      )

      console.log('WebBrowser result:', result)

      // After browser closes, refresh the balance
      // (The webhook will have already added credits if payment succeeded)
      await fetchBalance()

      if (result.type === 'success') {
        Alert.alert('Success', 'Credits have been added to your account!')
      } else if (result.type === 'cancel') {
        Alert.alert('Cancelled', 'Purchase was cancelled')
      }
    } catch (error) {
      console.error('Purchase error:', error)
      Alert.alert('Error', 'Failed to initiate purchase. Please try again.')
    } finally {
      setPurchasing(null)
    }
  }

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`
  }

  const calculateCostPerSMS = (price: number, credits: number) => {
    const cost = (price / credits) * 100 // Cost in cents
    return `${cost.toFixed(1)}¢ per SMS`
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} tintColor="#2563eb" />
      }
    >
      {/* Current Balance Card */}
      <View style={styles.balanceCard}>
        <View style={styles.balanceHeader}>
          <MaterialCommunityIcons name="message-text" size={32} color="#2563eb" />
          <Text style={styles.balanceLabel}>Current Balance</Text>
        </View>
        <Text style={styles.balanceAmount}>{currentBalance.toLocaleString()}</Text>
        <Text style={styles.balanceSubtext}>SMS credits available</Text>
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <MaterialCommunityIcons name="information" size={20} color="#2563eb" />
        <Text style={styles.infoText}>
          Each SMS uses 1 credit per 160 characters. Credits never expire.
        </Text>
      </View>

      {/* Bundle Options */}
      <Text style={styles.sectionTitle}>Select a Bundle</Text>

      {CREDIT_BUNDLES.map((bundle) => (
        <TouchableOpacity
          key={bundle.size}
          style={[
            styles.bundleCard,
            bundle.popular && styles.bundleCardPopular,
            purchasing === bundle.size && styles.bundleCardDisabled,
          ]}
          onPress={() => handlePurchase(bundle.size)}
          disabled={purchasing !== null}
        >
          {bundle.popular && (
            <View style={styles.popularBadge}>
              <Text style={styles.popularText}>MOST POPULAR</Text>
            </View>
          )}

          <View style={styles.bundleHeader}>
            <View style={styles.bundleInfo}>
              <Text style={styles.bundleCredits}>{bundle.credits.toLocaleString()}</Text>
              <Text style={styles.bundleLabel}>SMS Credits</Text>
            </View>

            <View style={styles.bundlePrice}>
              <Text style={styles.priceAmount}>{formatCurrency(bundle.price)}</Text>
              <Text style={styles.priceSubtext}>{calculateCostPerSMS(bundle.price, bundle.credits)}</Text>
            </View>
          </View>

          <View style={styles.bundleFooter}>
            {purchasing === bundle.size ? (
              <ActivityIndicator color="#2563eb" />
            ) : (
              <>
                <MaterialCommunityIcons name="cart" size={20} color="#2563eb" />
                <Text style={styles.purchaseButtonText}>Purchase Bundle</Text>
              </>
            )}
          </View>
        </TouchableOpacity>
      ))}

      {/* Help Section */}
      <View style={styles.helpSection}>
        <Text style={styles.helpTitle}>How it works</Text>
        <View style={styles.helpItem}>
          <MaterialCommunityIcons name="numeric-1-circle" size={24} color="#666" />
          <Text style={styles.helpText}>Choose a bundle and tap to purchase</Text>
        </View>
        <View style={styles.helpItem}>
          <MaterialCommunityIcons name="numeric-2-circle" size={24} color="#666" />
          <Text style={styles.helpText}>Complete payment via secure Stripe checkout</Text>
        </View>
        <View style={styles.helpItem}>
          <MaterialCommunityIcons name="numeric-3-circle" size={24} color="#666" />
          <Text style={styles.helpText}>Credits added instantly to your account</Text>
        </View>
        <View style={styles.helpItem}>
          <MaterialCommunityIcons name="numeric-4-circle" size={24} color="#666" />
          <Text style={styles.helpText}>Use credits to send SMS from invoices and quotes</Text>
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  balanceCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  balanceLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  balanceAmount: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#2563eb',
    marginBottom: 4,
  },
  balanceSubtext: {
    fontSize: 14,
    color: '#999',
  },
  infoBanner: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2563eb20',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 16,
  },
  bundleCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e5e5e5',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  bundleCardPopular: {
    borderColor: '#2563eb',
    borderWidth: 2,
  },
  bundleCardDisabled: {
    opacity: 0.6,
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    right: 16,
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  bundleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  bundleInfo: {
    flex: 1,
  },
  bundleCredits: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#111',
  },
  bundleLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  bundlePrice: {
    alignItems: 'flex-end',
  },
  priceAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  priceSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  bundleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 8,
  },
  purchaseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563eb',
  },
  helpSection: {
    marginTop: 24,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 16,
  },
  helpItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  helpText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
})
