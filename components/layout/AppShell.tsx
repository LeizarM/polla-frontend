/**
 * AppShell — Universal layout chrome for ALL deep routes
 *
 * Wraps any screen with the desktop sidebar (when applicable) so the user keeps
 * navigation context on every page — not just /user and /admin tab roots.
 *
 * Usage:
 *   <AppShell><Stack screenOptions={...} /></AppShell>
 *
 * Picks the correct tab list (admin vs user) based on auth state. On mobile
 * it just renders children (the back-button navigation pattern is preserved).
 */
import React from 'react';
import { View } from 'react-native';
import { DesktopSidebar, TabConfig } from './DesktopSidebar';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuthStore } from '../../store/authStore';
import { usePollaFinalEnabled } from '../../hooks/useAppSettings';

const ADMIN_TABS: TabConfig[] = [
  { name: 'index',      path: '/admin',            title: 'Dashboard',   ionicon: 'stats-chart-outline', ioniconActive: 'stats-chart' },
  { name: 'torneos',    path: '/admin/torneos',    title: 'Torneos',     ionicon: 'trophy-outline',      ioniconActive: 'trophy' },
  { name: 'participar', path: '/admin/participar', title: 'Apostar',     ionicon: 'ticket-outline',      ioniconActive: 'ticket' },
  { name: 'partidos',   path: '/admin/partidos',   title: 'Resultados',  ionicon: 'create-outline',      ioniconActive: 'create' },
  { name: 'polla',      path: '/admin/polla',      title: 'Polla Final', ionicon: 'star-outline',        ioniconActive: 'star' },
  { name: 'usuarios',       path: '/admin/usuarios',       title: 'Usuarios',    ionicon: 'people-outline',           ioniconActive: 'people' },
  { name: 'notificaciones', path: '/admin/notificaciones', title: 'Avisos',      ionicon: 'notifications-outline',     ioniconActive: 'notifications' },
  { name: 'auditoria',      path: '/admin/auditoria',      title: 'Auditoría',   ionicon: 'shield-checkmark-outline', ioniconActive: 'shield-checkmark' },
  { name: 'perfil',         path: '/admin/perfil',         title: 'Perfil',      ionicon: 'person-outline',           ioniconActive: 'person' },
];

const USER_TABS: TabConfig[] = [
  { name: 'index',     path: '/user',            title: 'Inicio',      ionicon: 'home-outline',   ioniconActive: 'home' },
  { name: 'quinielas', path: '/user/quinielas',  title: 'Apuestas',    ionicon: 'trophy-outline', ioniconActive: 'trophy' },
  { name: 'polla',     path: '/user/polla',      title: 'Polla Final', ionicon: 'star-outline',   ioniconActive: 'star' },
  { name: 'perfil',    path: '/user/perfil',     title: 'Perfil',      ionicon: 'person-outline', ioniconActive: 'person' },
];

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { isDesktop } = useBreakpoint();
  const { theme }     = useTheme();
  const { user, isAdmin } = useAuthStore();
  const { enabled: pollaEnabled } = usePollaFinalEnabled();
  const isAdminUser = !!user && isAdmin();
  // Usuario: ocultar "Polla Final" si está deshabilitada (igual que el tab bar),
  // así el sidebar de escritorio en rutas profundas (torneo, etc.) tampoco la
  // muestra hasta que el admin la habilite. Dinámico (el hook re-fetchea).
  const tabs = isAdminUser
    ? ADMIN_TABS
    : (pollaEnabled ? USER_TABS : USER_TABS.filter((t) => t.name !== 'polla'));

  return (
    <View style={{ flex: 1, flexDirection: isDesktop ? 'row' : 'column', backgroundColor: theme.colors.bg }}>
      {isDesktop && <DesktopSidebar tabs={tabs} />}
      <View style={{ flex: 1, overflow: 'hidden' }}>
        {children}
      </View>
    </View>
  );
}
