import { Stack } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { AppShell } from '../../components/layout/AppShell';
import { AdminRouteGuard } from '../../components/security/AdminRouteGuard';

export default function AdminUsuarioLayout() {
  const { theme } = useTheme();
  return (
    <AdminRouteGuard>
      <AppShell>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.bg },
          }}
        />
      </AppShell>
    </AdminRouteGuard>
  );
}
