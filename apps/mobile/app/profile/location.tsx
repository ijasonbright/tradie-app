import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, ActivityIndicator, Alert } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useTheme } from '../../context/ThemeContext'
import { useLocationTracking } from '../../hooks/useLocationTracking'

export default function LocationSettingsScreen() {
  const router = useRouter()
  const { brandColor } = useTheme()
  const location = useLocationTracking()

  const handleToggleTracking = async () => {
    if (!location.hasPermission && !location.isEnabled) {
      // First time enabling, request permissions
      const granted = await location.requestPermissions()
      if (granted) {
        await location.enableTracking()
      }
    } else {
      // Toggle existing tracking
      await location.toggleTracking()
    }
  }

  const handleRequestPermissions = async () => {
    const granted = await location.requestPermissions()
    if (granted) {
      Alert.alert(
        'Permissions Granted',
        'You can now enable location tracking to share your location with your team.',
        [{ text: 'OK' }]
      )
    }
  }

  const handleUpdateLocation = async () => {
    await location.updateCurrentLocation()
    Alert.alert('Success', 'Your current location has been updated', [{ text: 'OK' }])
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Location Settings',
          headerBackTitle: 'Back',
        }}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header Card */}
        <View style={styles.card}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons
              name="map-marker-radius"
              size={48}
              color={brandColor}
            />
          </View>
          <Text style={styles.title}>Team Location Tracking</Text>
          <Text style={styles.description}>
            Share your real-time location with your team to improve job coordination and assignment.
            Your location is only visible to team members in your organization.
          </Text>
        </View>

        {/* Permission Status */}
        {location.hasPermission === false && (
          <View style={[styles.card, styles.warningCard]}>
            <View style={styles.warningHeader}>
              <MaterialCommunityIcons name="alert-circle" size={24} color="#f59e0b" />
              <Text style={styles.warningTitle}>Permissions Required</Text>
            </View>
            <Text style={styles.warningText}>
              Location permissions are required to enable location tracking. Please grant both foreground and background location permissions.
            </Text>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: brandColor }]}
              onPress={handleRequestPermissions}
              disabled={location.isLoading}
            >
              {location.isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons name="shield-check" size={20} color="#fff" />
                  <Text style={styles.buttonText}>Grant Permissions</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Tracking Toggle */}
        {location.hasPermission && (
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Location Tracking</Text>
                <Text style={styles.settingDescription}>
                  {location.isEnabled
                    ? 'Your location is being shared with your team'
                    : 'Location tracking is currently disabled'}
                </Text>
              </View>
              <Switch
                value={location.isEnabled}
                onValueChange={handleToggleTracking}
                disabled={location.isLoading}
                trackColor={{ false: '#d1d5db', true: `${brandColor}80` }}
                thumbColor={location.isEnabled ? brandColor : '#f4f3f4'}
                ios_backgroundColor="#d1d5db"
              />
            </View>
          </View>
        )}

        {/* Current Location */}
        {location.currentLocation && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="crosshairs-gps" size={24} color={brandColor} />
              <Text style={styles.cardTitle}>Current Location</Text>
            </View>
            <View style={styles.locationInfo}>
              <View style={styles.locationRow}>
                <Text style={styles.locationLabel}>Latitude:</Text>
                <Text style={styles.locationValue}>
                  {location.currentLocation.coords.latitude.toFixed(6)}
                </Text>
              </View>
              <View style={styles.locationRow}>
                <Text style={styles.locationLabel}>Longitude:</Text>
                <Text style={styles.locationValue}>
                  {location.currentLocation.coords.longitude.toFixed(6)}
                </Text>
              </View>
              {location.currentLocation.coords.accuracy && (
                <View style={styles.locationRow}>
                  <Text style={styles.locationLabel}>Accuracy:</Text>
                  <Text style={styles.locationValue}>
                    {Math.round(location.currentLocation.coords.accuracy)}m
                  </Text>
                </View>
              )}
              {location.currentLocation.coords.speed !== null && (
                <View style={styles.locationRow}>
                  <Text style={styles.locationLabel}>Speed:</Text>
                  <Text style={styles.locationValue}>
                    {(location.currentLocation.coords.speed * 3.6).toFixed(1)} km/h
                  </Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton, { borderColor: brandColor }]}
              onPress={handleUpdateLocation}
              disabled={location.isLoading}
            >
              {location.isLoading ? (
                <ActivityIndicator color={brandColor} />
              ) : (
                <>
                  <MaterialCommunityIcons name="refresh" size={20} color={brandColor} />
                  <Text style={[styles.buttonText, { color: brandColor }]}>
                    Update Location
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Information */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="information" size={24} color={brandColor} />
            <Text style={styles.cardTitle}>How It Works</Text>
          </View>
          <View style={styles.infoList}>
            <View style={styles.infoItem}>
              <MaterialCommunityIcons name="shield-check" size={20} color="#10b981" />
              <Text style={styles.infoText}>
                Your location is only visible to members of your organization
              </Text>
            </View>
            <View style={styles.infoItem}>
              <MaterialCommunityIcons name="clock-outline" size={20} color="#10b981" />
              <Text style={styles.infoText}>
                Location updates every 5 minutes or when you move 100+ meters
              </Text>
            </View>
            <View style={styles.infoItem}>
              <MaterialCommunityIcons name="battery-charging" size={20} color="#10b981" />
              <Text style={styles.infoText}>
                Optimized for minimal battery usage
              </Text>
            </View>
            <View style={styles.infoItem}>
              <MaterialCommunityIcons name="eye-off" size={20} color="#10b981" />
              <Text style={styles.infoText}>
                You can disable tracking anytime without notifying anyone
              </Text>
            </View>
          </View>
        </View>

        {/* Error Display */}
        {location.error && (
          <View style={[styles.card, styles.errorCard]}>
            <View style={styles.errorHeader}>
              <MaterialCommunityIcons name="alert-circle-outline" size={24} color="#ef4444" />
              <Text style={styles.errorTitle}>Error</Text>
            </View>
            <Text style={styles.errorText}>{location.error}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  locationInfo: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  locationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  locationLabel: {
    fontSize: 15,
    color: '#6b7280',
    fontWeight: '500',
  },
  locationValue: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '600',
  },
  infoList: {
    gap: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
    marginLeft: 12,
  },
  warningCard: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  warningTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#92400e',
    marginLeft: 8,
  },
  warningText: {
    fontSize: 15,
    color: '#78350f',
    lineHeight: 22,
    marginBottom: 16,
  },
  errorCard: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#991b1b',
    marginLeft: 8,
  },
  errorText: {
    fontSize: 15,
    color: '#7f1d1d',
    lineHeight: 22,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    gap: 8,
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
})
