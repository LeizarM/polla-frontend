/**
 * Perfil — Premium user profile
 * Glow avatar ring · icon info rows · palette picker · change password
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useBreakpoint }  from '../../hooks/useBreakpoint';
import { Card }      from '../../components/ui/Card';
import { Input }     from '../../components/ui/Input';
import { Button }    from '../../components/ui/Button';
import { useToast }  from '../../components/ui/Toast';
import { TwoFactorSetup } from '../../components/security/TwoFactorSetup';
import { useAuthStore }   from '../../store/authStore';
import { queryClient }    from '../../services/queryClient';
import { useTheme }       from '../../contexts/ThemeContext';
import api from '../../services/api';

// ─── Info row ─────────────────────────────────────────────────────────────────

function InfoRow({
  icon, label, value, color, last = false, theme,
}: {
  icon: string; label: string; value: string | undefined;
  color?: string; last?: boolean; theme: any;
}) {
  return (
    <>
      <View style={styles.infoRow}>
        <View style={[styles.infoIconWrap, { backgroundColor: theme.colors.primaryLight + '16' }]}>
          <Ionicons name={icon as any} size={15} color={theme.colors.primaryLight} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.infoLabel, { color: theme.colors.textMuted }]}>{label}</Text>
          <Text style={[styles.infoValue, { color: color ?? theme.colors.textPrimary }]}>
            {value ?? '—'}
          </Text>
        </View>
      </View>
      {!last && <View style={[styles.infoDivider, { backgroundColor: theme.colors.border }]} />}
    </>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PerfilScreen() {
  const { user, updateUser, refreshUser }      = useAuthStore();
  const { showToast }                          = useToast();
  const { theme, paletteId, setPaletteId, palettes } = useTheme();
  const { isDesktop }                          = useBreakpoint();

  const [editing,  setEditing]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [formData, setFormData] = useState({
    full_name: user?.full_name ?? '',
    phone:     user?.phone     ?? '',
    username:  user?.username  ?? '',
    ci:        (user as any)?.ci ?? '',
  });

  const [showPwChange, setShowPwChange] = useState(false);
  const [pwLoading,    setPwLoading]    = useState(false);
  const [pwForm, setPwForm] = useState({
    old_password: '', new_password: '', confirm_password: '',
  });

  const hasChanges =
    formData.full_name !== (user?.full_name ?? '') ||
    formData.phone     !== (user?.phone     ?? '') ||
    formData.username  !== (user?.username  ?? '') ||
    formData.ci        !== ((user as any)?.ci ?? '');

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!hasChanges) return;
    setLoading(true);
    try {
      const response = await api.patch('/api/users/me', formData);
      if (response?.data) {
        updateUser(response.data);
        showToast('success', 'Perfil actualizado correctamente');
        setEditing(false);
      }
    } catch (error: any) {
      showToast('error', error?.friendlyMessage || 'Error al actualizar perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      full_name: user?.full_name ?? '',
      phone:     user?.phone     ?? '',
      username:  user?.username  ?? '',
      ci:        (user as any)?.ci ?? '',
    });
    setEditing(false);
  };

  const handleChangePassword = async () => {
    if (!pwForm.old_password || !pwForm.new_password || !pwForm.confirm_password) {
      showToast('error', 'Completa todos los campos'); return;
    }
    if (pwForm.new_password !== pwForm.confirm_password) {
      showToast('error', 'Las contraseñas nuevas no coinciden'); return;
    }
    if (pwForm.new_password.length < 6) {
      showToast('error', 'Mínimo 6 caracteres'); return;
    }
    setPwLoading(true);
    try {
      await api.patch('/api/users/me/password', {
        old_password: pwForm.old_password,
        new_password: pwForm.new_password,
      });
      showToast('success', 'Contraseña actualizada correctamente');
      setPwForm({ old_password: '', new_password: '', confirm_password: '' });
      setShowPwChange(false);
    } catch (error: any) {
      showToast('error', error?.response?.data?.message || error?.friendlyMessage || 'Error al cambiar contraseña');
    } finally {
      setPwLoading(false);
    }
  };

  const doLogout = async () => {
    try {
      await AsyncStorage.clear();
      queryClient.clear();
      useAuthStore.setState({ user: null, token: null });
      router.replace('/auth/login' as any);
    } catch {}
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('¿Estás seguro que deseas cerrar sesión?')) doLogout();
    } else {
      Alert.alert('Cerrar Sesión', '¿Estás seguro que deseas salir?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Cerrar Sesión', style: 'destructive', onPress: doLogout },
      ]);
    }
  };

  const initials = (user?.full_name ?? user?.username ?? '?')
    .split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.primaryLight]}
        start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }}
        style={styles.headerGrad}
      >
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Mi Perfil</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {!editing && (
              <Button
                title="Editar"
                icon="create-outline"
                variant="ghost"
                size="sm"
                onPress={() => setEditing(true)}
              />
            )}
            <Pressable onPress={handleLogout} style={styles.logoutIconBtn}>
              <Ionicons name="log-out-outline" size={22} color="rgba(255,255,255,0.85)" />
            </Pressable>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          isDesktop ? { maxWidth: 680, alignSelf: 'center' as any, width: '100%' } : undefined
        }
      >

        {/* ── Avatar section ─────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.avatarSection}>
          {/* Glow ring */}
          <View style={{
            shadowColor: theme.colors.primary,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.65,
            shadowRadius: 22,
            elevation: 10,
            marginBottom: 16,
          }}>
            <LinearGradient
              colors={[theme.colors.primary, theme.colors.primaryLight]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ width: 90, height: 90, borderRadius: 26, padding: 2.5 }}
            >
              <LinearGradient
                colors={[theme.colors.surfaceElevated, theme.colors.surface]}
                style={{
                  flex: 1, borderRadius: 23.5,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Text style={{
                  fontSize: 30, fontWeight: '700',
                  color: theme.colors.primaryLight,
                  fontFamily: 'Poppins_700Bold',
                }}>
                  {initials}
                </Text>
              </LinearGradient>
            </LinearGradient>
          </View>

          <Text style={[styles.avatarName, { color: theme.colors.textPrimary }]}>
            {user?.full_name}
          </Text>
          <Text style={[styles.avatarUsername, { color: theme.colors.textSecondary }]}>
            @{user?.username}
          </Text>

          {/* Member badge */}
          <LinearGradient
            colors={[theme.colors.primary, theme.colors.primaryLight]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.memberBadge}
          >
            <Ionicons name="star" size={13} color="rgba(255,255,255,0.85)" />
            <Text style={styles.memberBadgeText}>Participante · Mundial 2026</Text>
          </LinearGradient>
        </Animated.View>

        {/* ── Edit form OR info card ──────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(80).duration(380)}>
          {editing ? (
            <View style={[styles.card, {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            }]}>
              <LinearGradient
                colors={[theme.colors.primary, theme.colors.primaryLight, 'transparent']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={{ height: 1.5 }}
              />
              <View style={{ padding: 20 }}>
                <Input label="Usuario" value={formData.username}
                  onChangeText={(v) => setFormData({ ...formData, username: v })}
                  placeholder="Tu nombre de usuario" autoCapitalize="none" icon="at-outline" />
                <Input label="Nombre completo" value={formData.full_name}
                  onChangeText={(v) => setFormData({ ...formData, full_name: v })}
                  placeholder="Tu nombre completo" icon="person-outline" />
                <Input label="CI (opcional)" value={formData.ci}
                  onChangeText={(v) => setFormData({ ...formData, ci: v })}
                  placeholder="Ej: 12345678" type="number" icon="card-outline" />
                <Input label="Teléfono" value={formData.phone}
                  onChangeText={(v) => setFormData({ ...formData, phone: v })}
                  placeholder="Tu número de teléfono" type="phone" icon="call-outline" />
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                  <Button title="Cancelar" variant="outline" size="md" onPress={handleCancel} style={{ flex: 1 }} />
                  <Button title="Guardar" variant="primary" size="md" onPress={handleSave}
                    loading={loading} disabled={!hasChanges} style={{ flex: 1 }} />
                </View>
              </View>
            </View>
          ) : (
            <View style={[styles.card, {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            }]}>
              <LinearGradient
                colors={[theme.colors.primary, theme.colors.primaryLight, 'transparent']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={{ height: 1.5 }}
              />
              <View style={{ paddingVertical: 8 }}>
                <InfoRow icon="at-outline"       label="Usuario"  value={`@${user?.username}`}    theme={theme} />
                <InfoRow icon="person-outline"   label="Nombre"   value={user?.full_name}          theme={theme} />
                <InfoRow icon="card-outline"     label="CI"       value={(user as any)?.ci || 'Sin registrar'} theme={theme} />
                <InfoRow icon="call-outline"     label="Teléfono" value={user?.phone}              theme={theme} />
                <InfoRow icon="shield-checkmark-outline" label="Rol"
                  value={user?.role === 'admin' ? 'Administrador' : 'Usuario'}
                  color={theme.colors.primaryLight} theme={theme} />
                <InfoRow icon="ellipse"          label="Estado"
                  value={user?.status === 'active' ? 'Activo' : user?.status}
                  color="#10B981" last theme={theme} />
              </View>
            </View>
          )}
        </Animated.View>

        {/* ── Change password ─────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(140).duration(360)} style={styles.sectionWrap}>
          <Pressable
            style={[styles.sectionToggle, {
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface,
            }]}
            onPress={() => {
              setShowPwChange(!showPwChange);
              setPwForm({ old_password: '', new_password: '', confirm_password: '' });
            }}
          >
            <View style={[styles.infoIconWrap, { backgroundColor: '#EF444416' }]}>
              <Ionicons name="lock-closed-outline" size={15} color="#EF4444" />
            </View>
            <Text style={[styles.sectionToggleText, { color: theme.colors.textPrimary }]}>
              Cambiar Contraseña
            </Text>
            <Ionicons
              name={showPwChange ? 'chevron-up' : 'chevron-down'}
              size={18} color={theme.colors.textMuted}
            />
          </Pressable>

          {showPwChange && (
            <Animated.View entering={FadeInDown.duration(220)}>
              <View style={[styles.card, {
                marginTop: 10,
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              }]}>
                <View style={{ padding: 16 }}>
                  <Input label="Contraseña actual" value={pwForm.old_password}
                    onChangeText={(v) => setPwForm({ ...pwForm, old_password: v })}
                    placeholder="Tu contraseña actual" type="password" icon="lock-closed-outline" />
                  <Input label="Nueva contraseña" value={pwForm.new_password}
                    onChangeText={(v) => setPwForm({ ...pwForm, new_password: v })}
                    placeholder="Mínimo 6 caracteres" type="password" icon="lock-open-outline" />
                  <Input label="Confirmar nueva contraseña" value={pwForm.confirm_password}
                    onChangeText={(v) => setPwForm({ ...pwForm, confirm_password: v })}
                    placeholder="Repite la nueva contraseña" type="password" icon="lock-open-outline"
                    error={
                      pwForm.confirm_password.length > 0 && pwForm.new_password !== pwForm.confirm_password
                        ? 'No coinciden' : undefined
                    } />
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                    <Button title="Cancelar" variant="outline" size="md"
                      onPress={() => { setShowPwChange(false); setPwForm({ old_password: '', new_password: '', confirm_password: '' }); }}
                      style={{ flex: 1 }} />
                    <Button title="Guardar" variant="primary" size="md"
                      onPress={handleChangePassword} loading={pwLoading} style={{ flex: 1 }} />
                  </View>
                </View>
              </View>
            </Animated.View>
          )}
        </Animated.View>

        {/* ── 2FA (Two-Factor Authentication) ─────────────────────────────── */}
        <Animated.View
          entering={FadeInDown.delay(170).duration(360)}
          style={styles.sectionWrap}
        >
          <TwoFactorSetup
            enabled={!!(user as any)?.totp_enabled}
            onChange={() => { refreshUser(); }}
          />
        </Animated.View>

        {/* ── Palette picker ──────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(220).duration(360)} style={styles.sectionWrap}>
          <Text style={[styles.paletteSectionTitle, { color: theme.colors.textPrimary }]}>
            Tema de Colores
          </Text>
          <Text style={[styles.paletteSectionDesc, { color: theme.colors.textSecondary }]}>
            Personaliza la apariencia de la app
          </Text>

          <View style={styles.paletteGrid}>
            {palettes.map((p, idx) => {
              const isActive = p.id === paletteId;
              return (
                <Animated.View key={p.id} entering={ZoomIn.duration(280).delay(idx * 55)}>
                  <Pressable
                    onPress={() => setPaletteId(p.id)}
                    style={[
                      styles.paletteItem,
                      {
                        borderColor: isActive ? p.colors.primaryLight : theme.colors.border,
                        backgroundColor: theme.colors.surface,
                      },
                      isActive && {
                        borderWidth: 2,
                        shadowColor: p.shadowColor,
                        shadowOpacity: 0.4,
                        shadowRadius: 8,
                        elevation: 6,
                      },
                    ]}
                  >
                    <View style={styles.paletteColors}>
                      <View style={[styles.paletteColorDot, { backgroundColor: p.gradients.primary[0] }]} />
                      <View style={[styles.paletteColorDot, { backgroundColor: p.gradients.primary[1] }]} />
                      <View style={[styles.paletteColorDot, { backgroundColor: p.gradients.accent[0] }]} />
                    </View>
                    <Text style={[styles.paletteName, { color: isActive ? p.colors.primaryLight : theme.colors.textMuted }]}>
                      {p.name}
                    </Text>
                    {isActive && (
                      <View style={[styles.paletteCheck, { backgroundColor: p.colors.primaryLight }]}>
                        <Ionicons name="checkmark" size={11} color="#fff" />
                      </View>
                    )}
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
        </Animated.View>

        {/* ── Logout button ───────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(240).duration(340)} style={styles.actionsWrap}>
          <Pressable style={styles.logoutBtn} onPress={handleLogout}>
            <LinearGradient
              colors={['#EF4444', '#DC2626']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.logoutGrad}
            >
              <Ionicons name="log-out-outline" size={20} color="#fff" />
              <Text style={styles.logoutBtnText}>Cerrar Sesión</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  headerGrad: { paddingBottom: 22 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: 'Poppins_700Bold',
    color: '#fff',
    letterSpacing: -0.4,
  },
  logoutIconBtn: {
    width: 38, height: 38,
    borderRadius: 11,
    backgroundColor: 'rgba(239,68,68,0.10)',
    alignItems: 'center', justifyContent: 'center',
  },

  content: { flex: 1 },

  // Avatar
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 24,
  },
  avatarName: {
    fontSize: 22,
    fontWeight: '700',
    fontFamily: 'Poppins_700Bold',
    letterSpacing: -0.3,
  },
  avatarUsername: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    marginTop: 3,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 9999,
    marginTop: 14,
  },
  memberBadgeText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    fontFamily: 'Poppins_600SemiBold',
  },

  // Card
  card: {
    marginHorizontal: 20,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  infoIconWrap: {
    width: 32, height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  infoLabel: {
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
    marginBottom: 1,
  },
  infoValue: {
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
  },
  infoDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },

  // Section wrapper
  sectionWrap: {
    paddingHorizontal: 20,
    marginTop: 16,
  },

  // Password toggle
  sectionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  sectionToggleText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
  },

  // Palette
  paletteSectionTitle: {
    fontSize: 17,
    fontFamily: 'Poppins_700Bold',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  paletteSectionDesc: {
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    marginBottom: 16,
  },
  paletteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  paletteItem: {
    width: 95,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    position: 'relative',
  },
  paletteColors: { flexDirection: 'row', gap: 4, marginBottom: 7 },
  paletteColorDot: { width: 18, height: 18, borderRadius: 9 },
  paletteName: {
    fontSize: 10,
    fontFamily: 'Poppins_600SemiBold',
    textAlign: 'center',
  },
  paletteCheck: {
    position: 'absolute',
    top: -5, right: -5,
    width: 20, height: 20,
    borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },

  // Logout
  actionsWrap: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 52,
  },
  logoutBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  logoutGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    gap: 10,
  },
  logoutBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
    fontFamily: 'Poppins_700Bold',
  },
});
