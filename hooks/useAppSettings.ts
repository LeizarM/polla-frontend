/**
 * useAppSettings — leerlas y mutarlas en una sola fuente de verdad.
 *
 * GET /api/settings devuelve un Record<string,string>. Lo cacheamos 5s
 * (suficientemente vivo para que cuando admin toque el switch los demás
 * lo vean al instante al navegar/recuperar foco).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

export type AppSettings = Record<string, string>;

const QUERY_KEY = ['app-settings'];

export function useAppSettings() {
  return useQuery<AppSettings>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      try {
        const res = await api.get('/api/settings');
        return (res?.data ?? {}) as AppSettings;
      } catch {
        return {};
      }
    },
    // Permitimos un pequeño staleTime aquí porque /api/settings se consulta
    // con MUY alta frecuencia (cada navegación a un layout). 5s = fresco
    // pero no martillea el backend.
    staleTime: 5_000,
  });
}

/**
 * Útil para componentes que solo necesitan saber si la Polla Final está
 * visible. Maneja loading: durante la carga inicial devuelve `false` para
 * que la pestaña NO parpadee (aparezca y desaparezca).
 */
export function usePollaFinalEnabled(): { enabled: boolean; isLoading: boolean } {
  const { data, isLoading } = useAppSettings();
  const val = (data?.polla_final_enabled ?? 'false').toLowerCase();
  return { enabled: val === 'true' || val === '1', isLoading };
}

/**
 * Hook para que el admin actualice settings. Invalida la query al éxito
 * → el resto de la app ve el cambio inmediatamente.
 */
export function useUpdateAppSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, string>) => {
      const res = await api.patch('/api/settings', { settings: payload });
      return res?.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
