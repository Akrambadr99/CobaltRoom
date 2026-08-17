import { useQuery } from '@tanstack/react-query'

import { useAppServices } from '../../app/providers/app-services-context'
import { atlasQueryKeys } from '../../app/query/keys'

export function useGlobalIssueSearch(search: string) {
  const { gateway, workspaceId } = useAppServices()

  return useQuery({
    queryKey: atlasQueryKeys.globalSearch(workspaceId, search),
    queryFn: async ({ signal }) => {
      const [issues, projects] = await Promise.all([
        gateway.listIssues(
          {
            filters: { workspaceId, search },
            sort: { field: 'updatedAt', direction: 'descending' },
            page: { number: 1, size: 8 },
          },
          { signal },
        ),
        gateway.listProjects(workspaceId, { signal }),
      ])

      return { issues, projects }
    },
    enabled: search.length >= 2,
  })
}
