import { useQuery } from '@tanstack/react-query'

import { useAppServices } from '../../app/providers/app-services-context'
import type { GovernanceQuery } from '../../data'
import { atlasQueryKeys } from '../query-keys'

export function useGovernanceReport(query: GovernanceQuery) {
  const { gateway } = useAppServices()
  return useQuery({
    queryKey: atlasQueryKeys.governance(query),
    queryFn: ({ signal }) => gateway.getGovernanceReport(query, { signal }),
  })
}
