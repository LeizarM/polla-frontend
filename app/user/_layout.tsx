import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { useEffect, useMemo } from 'react';
import { TabBar } from '../../components/layout/TabBar';
import { DesktopSidebar, TabConfig } from '../../components/layout/DesktopSidebar';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuthStore } from '../../store/authStore';
import { usePollaFinalEnabled } from '../../hooks/useAppSettings';

export default function UserLayout() {
  const { isDesktop } = useBreakpoint();
  const { theme } = useTheme();
  const router = useRouter();
  const { user, isAdmin } = useAuthStore();
  // Setting controlado por admin — si está deshabilitado, escondemos la
  // pestaña "Polla Final" tanto del sidebar como del tab bar inferior.
  const { enabled: pollaEnabled } = usePollaFinalEnabled();

  const USER_TABS: TabConfig[] = useMemo(() => {
    const base: TabConfig[] = [
      { name: 'index',     path: '/user',           title: 'Inicio',   ionicon: 'home-outline',   ioniconActive: 'home' },
      { name: 'quinielas', path: '/user/quinielas', title: 'Apuestas', ionicon: 'trophy-outline', ioniconActive: 'trophy' },
    ];
    if (pollaEnabled) {
      base.push({ name: 'polla', path: '/user/polla', title: 'Polla Final', ionicon: 'star-outline', ioniconActive: 'star' });
    }
    base.push({ name: 'perfil', path: '/user/perfil', title: 'Perfil', ionicon: 'person-outline', ioniconActive: 'person' });
    return base;
  }, [pollaEnabled]);

  // Admins should always be in the /admin layout
  useEffect(() => {
    if (user && isAdmin()) {
      router.replace('/admin' as any);
    }
  }, [user]);

  return (
    <View style={{ flex: 1, flexDirection: isDesktop ? 'row' : 'column', backgroundColor: theme.colors.bg }}>
      {isDesktop && <DesktopSidebar tabs={USER_TABS} />}

      <View style={{ flex: 1, overflow: 'hidden' }}>
        <Tabs
          tabBar={isDesktop ? () => null : (props) => <TabBar {...props} />}
          screenOptions={{ headerShown: false }}
          sceneContainerStyle={{ backgroundColor: theme.colors.bg }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: 'Inicio',
              tabBarIcon: ({ color, size, focused }) => (
                <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="quinielas"
            options={{
              title: 'Apuestas',
              tabBarIcon: ({ color, size, focused }) => (
                <Ionicons name={focused ? 'trophy' : 'trophy-outline'} size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="grupos"
            options={{ href: null }}
          />
          <Tabs.Screen
            name="polla"
            options={{
              // `href: null` quita la pestaña del tab bar Y bloquea el deep-link
              // — usuarios no pueden navegar manualmente a /user/polla.
              href: pollaEnabled ? '/user/polla' : null,
              title: 'Polla Final',
              tabBarIcon: ({ color, size, focused }) => (
                <Ionicons name={focused ? 'star' : 'star-outline'} size={size} color={color} />
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
