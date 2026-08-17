import { useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import { atlasQueryKeys } from '../../app/query/keys'
import { useAppServices } from '../../app/providers/app-services-context'
import { useAuthorization } from '../../app/providers/authorization-context'
import {
  reconcileIssueWorkspaceState,
  serializeIssueWorkspaceState,
} from '../issues'
import { useUserPreferences, type SavedIssueView } from '../../preferences'

export type CommandCategory = 'Actions' | 'Navigation' | 'Saved views'

export interface AppCommand {
  readonly id: string
  readonly category: CommandCategory
  readonly label: string
  readonly keywords: readonly string[]
  readonly shortcut?: string
  execute(): void | Promise<void>
}

export function useAppCommands(): readonly AppCommand[] {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { gateway, preferences: preferenceRepository, workspaceId } =
    useAppServices()
  const authorization = useAuthorization()
  const preferences = useUserPreferences()

  return useMemo(() => {
    const navigateTo = (path: string) => (): void => {
      void navigate(path)
    }
    const navigationCommands: readonly AppCommand[] = [
      command('navigate.dashboard', 'Go to dashboard', 'Navigation', navigateTo('/'), [
        'home',
        'overview',
      ]),
      command(
        'navigate.projects',
        'Go to projects',
        'Navigation',
        navigateTo('/projects'),
        ['portfolio'],
      ),
      command('navigate.issues', 'Go to issues', 'Navigation', navigateTo('/issues'), [
        'work',
        'tasks',
      ]),
      command('navigate.board', 'Go to board', 'Navigation', navigateTo('/board'), [
        'kanban',
        'workflow',
      ]),
    ]
    const canCreateIssue =
      authorization.can('issue:create') ||
      authorization.session.projectMemberships.some(({ projectId }) =>
        authorization.can('issue:create', projectId),
      )
    const actionCommands: readonly AppCommand[] = canCreateIssue
      ? [
          command(
            'issue.create',
            'Create issue',
            'Actions',
            navigateTo('/issues?create=1'),
            ['new', 'task', 'bug', 'story'],
          ),
        ]
      : []
    const openSavedView =
      (view: SavedIssueView) => async (): Promise<void> => {
        const metadata = await queryClient.fetchQuery({
          queryKey: atlasQueryKeys.issueFilterMetadata(workspaceId),
          queryFn: ({ signal }) =>
            gateway.getIssueFilterMetadata(workspaceId, { signal }),
          staleTime: 0,
        })
        const reconciled = reconcileIssueWorkspaceState(
          view.state,
          metadata.projects.map(({ project, statuses }) => ({
            id: project.id,
            statusIds: statuses.map(({ id }) => id),
          })),
        )
        let filterStatus = ''
        if (reconciled !== view.state) {
          try {
            preferenceRepository.updateIssueViewState(view.id, reconciled)
            filterStatus =
              'Unavailable workflow filters were removed and the saved view was updated.'
          } catch (error) {
            filterStatus = error instanceof Error
              ? `Unavailable workflow filters were removed, but ${error.message.toLocaleLowerCase()}`
              : 'Unavailable workflow filters were removed, but the saved view could not be updated.'
          }
        }
        void navigate(
          `/issues?${serializeIssueWorkspaceState(reconciled).toString()}`,
          { state: filterStatus ? { filterStatus } : null },
        )
      }
    const savedViewCommands = preferences.savedIssueViews.map((view) =>
      command(
        `saved-view.${view.id}`,
        `Open saved view: ${view.name}`,
        'Saved views',
        openSavedView(view),
        ['filter', 'issues', view.name],
      ),
    )

    return [...actionCommands, ...navigationCommands, ...savedViewCommands]
  }, [
    authorization,
    gateway,
    navigate,
    preferenceRepository,
    preferences.savedIssueViews,
    queryClient,
    workspaceId,
  ])
}

function command(
  id: string,
  label: string,
  category: CommandCategory,
  execute: () => void | Promise<void>,
  keywords: readonly string[],
): AppCommand {
  return { id, label, category, execute, keywords }
}

export function filterCommands(
  commands: readonly AppCommand[],
  search: string,
): readonly AppCommand[] {
  const terms = search
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  if (terms.length === 0) return commands

  return commands.filter((item) => {
    const searchable = [item.label, item.category, ...item.keywords]
      .join(' ')
      .toLocaleLowerCase()
    return terms.every((term) => searchable.includes(term))
  })
}
