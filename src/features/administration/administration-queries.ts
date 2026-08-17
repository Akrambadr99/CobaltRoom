import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAppServices } from '../../app/providers/app-services-context'
import type {
  UpdateWorkspaceMembershipInput,
  WorkspaceAdministrationQuery,
} from '../../data'
import { atlasQueryKeys } from '../query-keys'

export function useWorkspaceAdministration(query: WorkspaceAdministrationQuery) {
  const { gateway } = useAppServices()
  return useQuery({
    queryKey: [...atlasQueryKeys.administration(query.workspaceId), query],
    queryFn: ({ signal }) => gateway.getWorkspaceAdministration(query, { signal }),
  })
}

export function useUpdateWorkspaceMembership() {
  const { gateway, workspaceId } = useAppServices()
  const queryClient = useQueryClient()
  return useMutation({
    scope: { id: `workspace:${workspaceId}:memberships` },
    mutationFn: (input: UpdateWorkspaceMembershipInput) =>
      gateway.updateWorkspaceMembership(input),
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.administration(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.authorization(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.governanceReports(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.projects(workspaceId),
        }),
      ])
    },
  })
}
