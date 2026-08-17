import { QueryClient } from '@tanstack/react-query'

export function createAtlasQueryClient(): QueryClient {
  return new QueryClient({
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
}
