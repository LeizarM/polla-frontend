/**
 * Banner discreto que sugiere instalar la app como PWA.
 *
 * Comportamiento por plataforma:
 *  - Chrome/Edge/Android: dispara `beforeinstallprompt` → mostramos botón "Instalar"
 *  - iOS Safari:          no hay API; mostramos instrucciones manuales
 *                          (Compartir → Añadir a Inicio). NECESARIO para que
 *                          iOS reciba Web Push (16.4+).
 *  - Si ya está instalada (display-mode: standalone) → no mostramos nada.
 *  - Una vez que el user lo cierra, no le insistimos en 7 días.
 */
import React, { useEffect, useState } from 'react';
import { Platform, View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const DISMISS_KEY = 'pwa_install_dismissed_until';
const DISMISS_DAYS = 7;

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    // iOS Safari
    (window.navigator as any).standalone === true
  );
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
}

export function PWAInstallPrompt() {
  const [deferred, setDeferred] = useState<any>(null);
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (isStandalone()) return;

    // ¿Lo cerró hace poco?
    try {
      const until = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
      if (until > Date.now()) { setClosed(true); return; }
    } catch {/* */}

    // Android/Chrome: API estándar
    const onPrompt = (e: any) => {
      e.preventDefault();
      setDeferred(e);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    // iOS: no hay evento, detectamos por UA
    if (isIOS()) setShowIOSHint(true);

    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  const close = () => {
    setClosed(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 86400 * 1000));
    } catch {/* */}
  };

  if (Platform.OS !== 'web') return null;
  if (closed) return null;
  if (!deferred && !showIOSHint) return null;

  return (
    <View style={styles.banner}>
      <View style={styles.iconBox}>
        <Ionicons name="download" size={20} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>
          {showIOSHint ? 'Instala la app en tu iPhone' : 'Instala Mundial 2026'}
        </Text>
        <Text style={styles.sub}>
          {showIOSHint
            ? 'Toca Compartir ⬆️ → "Añadir a pantalla de inicio" para recibir notificaciones'
            : 'Acceso rápido + funciona sin internet + notificaciones'}
        </Text>
      </View>
      {!showIOSHint && (
        <Pressable onPress={install} style={styles.installBtn}>
          <Text style={styles.installText}>Instalar</Text>
        </Pressable>
      )}
      <Pressable onPress={close} style={styles.closeBtn}>
        <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    bottom: 80, left: 12, right: 12,
    zIndex: 9000,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(15,23,42,0.96)',
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.35)',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 6 },
  },
  iconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#FFD70025',
    alignItems: 'center', justifyContent: 'center',
  },
  title:  { color: '#fff', fontFamily: 'Poppins_700Bold', fontSize: 13 },
  sub:    { color: 'rgba(255,255,255,0.65)', fontFamily: 'Poppins_400Regular', fontSize: 11, marginTop: 2 },
  installBtn: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
  },
  installText: { color: '#0F172A', fontFamily: 'Poppins_800ExtraBold', fontSize: 12 },
  closeBtn:    { padding: 4 },
});
