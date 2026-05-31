import { Stack } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { AppShell } from '../../components/layout/AppShell';
import { AdminRouteGuard } from '../../components/security/AdminRouteGuard';

export default function TournamentLayout() {
  const { theme } = useTheme();
  // Todo el árbol /tournament/* es gestión administrativa (editar torneos,
  // equipos, jornadas, reportes PDF). Solo admins. Se alcanza desde
  // admin/torneos (onManage) y admin/partidos.
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
