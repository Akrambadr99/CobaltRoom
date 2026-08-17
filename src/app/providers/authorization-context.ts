import { createContext, useContext } from 'react'

import type { AuthorizationSession } from '../../data'
import type { Permission, ProjectId } from '../../domain'

export interface AuthorizationState {
  readonly session: AuthorizationSession
  readonly isStale: boolean
  readonly isSessionExpired: boolean
  can(permission: Permission, projectId?: ProjectId): boolean
  refresh(): Promise<void>
}

export const AuthorizationContext = createContext<AuthorizationState | null>(null)

export function useAuthorization(): AuthorizationState {
  const authorization = useContext(AuthorizationContext)
  if (!authorization) {
    throw new Error('useAuthorization must be used inside AuthorizationProvider.')
  }
  return authorization
}
