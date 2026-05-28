import { Stack } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { AppShell } from '../../components/layout/AppShell';

export default function AdminUsuarioLayout() {
  const { theme } = useTheme();
  return (
    <AppShell>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.bg },
        }}
      />
    </AppShell>
  );
}
