import { Tabs } from 'expo-router'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { Image, Text } from 'react-native'
import { useTheme } from '../../context/ThemeContext'

export default function TabsLayout() {
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
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: brandColor,
        tabBarInactiveTintColor: '#666',
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
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Jobs',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="briefcase" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="calendar" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="invoices"
        options={{
          title: 'Invoices',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="receipt-text"
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size}) => (
            <MaterialCommunityIcons name="menu" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  )
}
