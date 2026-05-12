import { Stack } from 'expo-router';

export default function Layout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Admin - Create Document' }} />
      <Stack.Screen name="sign/[id]" options={{ title: 'Customer Signing' }} />
    </Stack>
  );
}
