import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuthorization } from '../../app/providers/authorization-context'
import { serializeIssueWorkspaceState } from '../issues/issue-workspace-state'
import { useUserPreferences } from '../../preferences'

export type CommandCategory = 'Actions' | 'Navigation' | 'Saved views'

export interface AppCommand {
  readonly id: string
  readonly category: CommandCategory
  readonly label: string
  readonly keywords: readonly string[]
  readonly shortcut?: string
  execute(): void
}

export function useAppCommands(): readonly AppCommand[] {
  const navigate = useNavigate()
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
    const savedViewCommands = preferences.savedIssueViews.map((view) =>
      command(
        `saved-view.${view.id}`,
        `Open saved view: ${view.name}`,
        'Saved views',
        navigateTo(`/issues?${serializeIssueWorkspaceState(view.state).toString()}`),
        ['filter', 'issues', view.name],
      ),
    )

    return [...actionCommands, ...navigationCommands, ...savedViewCommands]
  }, [authorization, navigate, preferences.savedIssueViews])
}

function command(
  id: string,
  label: string,
  category: CommandCategory,
  execute: () => void,
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
