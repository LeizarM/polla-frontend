/**
 * DeviceSecurityGate — wrapper que muestra un bloqueo de pantalla completa
 * si el dispositivo está rooteado/jailbroken. El usuario solo puede ver
 * el mensaje y cerrar la app.
 *
 * En dev (__DEV__) deja pasar SIEMPRE para que puedas debuggear local.
 * En prod web: no aplica (no se puede detectar root en navegador).
 *
 * Uso:
 *   <DeviceSecurityGate>
 *     <App />
 *   </DeviceSecurityGate>
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet, BackHandler, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useDeviceSecurity } from '../../hooks/useDeviceSecurity';

export function DeviceSecurityGate({ children }: { children: React.ReactNode }) {
  const sec = useDeviceSecurity();

  // En web o en dev → siempre pasa
  if (Platform.OS === 'web' || __DEV__ || !sec.checked) {
    return <>{children}</>;
  }

  if (!sec.isCompromised) return <>{children}</>;

  // Dispositivo comprometido → pantalla bloqueante
  const closeApp = () => {
    if (Platform.OS === 'android') {
      BackHandler.exitApp();
    }
  };

  return (
    <LinearGradient
      colors={['#7F1D1D', '#450A0A', '#1A0606']}
      style={StyleSheet.absoluteFill}
    >
      <View style={styles.center}>
        <View style={styles.icon}>
          <Ionicons name="warning" size={56} color="#FCA5A5" />
        </View>
        <Text style={styles.title}>Dispositivo no seguro</Text>
        <Text style={styles.body}>
          Tu dispositivo está rooteado/jailbroken o tiene configuraciones de
          desarrollo activas. Por seguridad de tus datos y los del torneo,
          la app no puede ejecutarse en este entorno.
        </Text>

        <View style={styles.list}>
          {sec.isRooted && <Row text="Acceso root detectado" />}
          {sec.isOnExternalStorage && <Row text="App instalada en almacenamiento externo" />}
        </View>

        <Pressable onPress={closeApp} style={styles.btn}>
          <Text style={styles.btnText}>Cerrar app</Text>
        </Pressable>
        <Text style={styles.footer}>
          Si crees que esto es un error, contacta al administrador.
        </Text>
      </View>
    </LinearGradient>
  );
}

function Row({ text }: { text: string }) {
  return (
    <View style={styles.row}>
      <Ionicons name="close-circle" size={16} color="#FCA5A5" />
      <Text style={styles.rowText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  icon: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: 'rgba(248,113,113,0.18)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 22,
  },
  title: {
    fontSize: 24, fontFamily: 'Poppins_800ExtraBold',
    color: '#FEE2E2', letterSpacing: -0.4, textAlign: 'center', marginBottom: 10,
  },
  body: {
    fontSize: 14, fontFamily: 'Poppins_400Regular',
    color: 'rgba(254,202,202,0.85)', lineHeight: 21,
    textAlign: 'center', marginBottom: 22, maxWidth: 360,
  },
  list: { gap: 8, marginBottom: 28, alignSelf: 'stretch', paddingHorizontal: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowText: { color: 'rgba(254,202,202,0.95)', fontSize: 13, fontFamily: 'Poppins_500Medium' },
  btn: {
    backgroundColor: '#DC2626', paddingHorizontal: 28, paddingVertical: 14,
    borderRadius: 999, marginBottom: 14,
  },
  btnText: { color: '#fff', fontFamily: 'Poppins_700Bold', fontSize: 15, letterSpacing: 0.3 },
  footer: {
    fontSize: 11, color: 'rgba(254,202,202,0.55)',
    fontFamily: 'Poppins_400Regular', textAlign: 'center',
  },
});
