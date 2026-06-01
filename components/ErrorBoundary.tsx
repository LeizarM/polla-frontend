/**
 * ErrorBoundary — captura errores de React (render/mount/update) y los
 * MUESTRA EN PANTALLA en vez de dejar que la app crashee ("keeps stopping").
 *
 * Crítico para debuggear el APK release cuando no hay acceso a adb/logcat:
 * el usuario puede SCREENSHOTEAR el error y mandarlo.
 *
 * También engancha el handler global de errores JS no capturados
 * (ErrorUtils) para mostrar errores async que no pasan por React.
 */
import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Platform } from 'react-native';

interface State {
  hasError: boolean;
  error: Error | null;
  info: string | null;
  source: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, info: null, source: 'render' };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error, source: 'render' };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    this.setState({ error, info: info?.componentStack ?? null, source: 'render' });
  }

  componentDidMount() {
    // Captura errores JS globales (async, fuera de React) que de otro modo
    // crashearian la app sin mostrar nada.
    const g: any = global as any;
    if (g?.ErrorUtils && typeof g.ErrorUtils.setGlobalHandler === 'function') {
      const prev = g.ErrorUtils.getGlobalHandler?.();
      g.ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
        // Mostramos el error en pantalla
        this.setState({
          hasError: true,
          error: error instanceof Error ? error : new Error(String(error)),
          info: isFatal ? '(fatal)' : '(no fatal)',
          source: 'global',
        });
        // Llamamos al handler previo para no romper otros listeners
        try { prev?.(error, isFatal); } catch {}
      });
    }
  }

  reset = () => this.setState({ hasError: false, error: null, info: null, source: 'render' });

  render() {
    if (!this.state.hasError) return this.props.children;

    const { error, info, source } = this.state;
    const name = error?.name ?? 'Error';
    const message = error?.message ?? 'Error desconocido';
    const stack = error?.stack ?? '';

    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.badge}>⚠️ ERROR CAPTURADO ({source})</Text>
          <Text style={styles.title}>{name}</Text>
          <Text style={styles.message}>{message}</Text>

          {info ? (
            <>
              <Text style={styles.sectionLabel}>Component stack:</Text>
              <Text style={styles.code}>{info.slice(0, 1500)}</Text>
            </>
          ) : null}

          <Text style={styles.sectionLabel}>Stack trace:</Text>
          <Text style={styles.code}>{stack.slice(0, 2500)}</Text>

          <Text style={styles.meta}>
            Platform: {Platform.OS} {Platform.Version}
          </Text>

          <Pressable style={styles.btn} onPress={this.reset}>
            <Text style={styles.btnText}>Reintentar</Text>
          </Pressable>
          <Text style={styles.hint}>
            📸 Sácale captura a esta pantalla y envíala para arreglar el error.
          </Text>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },
  content: { padding: 20, paddingTop: 60, gap: 8 },
  badge: { color: '#FCA5A5', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  title: { color: '#EF4444', fontSize: 20, fontWeight: '800', marginTop: 4 },
  message: { color: '#FDE68A', fontSize: 14, marginTop: 4, lineHeight: 20 },
  sectionLabel: { color: '#93C5FD', fontSize: 12, fontWeight: '700', marginTop: 16 },
  code: {
    color: '#CBD5E1', fontSize: 11, marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', lineHeight: 16,
  },
  meta: { color: '#64748B', fontSize: 11, marginTop: 16 },
  btn: {
    backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 12,
    alignItems: 'center', marginTop: 20,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  hint: { color: '#94A3B8', fontSize: 12, textAlign: 'center', marginTop: 12, lineHeight: 17 },
});
