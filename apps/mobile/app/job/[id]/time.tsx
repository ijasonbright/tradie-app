import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { useState, useEffect } from 'react'
import { apiClient } from '../../../lib/api-client'
import { MaterialCommunityIcons } from '@expo/vector-icons'

export default function JobTimeTrackingScreen() {
  const { id } = useLocalSearchParams()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [timeLogs, setTimeLogs] = useState<any[]>([])
  const [activeTimer, setActiveTimer] = useState<any | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  useEffect(() => {
    fetchData()
  }, [id])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (activeTimer) {
      const startTime = new Date(activeTimer.start_time).getTime()
      interval = setInterval(() => {
        const now = Date.now()
        const elapsed = Math.floor((now - startTime) / 1000)
        setElapsedSeconds(elapsed)
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [activeTimer])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [timeLogsRes, activeTimerRes] = await Promise.all([
        apiClient.getTimeLogs(id as string),
        apiClient.getActiveTimer(id as string)
      ])
      setTimeLogs(timeLogsRes.timeLogs || [])
      setActiveTimer(activeTimerRes.timeLog)

      if (activeTimerRes.timeLog) {
        const startTime = new Date(activeTimerRes.timeLog.start_time).getTime()
        const elapsed = Math.floor((Date.now() - startTime) / 1000)
        setElapsedSeconds(elapsed)
      }
    } catch (err: any) {
      console.error('Failed to fetch time data:', err)
      Alert.alert('Error', 'Failed to load time tracking data')
    } finally {
      setLoading(false)
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  const handleStartTimer = async () => {
    try {
      const response = await apiClient.startTimer(id as string)
      setActiveTimer(response.timeLog)
      setElapsedSeconds(0)
      await fetchData()
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to start timer')
    }
  }

  const handleStopTimer = async () => {
    try {
      await apiClient.stopTimer(id as string)
      setActiveTimer(null)
      setElapsedSeconds(0)
      await fetchData()
      Alert.alert('Success', 'Timer stopped successfully')
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to stop timer')
    }
  }

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    const pad = (n: number) => n.toString().padStart(2, '0')
    return pad(hours) + ':' + pad(minutes) + ':' + pad(secs)
  }

  const formatDuration = (hours: number) => {
    const h = Math.floor(hours)
    const m = Math.round((hours - h) * 60)
    return h + 'h ' + m + 'm'
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Time Tracking' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Time Tracking' }} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} tintColor="#2563eb" />
        }
      >
        {/* Timer Card */}
        <View style={styles.timerCard}>
          <Text style={styles.timerLabel}>Current Session</Text>
          <Text style={styles.timerDisplay}>{formatTime(elapsedSeconds)}</Text>

          {activeTimer ? (
            <TouchableOpacity style={styles.stopButton} onPress={handleStopTimer}>
              <MaterialCommunityIcons name="stop" size={24} color="#fff" />
              <Text style={styles.buttonText}>Stop Timer</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.startButton} onPress={handleStartTimer}>
              <MaterialCommunityIcons name="play" size={24} color="#fff" />
              <Text style={styles.buttonText}>Start Timer</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Time Logs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Time Log History</Text>

          {timeLogs.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="clock-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No time logs yet</Text>
            </View>
          ) : (
            timeLogs.map((log) => (
              <View key={log.id} style={styles.logCard}>
                <View style={styles.logHeader}>
                  <View style={styles.logInfo}>
                    <Text style={styles.logDate}>
                      {new Date(log.start_time).toLocaleDateString()}
                    </Text>
                    <Text style={styles.logTime}>
                      {new Date(log.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {log.end_time && ' - ' + new Date(log.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <Text style={styles.logDuration}>
                    {log.total_hours ? formatDuration(parseFloat(log.total_hours)) : 'In Progress'}
                  </Text>
                </View>

                {log.notes && (
                  <Text style={styles.logNotes}>{log.notes}</Text>
                )}

                <View style={[styles.statusBadge, { backgroundColor: log.status === 'approved' ? '#10b981' : log.status === 'rejected' ? '#ef4444' : '#f59e0b' }]}>
                  <Text style={styles.statusText}>{log.status}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
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
  },
  scrollContent: {
    padding: 16,
  },
  timerCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  timerLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  timerDisplay: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 24,
  },
  startButton: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
  },
  stopButton: {
    backgroundColor: '#ef4444',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 12,
  },
  logCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  logInfo: {
    flex: 1,
  },
  logDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
    marginBottom: 2,
  },
  logTime: {
    fontSize: 12,
    color: '#666',
  },
  logDuration: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  logNotes: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'capitalize',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
})
