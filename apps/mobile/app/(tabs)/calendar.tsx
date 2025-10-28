import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { Chip, FAB } from 'react-native-paper'
import { MaterialCommunityIcons } from '@expo/vector-icons'

// Mock data for today's schedule
const MOCK_APPOINTMENTS = [
  {
    id: '1',
    time: '09:00 AM',
    endTime: '11:00 AM',
    title: 'Kitchen Renovation',
    client: 'John Smith',
    address: '123 Main St, Sydney',
    type: 'job',
    status: 'confirmed',
  },
  {
    id: '2',
    time: '01:00 PM',
    endTime: '03:00 PM',
    title: 'Bathroom Plumbing',
    client: 'Jane Doe',
    address: '456 Oak Ave, Melbourne',
    type: 'job',
    status: 'confirmed',
  },
  {
    id: '3',
    time: '04:00 PM',
    endTime: '05:00 PM',
    title: 'Quote Meeting - Office Fit-out',
    client: 'ABC Company',
    address: '789 Pine Rd, Brisbane',
    type: 'quote',
    status: 'confirmed',
  },
]

const TYPE_COLORS: Record<string, string> = {
  job: '#2563eb',
  quote: '#9333ea',
  meeting: '#0891b2',
  site_visit: '#ea580c',
}

export default function CalendarScreen() {
  const today = new Date().toLocaleDateString('en-AU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const renderAppointment = (appointment: typeof MOCK_APPOINTMENTS[0]) => (
    <TouchableOpacity key={appointment.id} style={styles.appointmentCard}>
      <View style={styles.timeColumn}>
        <Text style={styles.time}>{appointment.time}</Text>
        <Text style={styles.endTime}>{appointment.endTime}</Text>
      </View>

      <View
        style={[
          styles.colorBar,
          { backgroundColor: TYPE_COLORS[appointment.type] },
        ]}
      />

      <View style={styles.detailsColumn}>
        <View style={styles.header}>
          <Text style={styles.title}>{appointment.title}</Text>
          <Chip
            mode="flat"
            style={[
              styles.typeChip,
              { backgroundColor: TYPE_COLORS[appointment.type] },
            ]}
            textStyle={styles.chipText}
          >
            {appointment.type.toUpperCase()}
          </Chip>
        </View>

        <View style={styles.row}>
          <MaterialCommunityIcons name="account" size={14} color="#666" />
          <Text style={styles.info}>{appointment.client}</Text>
        </View>

        <View style={styles.row}>
          <MaterialCommunityIcons name="map-marker" size={14} color="#666" />
          <Text style={styles.info}>{appointment.address}</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton}>
            <MaterialCommunityIcons name="phone" size={18} color="#2563eb" />
            <Text style={styles.actionText}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <MaterialCommunityIcons name="navigation" size={18} color="#2563eb" />
            <Text style={styles.actionText}>Navigate</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  )

  return (
    <View style={styles.container}>
      <View style={styles.dateHeader}>
        <Text style={styles.todayLabel}>Today</Text>
        <Text style={styles.dateText}>{today}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {MOCK_APPOINTMENTS.length > 0 ? (
          MOCK_APPOINTMENTS.map(renderAppointment)
        ) : (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="calendar-blank"
              size={64}
              color="#ccc"
            />
            <Text style={styles.emptyText}>No appointments today</Text>
          </View>
        )}
      </ScrollView>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => alert('Add appointment - Coming soon!')}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  dateHeader: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  todayLabel: {
    fontSize: 12,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  dateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111',
  },
  scrollContent: {
    padding: 16,
  },
  appointmentCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  timeColumn: {
    marginRight: 12,
    alignItems: 'flex-end',
    width: 70,
  },
  time: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },
  endTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  colorBar: {
    width: 4,
    borderRadius: 2,
    marginRight: 12,
  },
  detailsColumn: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111',
    flex: 1,
    marginRight: 8,
  },
  typeChip: {
    height: 22,
  },
  chipText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#fff',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  info: {
    fontSize: 13,
    color: '#666',
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontSize: 13,
    color: '#2563eb',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#2563eb',
  },
})
