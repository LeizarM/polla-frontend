/**
 * useAppSettings — leer y mutar settings como única fuente de verdad.
 *
 *  - useAppSettings()          → todas las settings (Record<string,string>)
 *  - usePollaFinalEnabled()    → boolean derivado para el switch de Polla Final
 *  - useUpdateAppSetting()     → mutar settings con optimistic update
 *
 *  Notas:
 *   - `staleTime: 0` → se re-fetchea en cada mount/focus. Endpoint barato.
 *   - `refetchOnWindowFocus: true` (default) → vuelve a fetchear al volver
 *     al tab del navegador. Importante para que el usuario vea cambios del
 *     admin sin tener que refrescar.
 *   - Mutación con `onMutate` → el switch refleja el cambio AL INSTANTE
 *     sin esperar el roundtrip al backend (evita el "double tap").
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
    // Siempre re-fetch en mount/focus — endpoint es muy ligero y queremos
    // que cualquier cambio del admin se vea inmediato en otras pestañas.
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    // Polling ligero: el cambio del admin (mostrar/ocultar Polla Final) se
    // refleja en TODOS los dispositivos (web y apk) en ~1 min, sin reiniciar la
    // app. El endpoint es diminuto. Esto hace que el toggle sea realmente dinámico.
    refetchInterval: 60_000,
  });
}

/**
 * Útil para componentes que solo necesitan saber si la Polla Final está
 * visible. Mientras carga devuelve `false` para que la tab NO parpadee.
 */
export function usePollaFinalEnabled(): { enabled: boolean; isLoading: boolean } {
  const { data, isLoading } = useAppSettings();
  const val = (data?.polla_final_enabled ?? 'false').toLowerCase();
  return { enabled: val === 'true' || val === '1', isLoading };
}

/**
 * Hook para que el admin actualice settings.
 *
 * Optimistic update: cambia el cache YA (UI responde al instante) y solo
 * revierte si la mutación falla. Soluciona el "double tap" en el Switch.
 */
export function useUpdateAppSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, string>) => {
      const res = await api.patch('/api/settings', { settings: payload });
      return res?.data;
    },

    // Optimistic: aplicamos el cambio AL INSTANTE en el cache.
    // El Switch se actualiza inmediatamente porque lee del mismo cache.
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY });
      const previous = qc.getQueryData<AppSettings>(QUERY_KEY);
      qc.setQueryData<AppSettings>(QUERY_KEY, (old) => ({
        ...(old ?? {}),
        ...payload,
      }));
      return { previous };
    },

    // Si falla, revertimos al valor anterior.
    onError: (_err, _payload, ctx) => {
      if (ctx?.previous) qc.setQueryData(QUERY_KEY, ctx.previous);
    },

    // Sea éxito o error, refresh para sincronizar con el server.
    onSettled: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
