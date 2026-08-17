import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'

import { hasAppErrorKind } from './errors/classify-app-error'

export function createAtlasQueryClient(): QueryClient {
  const refreshAuthorization = (error: Error): void => {
    if (hasAppErrorKind(error, 'forbidden', 'session-expired')) {
      void queryClient.invalidateQueries({ queryKey: ['authorization'] })
    }
  }
  const queryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (query.queryKey[0] !== 'authorization') refreshAuthorization(error)
      },
    }),
    mutationCache: new MutationCache({ onError: refreshAuthorization }),
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 30_000,
      },
      mutations: {
        retry: false,
      },
    },
  })
  return queryClient
}
