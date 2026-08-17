import type { ProjectStatus } from '../../domain'

const projectStatuses: readonly ProjectStatus[] = [
  'planned',
  'active',
  'paused',
  'completed',
  'archived',
]

export interface ProjectWorkspaceState {
  readonly search: string
  readonly status: ProjectStatus | null
  readonly page: number
}

export function parseProjectWorkspaceState(
  parameters: URLSearchParams,
): ProjectWorkspaceState {
  const pageValue = Number(parameters.get('page') ?? '1')
  const statusValue = parameters.get('status')

  return {
    search: (parameters.get('q') ?? '').trim().slice(0, 100),
    status:
      projectStatuses.find((candidate) => candidate === statusValue) ?? null,
    page: Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1,
  }
}

export function serializeProjectWorkspaceState(
  state: ProjectWorkspaceState,
): URLSearchParams {
  const parameters = new URLSearchParams()
  if (state.search) parameters.set('q', state.search)
  if (state.status) parameters.set('status', state.status)
  if (state.page > 1) parameters.set('page', state.page.toString())
  return parameters
}

export function isProjectStatus(value: string): value is ProjectStatus {
  return projectStatuses.some((candidate) => candidate === value)
}
