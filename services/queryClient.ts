import { QueryClient, focusManager } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

/**
 * QueryClient global.
 *
 * Filosofía "always-fresh":
 *   - staleTime = 0    → cualquier remontaje/foco refetchea
 *   - refetchOnMount   → al volver a montar un screen, refetch
 *   - refetchOnFocus   → al recuperar foco (browser tab / app foreground), refetch
 *   - refetchOnReconnect → al recuperar red, refetch
 *
 * Sumado a los `useFocusEffect(refetch)` que ya hay en cada pantalla,
 * el usuario NUNCA necesita pull-to-refresh manual — al navegar entre
 * pantallas los datos se actualizan solos.
 *
 * Si una pantalla quiere caché más larga puede override con
 *   useQuery({ queryKey, queryFn, staleTime: 60_000 })
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // 0 = los datos se consideran "viejos" inmediatamente → next mount/focus refetcha
      staleTime: 0,
      // gcTime: tiempo que datos no usados quedan en memoria antes de GC
      // (antes era cacheTime). 60s evita re-pedir N veces si se entra y sale rápido.
      gcTime: 60_000,
      refetchOnMount: 'always',
      refetchOnReconnect: true,
      // Esto importa: en native lo enchufamos abajo con focusManager.
      refetchOnWindowFocus: true,
    },
  },
});

// ── React Query no escucha AppState en React Native por defecto.
//    Wireamos foreground → focus manager → queries se invalidan.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    focusManager.setFocused(state === 'active');
  });
}
