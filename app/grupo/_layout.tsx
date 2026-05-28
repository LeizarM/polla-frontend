import { Stack } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { AppShell } from '../../components/layout/AppShell';

export default function GrupoLayout() {
  const { theme } = useTheme();
  return (
    <AppShell>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.bg },
          animation: 'slide_from_right',
        }}
      />
    </AppShell>
  );
}
