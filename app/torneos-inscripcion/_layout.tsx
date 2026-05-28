import { Stack } from 'expo-router';
import { AppShell } from '../../components/layout/AppShell';

export default function Layout() {
  return (
    <AppShell>
      <Stack screenOptions={{ headerShown: false }} />
    </AppShell>
  );
}
