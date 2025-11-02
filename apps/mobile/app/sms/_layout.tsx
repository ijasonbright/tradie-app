import { Stack } from 'expo-router'

export default function SMSLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="purchase-credits"
        options={{
          title: 'Purchase SMS Credits',
          headerBackTitle: 'Back',
        }}
      />
    </Stack>
  )
}
