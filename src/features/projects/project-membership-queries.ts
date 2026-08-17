import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAppServices } from '../../app/providers/app-services-context'
import type {
  AddProjectMemberInput,
  AtlasGateway,
  ProjectMembershipQuery,
  RemoveProjectMemberInput,
  UpdateProjectMemberInput,
} from '../../data'
import type { Project, ProjectId } from '../../domain'
import { atlasQueryKeys } from '../query-keys'

export function useProjectMembershipAdministration(
  query: ProjectMembershipQuery,
  enabled: boolean,
) {
  const { gateway, workspaceId } = useAppServices()
  return useQuery({
    queryKey: [...atlasQueryKeys.projectMembers(workspaceId, query.projectId), query],
    queryFn: ({ signal }) =>
      gateway.getProjectMembershipAdministration(query, { signal }),
    enabled,
  })
}

export function useAddProjectMember(projectId: ProjectId) {
  return useProjectMembershipMutation<AddProjectMemberInput>(
    projectId,
    (gateway, input) => gateway.addProjectMember(input),
  )
}

export function useUpdateProjectMember(projectId: ProjectId) {
  return useProjectMembershipMutation<UpdateProjectMemberInput>(
    projectId,
    (gateway, input) => gateway.updateProjectMember(input),
  )
}

export function useRemoveProjectMember(projectId: ProjectId) {
  return useProjectMembershipMutation<RemoveProjectMemberInput>(
    projectId,
    (gateway, input) => gateway.removeProjectMember(input),
  )
}

function useProjectMembershipMutation<TInput>(
  projectId: ProjectId,
  mutate: (gateway: AtlasGateway, input: TInput) => Promise<Project>,
) {
  const { gateway, workspaceId } = useAppServices()
  const queryClient = useQueryClient()
  return useMutation({
    scope: { id: `project:${projectId}:memberships` },
    mutationFn: (input: TInput) => mutate(gateway, input),
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.projectMembers(workspaceId, projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.project(workspaceId, projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.projectActivity(workspaceId, projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.workspaceIssues(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.authorization(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.governanceReports(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.analytics(workspaceId),
        }),
      ])
    },
  })
}
