import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'

import { GatewayError } from '../../data'
import { can as canPerform, type Permission, type ProjectId } from '../../domain'
import { atlasQueryKeys } from '../../features/query-keys'
import {
  AuthorizationContext,
  type AuthorizationState,
} from './authorization-context'
import { useAppServices } from './app-services-context'

export function AuthorizationProvider({ children }: Readonly<{ children: ReactNode }>) {
  const services = useAppServices()
  const queryClient = useQueryClient()
  const authorization = useQuery({
    queryKey: atlasQueryKeys.authorization(services.workspaceId),
    queryFn: ({ signal }) =>
      services.gateway.getAuthorizationSession(services.workspaceId, { signal }),
    initialData: services.session,
    staleTime: 0,
    refetchInterval: 30_000,
  })
  const lastPermissionFingerprint = useRef(
    authorization.data.permissionFingerprint,
  )

  useEffect(() => {
    if (
      authorization.data.permissionFingerprint ===
      lastPermissionFingerprint.current
    ) {
      return
    }
    lastPermissionFingerprint.current = authorization.data.permissionFingerprint
    void queryClient.resetQueries({
      predicate: (query) => query.queryKey[0] !== 'authorization',
    })
  }, [authorization.data.permissionFingerprint, queryClient])

  const can = useCallback(
    (permission: Permission, projectId?: ProjectId): boolean => {
      if (authorization.isError) return false
      const projectMembership =
        authorization.data.projectMemberships.find(
          (membership) => membership.projectId === projectId,
        ) ?? null
      return canPerform(
        {
          workspaceMembership: authorization.data.workspaceMembership,
          projectMembership,
        },
        permission,
        projectId,
      )
    },
    [authorization.data, authorization.isError],
  )
  const isSessionExpired =
    authorization.error instanceof GatewayError &&
    authorization.error.code === 'session-expired'
  useEffect(() => {
    if (!authorization.isError) return
    queryClient.removeQueries({
      predicate: (query) => query.queryKey[0] !== 'authorization',
    })
  }, [authorization.isError, queryClient])
  const { refetch } = authorization
  const refresh = useCallback(async (): Promise<void> => {
    await refetch()
  }, [refetch])
  const value = useMemo<AuthorizationState>(
    () => ({
      session: authorization.data,
      isStale: authorization.isError,
      isSessionExpired,
      can,
      refresh,
    }),
    [authorization.data, authorization.isError, can, isSessionExpired, refresh],
  )

  return <AuthorizationContext value={value}>{children}</AuthorizationContext>
}
