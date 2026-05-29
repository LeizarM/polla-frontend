/**
 * Banner sticky que aparece arriba cuando no hay red.
 * Solo aplica en web (en native React Native ya tiene su propio offline UX si se necesita).
 *
 * Además escucha el mensaje `queue-flushed` del SW para mostrar toast cuando
 * el backlog offline se reenvió OK.
 */
import React, { useEffect, useState } from 'react';
import { Platform, View, Text, StyleSheet } from 'react-native';
import { useToast } from './Toast';

export function OfflineIndicator() {
  const { showToast } = useToast();
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    setOnline(navigator.onLine);
    const goOnline  = () => { setOnline(true);  showToast('success', 'Conexión restaurada'); };
    const goOffline = () => { setOnline(false); showToast('warning', 'Sin conexión — modo offline'); };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    // SW nos avisa de eventos importantes
    const onMsg = (e: MessageEvent) => {
      if (e?.data?.type === 'queue-flushed') {
        showToast('success', '✅ Se enviaron las acciones que hiciste sin internet');
      }
      // Nuevo SW activado → toast con CTA "Actualizar" para recargar
      // y mostrar la versión nueva. Evita auto-reload (sería disruptivo si
      // el usuario está escribiendo).
      if (e?.data?.type === 'sw-updated') {
        showToast('info', '🎉 Nueva versión disponible — recargando…');
        // Pequeño delay para que el toast sea visible antes de recargar
        setTimeout(() => window.location.reload(), 1200);
      }
    };
    navigator.serviceWorker?.addEventListener('message', onMsg);

    // También fuerza un check del SW al cargar (por si ya hay update pendiente)
    navigator.serviceWorker?.getRegistration?.()?.then((reg) => {
      reg?.update?.().catch(() => {});
    });

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      navigator.serviceWorker?.removeEventListener('message', onMsg);
    };
  }, []);

  if (Platform.OS !== 'web' || online) return null;

  return (
    <View style={styles.bar} pointerEvents="none">
      <View style={styles.dot} />
      <Text style={styles.text}>Sin conexión — los cambios se guardarán para enviarlos después</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 9999,
    backgroundColor: '#7F1D1D',
    paddingVertical: 6,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#FCA5A5',
  },
  text: {
    color: '#FECACA',
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
  },
});
