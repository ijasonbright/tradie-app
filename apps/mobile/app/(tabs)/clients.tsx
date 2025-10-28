import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native'
import { Searchbar, FAB, Avatar } from 'react-native-paper'
import { useState } from 'react'
import { MaterialCommunityIcons } from '@expo/vector-icons'

// Mock data for clients
const MOCK_CLIENTS = [
  {
    id: '1',
    name: 'John Smith',
    type: 'residential',
    email: 'john.smith@email.com',
    phone: '+61 412 345 678',
    address: '123 Main St, Sydney NSW 2000',
    activeJobs: 2,
    totalJobs: 5,
  },
  {
    id: '2',
    name: 'Jane Doe',
    type: 'residential',
    email: 'jane.doe@email.com',
    phone: '+61 423 456 789',
    address: '456 Oak Ave, Melbourne VIC 3000',
    activeJobs: 1,
    totalJobs: 3,
  },
  {
    id: '3',
    name: 'ABC Company Pty Ltd',
    type: 'commercial',
    email: 'info@abccompany.com.au',
    phone: '+61 434 567 890',
    address: '789 Pine Rd, Brisbane QLD 4000',
    activeJobs: 3,
    totalJobs: 12,
  },
  {
    id: '4',
    name: 'XYZ Builders',
    type: 'commercial',
    email: 'contact@xyzbuilders.com.au',
    phone: '+61 445 678 901',
    address: '321 Cedar St, Perth WA 6000',
    activeJobs: 0,
    totalJobs: 8,
  },
]

export default function ClientsScreen() {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredClients = MOCK_CLIENTS.filter(
    (client) =>
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.phone.includes(searchQuery)
  )

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const renderClientCard = ({ item }: { item: typeof MOCK_CLIENTS[0] }) => (
    <TouchableOpacity style={styles.card}>
      <View style={styles.cardHeader}>
        <Avatar.Text
          size={48}
          label={getInitials(item.name)}
          style={[
            styles.avatar,
            { backgroundColor: item.type === 'commercial' ? '#9333ea' : '#2563eb' },
          ]}
        />
        <View style={styles.headerInfo}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.type}>
            {item.type === 'commercial' ? 'Commercial' : 'Residential'}
          </Text>
        </View>
      </View>

      <View style={styles.contactInfo}>
        <View style={styles.row}>
          <MaterialCommunityIcons name="email" size={16} color="#666" />
          <Text style={styles.info}>{item.email}</Text>
        </View>

        <View style={styles.row}>
          <MaterialCommunityIcons name="phone" size={16} color="#666" />
          <Text style={styles.info}>{item.phone}</Text>
        </View>

        <View style={styles.row}>
          <MaterialCommunityIcons name="map-marker" size={16} color="#666" />
          <Text style={styles.info}>{item.address}</Text>
        </View>
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{item.activeJobs}</Text>
          <Text style={styles.statLabel}>Active Jobs</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{item.totalJobs}</Text>
          <Text style={styles.statLabel}>Total Jobs</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton}>
          <MaterialCommunityIcons name="phone" size={20} color="#2563eb" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <MaterialCommunityIcons name="email" size={20} color="#2563eb" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <MaterialCommunityIcons name="message-text" size={20} color="#2563eb" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Search clients..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchbar}
      />

      <FlatList
        data={filteredClients}
        renderItem={renderClientCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="account-group-outline"
              size={64}
              color="#ccc"
            />
            <Text style={styles.emptyText}>No clients found</Text>
          </View>
        }
      />

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => alert('Add new client - Coming soon!')}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchbar: {
    margin: 16,
    elevation: 2,
  },
  list: {
    padding: 16,
    paddingTop: 0,
  },
  card: {
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 2,
  },
  type: {
    fontSize: 13,
    color: '#666',
    textTransform: 'capitalize',
  },
  contactInfo: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  info: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  stats: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e5e5',
    marginBottom: 12,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2563eb',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  divider: {
    width: 1,
    backgroundColor: '#e5e5e5',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
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
