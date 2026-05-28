import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { useEffect } from 'react';
import { TabBar } from '../../components/layout/TabBar';
import { DesktopSidebar, TabConfig } from '../../components/layout/DesktopSidebar';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuthStore } from '../../store/authStore';

export default function AdminLayout() {
  const { isDesktop } = useBreakpoint();
  const { theme } = useTheme();
  const router = useRouter();
  const { user, isAdmin } = useAuthStore();
  // El admin SIEMPRE ve la pestaña "Polla Final" para que pueda habilitarla/
  // deshabilitarla desde el Dashboard. Solo se oculta para usuarios normales.

  const ADMIN_TABS: TabConfig[] = [
    { name: 'index',      path: '/admin',            title: 'Dashboard',  ionicon: 'stats-chart-outline', ioniconActive: 'stats-chart' },
    { name: 'torneos',    path: '/admin/torneos',    title: 'Torneos',    ionicon: 'trophy-outline',      ioniconActive: 'trophy' },
    { name: 'participar', path: '/admin/participar', title: 'Apostar',    ionicon: 'ticket-outline',      ioniconActive: 'ticket' },
    { name: 'partidos',   path: '/admin/partidos',   title: 'Resultados', ionicon: 'create-outline',      ioniconActive: 'create' },
    { name: 'polla',      path: '/admin/polla',      title: 'Polla Final',ionicon: 'star-outline',        ioniconActive: 'star' },
    { name: 'usuarios',       path: '/admin/usuarios',       title: 'Usuarios',  ionicon: 'people-outline',       ioniconActive: 'people' },
    { name: 'notificaciones', path: '/admin/notificaciones', title: 'Avisos',    ionicon: 'notifications-outline',ioniconActive: 'notifications' },
    { name: 'perfil',         path: '/admin/perfil',         title: 'Perfil',    ionicon: 'person-outline',       ioniconActive: 'person' },
  ];

  // Non-admins should not access /admin
  useEffect(() => {
    if (user && !isAdmin()) {
      router.replace('/user' as any);
    }
  }, [user]);

  return (
    <View style={{ flex: 1, flexDirection: isDesktop ? 'row' : 'column', backgroundColor: theme.colors.bg }}>
      {isDesktop && <DesktopSidebar tabs={ADMIN_TABS} />}

      <View style={{ flex: 1, overflow: 'hidden' }}>
        <Tabs
          tabBar={isDesktop ? () => null : (props) => <TabBar {...props} />}
          screenOptions={{ headerShown: false }}
          sceneContainerStyle={{ backgroundColor: theme.colors.bg }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: 'Dashboard',
              tabBarIcon: ({ color, size, focused }) => (
                <Ionicons name={focused ? 'stats-chart' : 'stats-chart-outline'} size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="torneos"
            options={{
              title: 'Torneos',
              tabBarIcon: ({ color, size, focused }) => (
                <Ionicons name={focused ? 'trophy' : 'trophy-outline'} size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="participar"
            options={{
              title: 'Apostar',
              tabBarIcon: ({ color, size, focused }) => (
                <Ionicons name={focused ? 'ticket' : 'ticket-outline'} size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="partidos"
            options={{
              title: 'Resultados',
              tabBarIcon: ({ color, size, focused }) => (
                <Ionicons name={focused ? 'create' : 'create-outline'} size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="polla"
            options={{
              title: 'Polla Final',
              tabBarIcon: ({ color, size, focused }) => (
                <Ionicons name={focused ? 'star' : 'star-outline'} size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="usuarios"
            options={{
              title: 'Usuarios',
              tabBarIcon: ({ color, size, focused }) => (
                <Ionicons name={focused ? 'people' : 'people-outline'} size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="notificaciones"
            options={{
              title: 'Avisos',
              tabBarIcon: ({ color, size, focused }) => (
                <Ionicons name={focused ? 'notifications' : 'notifications-outline'} size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="perfil"
            options={{
              title: 'Perfil',
              tabBarIcon: ({ color, size, focused }) => (
                <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
              ),
            }}
          />
        </Tabs>
      </View>
    </View>
  );
}
