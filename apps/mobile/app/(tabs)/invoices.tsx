import { useWindowDimensions, StyleSheet } from 'react-native'
import { useState } from 'react'
import { TabView, SceneMap, TabBar } from 'react-native-tab-view'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useTheme } from '../../context/ThemeContext'
import InvoicesTab from '../../components/invoices/InvoicesTab'
import PaymentsTab from '../../components/invoices/PaymentsTab'

const renderScene = SceneMap({
  invoices: InvoicesTab,
  payments: PaymentsTab,
})

export default function InvoicesScreen() {
  const layout = useWindowDimensions()
  const { brandColor } = useTheme()
  const [index, setIndex] = useState(0)
  const [routes] = useState([
    { key: 'invoices', title: 'Invoices' },
    { key: 'payments', title: 'Payments' },
  ])

  return (
    <GestureHandlerRootView style={styles.container}>
      <TabView
        navigationState={{ index, routes }}
        renderScene={renderScene}
        onIndexChange={setIndex}
        initialLayout={{ width: layout.width }}
        renderTabBar={(props) => (
          <TabBar
            {...props}
            indicatorStyle={{ backgroundColor: brandColor }}
            style={{ backgroundColor: '#fff' }}
            activeColor={brandColor}
            inactiveColor="#666"
          />
        )}
      />
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})
