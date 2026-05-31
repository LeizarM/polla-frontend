/**
 * AdminRouteGuard — guard de RENDER (no solo useEffect) para layouts admin-only.
 *
 * El guard global en app/_layout.tsx redirige vía useEffect, pero eso corre
 * DESPUÉS del primer render → un usuario normal vería un "flash" del contenido
 * admin antes de ser expulsado. Este componente bloquea en tiempo de render:
 * si no eres admin, NO renderiza los children (devuelve null) y dispara el
 * redirect. Cero flash de datos admin.
 *
 * Defensa en profundidad: aunque el backend ya rechaza con 403 cualquier
 * acción admin, no queremos ni mostrar la pantalla a un no-admin.
 *
 * Uso en un _layout.tsx admin:
 *   export default function AdminLayout() {
 *     return (
 *       <AdminRouteGuard>
 *         ...resto del layout...
 *       </AdminRouteGuard>
 *     );
 *   }
 */
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';

interface Props {
  children: React.ReactNode;
}

export function AdminRouteGuard({ children }: Props) {
  const router = useRouter();
  const { user, isLoading, isAdmin } = useAuthStore();

  const allowed = !!user && isAdmin();

  useEffect(() => {
    // Una vez resuelto el auth, si no es admin → expulsar.
    if (isLoading) return;
    if (!user) {
      router.replace('/auth/login' as any);
    } else if (!isAdmin()) {
      router.replace('/user' as any);
    }
  }, [user, isLoading]);

  // Mientras carga la sesión o si NO está autorizado → no renderizar children.
  // Esto previene el flash de contenido admin para usuarios normales.
  if (isLoading || !allowed) {
    return <View style={{ flex: 1 }} />;
  }

  return <>{children}</>;
}
