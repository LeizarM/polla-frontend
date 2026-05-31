import { QueryClient, focusManager, keepPreviousData } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

/**
 * QueryClient global — estrategia "instantánea percibida":
 *
 *   - staleTime = 8s    → si navegas entre pantallas en menos de 8s,
 *                         NO hace request al server (usa cache → instantáneo)
 *   - gcTime    = 5min  → cache se mantiene 5 minutos en memoria aunque
 *                         no se use. Volver a una pantalla = data instantánea.
 *   - placeholderData = keepPreviousData
 *                       → mientras hace refetch en background, sigue mostrando
 *                         los datos previos. CERO flicker / loading skeleton.
 *   - refetchOnMount: 'always'  → cuando montas screen, refetch en background
 *                                  (pero muestra cache mientras llega).
 *   - refetchOnReconnect: true
 *   - refetchOnWindowFocus: true
 *
 * Cuando haces CRUD en una mutation, ese código debe llamar:
 *     queryClient.invalidateQueries({ queryKey: ['xxx'] })
 *   Eso fuerza refetch independiente del staleTime → UI actualizado.
 *
 * Si una pantalla quiere caché distinta:
 *   useQuery({ queryKey, queryFn, staleTime: 60_000, placeholderData: keepPreviousData })
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // 8 segundos de "freshness window" — navegar y volver rápido = instantáneo
      staleTime: 8_000,
      // gcTime largo = el cache se mantiene 5 minutos. Al regresar a una
      // pantalla, los datos están listos al instante (luego refetch background).
      gcTime: 5 * 60_000,
      // 🪄 La magia visual: nunca desmonta datos previos mientras refetcha.
      // El usuario ve los datos viejos (instantáneo) y luego se actualizan sin flicker.
      placeholderData: keepPreviousData,
      refetchOnMount: 'always',
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
    },
    mutations: {
      // Las mutaciones también se reintentan 1 vez por errores de red
      retry: 1,
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
