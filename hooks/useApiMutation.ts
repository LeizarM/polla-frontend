/**
 * useApiMutation — wrapper sobre useMutation que invalida queries por
 * patrón automáticamente al éxito. Asegura que las listas se actualicen
 * AL INSTANTE tras crear/editar/borrar sin pull-to-refresh manual.
 *
 *  Uso:
 *
 *    const createTeam = useApiMutation({
 *      mutationFn: (data) => api.post('/api/teams', data),
 *      invalidates: ['teams', 'tournament'],   // matches partial keys
 *      onSuccess: () => showToast('success', 'OK'),
 *    });
 *
 *    await createTeam.mutateAsync(formData);
 *    // → al volver, la lista de equipos ya tiene el nuevo
 *
 *  El `invalidates` acepta:
 *    - string[]:  matchea contra el primer elemento de cada queryKey
 *    - 'all':     invalida TODO (nuclear; útil para mutaciones grandes)
 */
import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';

type InvalidatesArg = string[] | 'all';

export interface UseApiMutationOptions<TData, TError, TVariables>
  extends Omit<UseMutationOptions<TData, TError, TVariables>, 'onSuccess'> {
  invalidates?: InvalidatesArg;
  onSuccess?: (data: TData, variables: TVariables) => void | Promise<void>;
}

export function useApiMutation<TData = unknown, TError = unknown, TVariables = void>(
  opts: UseApiMutationOptions<TData, TError, TVariables>,
) {
  const qc = useQueryClient();
  const { invalidates, onSuccess: userOnSuccess, ...rest } = opts;

  return useMutation<TData, TError, TVariables>({
    ...rest,
    onSuccess: async (data, variables) => {
      if (invalidates === 'all') {
        await qc.invalidateQueries();
      } else if (Array.isArray(invalidates) && invalidates.length > 0) {
        // Invalida cualquier query cuyo PRIMER elemento del key matchee
        // alguno de los strings dados. Permite invalidar 'tournament' y
        // alcance ['tournament', id], ['tournaments-list'], etc.
        await qc.invalidateQueries({
          predicate: (q) => {
            const first = q.queryKey?.[0];
            if (typeof first !== 'string') return false;
            return invalidates.some(k => first.includes(k));
          },
        });
      }
      if (userOnSuccess) await userOnSuccess(data, variables);
    },
  });
}
