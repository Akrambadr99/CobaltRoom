import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAppServices } from '../../app/providers/app-services-context'
import type {
  ActivateWorkspaceInvitationInput,
  CreateWorkspaceInvitationInput,
  ResendWorkspaceInvitationInput,
  RevokeWorkspaceInvitationInput,
  WorkspaceInvitationQuery,
} from '../../data'
import { atlasQueryKeys } from '../../app/query/keys'

export function useWorkspaceInvitations(query: WorkspaceInvitationQuery) {
  const { gateway } = useAppServices()
  return useQuery({
    queryKey: atlasQueryKeys.workspaceInvitations(query),
    queryFn: ({ signal }) => gateway.getWorkspaceInvitations(query, { signal }),
  })
}

export function useCreateWorkspaceInvitation() {
  const { gateway } = useAppServices()
  return useInvitationMutation((input: CreateWorkspaceInvitationInput) =>
    gateway.createWorkspaceInvitation(input),
  )
}

export function useResendWorkspaceInvitation() {
  const { gateway } = useAppServices()
  return useInvitationMutation((input: ResendWorkspaceInvitationInput) =>
    gateway.resendWorkspaceInvitation(input),
  )
}

export function useRevokeWorkspaceInvitation() {
  const { gateway } = useAppServices()
  return useInvitationMutation((input: RevokeWorkspaceInvitationInput) =>
    gateway.revokeWorkspaceInvitation(input),
  )
}

export function useActivateWorkspaceInvitation() {
  const { gateway } = useAppServices()
  return useInvitationMutation((input: ActivateWorkspaceInvitationInput) =>
    gateway.activateWorkspaceInvitation(input),
  )
}

function useInvitationMutation<TInput, TResult>(
  mutation: (input: TInput) => Promise<TResult>,
) {
  const { workspaceId } = useAppServices()
  const queryClient = useQueryClient()
  return useMutation({
    scope: { id: `workspace:${workspaceId}:invitations` },
    mutationFn: mutation,
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
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.notifications(workspaceId),
        }),
      ])
    },
  })
}
