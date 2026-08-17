import { useQuery } from '@tanstack/react-query'

import { useAppServices } from '../../app/providers/app-services-context'
import type { WorkspaceActivityQuery } from '../../data'
import { atlasQueryKeys } from '../query-keys'

export function useWorkspaceActivity(query: WorkspaceActivityQuery) {
  const { gateway } = useAppServices()
  return useQuery({
    queryKey: atlasQueryKeys.workspaceActivity(query),
    queryFn: ({ signal }) => gateway.getWorkspaceActivity(query, { signal }),
    refetchInterval: 60_000,
    staleTime: 15_000,
  })
}
