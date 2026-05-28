/**
 * DesktopSidebar — Premium collapsible nav
 * User section · active pill · hover states · smooth collapse
 */
import React, { memo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useSegments } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { useSidebar } from '../../contexts/SidebarContext';
import { useAuthStore } from '../../store/authStore';
import { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from '../../hooks/useBreakpoint';

export interface TabConfig {
  name: string;
  path: string;
  title: string;
  ionicon: string;
  ioniconActive: string;
}

interface Props { tabs: TabConfig[] }

export function DesktopSidebar({ tabs }: Props) {
  const { theme }             = useTheme();
  const { collapsed, toggle } = useSidebar();
  const router                = useRouter();
  const segments              = useSegments();
  const { logout, user, isAdmin } = useAuthStore();
  const [confirmLogout, setConfirmLogout] = useState(false);

  const currentTab  = (segments[1] as string | undefined) ?? 'index';
  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  const handleLogout = async () => {
    setConfirmLogout(false);
    await logout();
  };

  return (
    <View
      style={[
        styles.container,
        {
          width: sidebarWidth,
          backgroundColor: theme.colors.surface,
          borderRightColor: theme.colors.border,
          // CSS-only transition — works on web
          ...(Platform.OS === 'web' ? { transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)' } as any : {}),
        },
      ]}
    >
      {/* ── Brand header ───────────────────────────────────────────────── */}
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.primaryLight + 'CC']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.brand, collapsed && styles.brandCollapsed]}
      >
        <View style={styles.brandIcon}>
          <Ionicons name="trophy" size={20} color="#FFD700" />
        </View>
        {!collapsed && (
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={styles.brandTitle} numberOfLines={1}>Mundial 2026</Text>
            <Text style={styles.brandSub}>
              {isAdmin() ? 'Panel Admin' : 'Mi cuenta'}
            </Text>
          </View>
        )}
      </LinearGradient>

      {/* ── Nav items ──────────────────────────────────────────────────── */}
      <View style={styles.navScroll}>
        {tabs.map((tab) => (
          <NavItem
            key={tab.name}
            tab={tab}
            isActive={tab.name === currentTab}
            collapsed={collapsed}
            onPress={() => router.navigate(tab.path as any)}
            theme={theme}
          />
        ))}
      </View>

      {/* ── User section ───────────────────────────────────────────────── */}
      {!collapsed && user && (
        <View style={[styles.userSection, { borderTopColor: theme.colors.border }]}>
          <LinearGradient
            colors={[theme.colors.surfaceElevated, theme.colors.surface]}
            style={styles.userCard}
          >
            <View style={[styles.userAvatar, { backgroundColor: theme.colors.primary + '30' }]}>
              <Text style={[styles.userAvatarText, { color: theme.colors.primaryLight }]}>
                {(user as any).full_name?.[0]?.toUpperCase() ?? (user as any).username?.[0]?.toUpperCase() ?? '?'}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.userName, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                {(user as any).full_name ?? (user as any).username}
              </Text>
              <Text style={[styles.userRole, { color: theme.colors.primaryLight }]}>
                {isAdmin() ? '⚡ Admin' : '👤 Usuario'}
              </Text>
            </View>
          </LinearGradient>
        </View>
      )}

      {/* ── Logout ─────────────────────────────────────────────────────── */}
      <View style={[styles.logoutSection, { borderTopColor: theme.colors.border }]}>
        {confirmLogout && !collapsed ? (
          <View style={styles.confirmRow}>
            <Text style={[styles.confirmText, { color: theme.colors.textSecondary }]}>
              ¿Cerrar sesión?
            </Text>
            <Pressable
              style={[styles.confirmBtn, { borderColor: theme.colors.border }]}
              onPress={() => setConfirmLogout(false)}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary }}>No</Text>
            </Pressable>
            <Pressable
              style={[styles.confirmBtn, { backgroundColor: '#EF4444', borderColor: '#EF4444' }]}
              onPress={handleLogout}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>Sí</Text>
            </Pressable>
          </View>
        ) : (
          <LogoutButton
            collapsed={collapsed}
            onPress={() => collapsed ? handleLogout() : setConfirmLogout(true)}
          />
        )}
      </View>

      {/* ── Collapse toggle ────────────────────────────────────────────── */}
      <Pressable
        onPress={toggle}
        style={[
          styles.toggleBtn,
          { borderTopColor: theme.colors.border },
          collapsed && styles.toggleBtnCollapsed,
        ]}
      >
        <Ionicons
          name={collapsed ? 'chevron-forward' : 'chevron-back'}
          size={14}
          color={theme.colors.textMuted}
        />
        {!collapsed && (
          <Text style={[styles.toggleLabel, { color: theme.colors.textMuted }]}>
            Ocultar panel
          </Text>
        )}
      </Pressable>
    </View>
  );
}

// ─── Nav Item ─────────────────────────────────────────────────────────────────

interface NavItemProps {
  tab: TabConfig;
  isActive: boolean;
  collapsed: boolean;
  onPress: () => void;
  theme: any;
}

const NavItem = memo(function NavItem({
  tab, isActive, collapsed, onPress, theme,
}: NavItemProps) {
  const [hovered, setHovered] = useState(false);
  const activeColor = theme.colors.primaryLight;

  const bg = isActive
    ? activeColor + '1A'
    : hovered
    ? theme.colors.surfaceElevated
    : 'transparent';

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[
        styles.navItem,
        collapsed && styles.navItemCollapsed,
        { backgroundColor: bg },
      ]}
    >
      {/* Active left bar */}
      {isActive && (
        <View style={[styles.activeBar, { backgroundColor: activeColor }]} />
      )}

      {/* Icon */}
      <View style={collapsed ? styles.iconCenter : styles.iconWrap}>
        <Ionicons
          name={(isActive ? tab.ioniconActive : tab.ionicon) as any}
          size={isActive ? 21 : 19}
          color={isActive ? activeColor : theme.colors.textMuted}
        />
      </View>

      {/* Label */}
      {!collapsed && (
        <Text
          numberOfLines={1}
          style={[
            styles.navLabel,
            {
              color:      isActive ? activeColor : theme.colors.textSecondary,
              fontWeight: isActive ? '600' : '400',
              fontFamily: isActive ? 'Poppins_600SemiBold' : 'Poppins_400Regular',
            },
          ]}
        >
          {tab.title}
        </Text>
      )}
    </Pressable>
  );
});

// ─── Logout button ────────────────────────────────────────────────────────────

const LogoutButton = memo(function LogoutButton({
  collapsed, onPress,
}: { collapsed: boolean; onPress: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[
        styles.logoutBtn,
        collapsed && styles.logoutBtnCollapsed,
        hovered && { backgroundColor: 'rgba(239,68,68,0.08)' },
      ]}
    >
      <Ionicons name="log-out-outline" size={17} color="#EF4444" />
      {!collapsed && (
        <Text style={styles.logoutLabel}>Cerrar sesión</Text>
      )}
    </Pressable>
  );
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexShrink: 0,
    borderRightWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },

  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 18,
  },
  brandCollapsed: { justifyContent: 'center', paddingHorizontal: 0 },
  brandIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  brandTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Poppins_700Bold',
    letterSpacing: -0.3,
  },
  brandSub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    fontFamily: 'Poppins_400Regular',
    marginTop: 1,
  },

  navScroll: {
    flex: 1,
    paddingTop: 8,
    paddingHorizontal: 8,
    paddingBottom: 8,
    ...(Platform.OS === 'web' ? { overflowY: 'auto' } as any : {}),
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 10,
    marginBottom: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  navItemCollapsed: { justifyContent: 'center', paddingHorizontal: 0 },
  activeBar: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
  },
  iconWrap:   { width: 26, alignItems: 'center' },
  iconCenter: { width: '100%' as any, alignItems: 'center' },
  navLabel:   { marginLeft: 9, fontSize: 13, letterSpacing: 0.1, flex: 1 },

  userSection: { borderTopWidth: StyleSheet.hairlineWidth, padding: 8 },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  userAvatarText: { fontSize: 14, fontWeight: '700', fontFamily: 'Poppins_700Bold' },
  userName:  { fontSize: 12, fontWeight: '600', fontFamily: 'Poppins_600SemiBold' },
  userRole:  { fontSize: 10, fontFamily: 'Poppins_400Regular', marginTop: 1 },

  logoutSection: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 8, paddingVertical: 4 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 10,
    gap: 9,
  },
  logoutBtnCollapsed: { justifyContent: 'center', paddingHorizontal: 0 },
  logoutLabel: { fontSize: 13, color: '#EF4444', fontWeight: '600', fontFamily: 'Poppins_600SemiBold' },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 6,
  },
  confirmText: { fontSize: 12, fontWeight: '600', flex: 1, fontFamily: 'Poppins_600SemiBold' },
  confirmBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 7,
  },
  toggleBtnCollapsed: { justifyContent: 'center', paddingHorizontal: 0 },
  toggleLabel: { fontSize: 11, fontWeight: '500', fontFamily: 'Poppins_500Medium' },
});
