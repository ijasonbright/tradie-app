import { View } from 'react-native'
import { useTheme } from '../../context/ThemeContext'
import QuotesTab from '../../components/quotes/QuotesTab'

export default function QuotesScreen() {
  const { brandColor } = useTheme()

  return (
    <View style={{ flex: 1 }}>
      <QuotesTab />
    </View>
  )
}
