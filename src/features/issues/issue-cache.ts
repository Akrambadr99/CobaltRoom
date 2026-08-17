import type { InfiniteData, QueryClient } from '@tanstack/react-query'

import type { Page } from '../../data'
import type { Issue, WorkspaceId } from '../../domain'
import { atlasQueryKeys } from '../query-keys'

/**
 * Stops reads whose results are derived from issue state before a mutation begins.
 * The settled mutation invalidates the same boundaries to recover authoritative data.
 */
export async function cancelIssueDerivedReads(
  queryClient: QueryClient,
  workspaceId: WorkspaceId,
): Promise<void> {
  await Promise.all([
    queryClient.cancelQueries({
      queryKey: atlasQueryKeys.workspaceIssues(workspaceId),
    }),
    queryClient.cancelQueries({
      queryKey: atlasQueryKeys.analytics(workspaceId),
    }),
    queryClient.cancelQueries({
      queryKey: atlasQueryKeys.notificationInbox(workspaceId),
    }),
  ])
}

/**
 * Reconciles every currently cached representation of an issue. Older mutation
 * responses are ignored so overlapping surfaces cannot regress a newer revision.
 */
export function reconcileIssueCaches(
  queryClient: QueryClient,
  workspaceId: WorkspaceId,
  updated: Issue,
): void {
  queryClient.setQueriesData(
    { queryKey: atlasQueryKeys.workspaceIssues(workspaceId) },
    (current) => replaceCachedIssue(current, updated),
  )
  queryClient.setQueryData(
    atlasQueryKeys.issue(workspaceId, updated.id),
    (current: Issue | undefined) => newestIssue(current, updated),
  )
}

/** Restores an optimistic issue only while that exact optimistic revision owns the cache. */
export function rollbackIssueCaches(
  queryClient: QueryClient,
  workspaceId: WorkspaceId,
  previous: Issue,
  optimisticRevision: number,
): void {
  queryClient.setQueriesData(
    { queryKey: atlasQueryKeys.workspaceIssues(workspaceId) },
    (current) => replaceCachedIssueAtRevision(current, previous, optimisticRevision),
  )
  queryClient.setQueryData(
    atlasQueryKeys.issue(workspaceId, previous.id),
    (current: Issue | undefined) =>
      current?.revision === optimisticRevision ? previous : current,
  )
}

function replaceCachedIssue(current: unknown, updated: Issue): unknown {
  if (isIssue(current)) return newestIssue(current, updated)
  if (isIssuePage(current)) return replaceIssueInPage(current, updated)
  if (isInfiniteIssueData(current)) {
    return {
      ...current,
      pages: current.pages.map((page) => replaceIssueInPage(page, updated)),
    }
  }
  return current
}

function replaceIssueInPage(page: Page<Issue>, updated: Issue): Page<Issue> {
  return {
    ...page,
    items: page.items.map((candidate) => newestIssue(candidate, updated)),
  }
}

function replaceCachedIssueAtRevision(
  current: unknown,
  previous: Issue,
  optimisticRevision: number,
): unknown {
  if (isIssue(current)) {
    return current.id === previous.id && current.revision === optimisticRevision
      ? previous
      : current
  }
  if (isIssuePage(current)) {
    return rollbackIssueInPage(current, previous, optimisticRevision)
  }
  if (isInfiniteIssueData(current)) {
    return {
      ...current,
      pages: current.pages.map((page) =>
        rollbackIssueInPage(page, previous, optimisticRevision),
      ),
    }
  }
  return current
}

function rollbackIssueInPage(
  page: Page<Issue>,
  previous: Issue,
  optimisticRevision: number,
): Page<Issue> {
  return {
    ...page,
    items: page.items.map((candidate) =>
      candidate.id === previous.id && candidate.revision === optimisticRevision
        ? previous
        : candidate,
    ),
  }
}

function newestIssue(current: Issue | undefined, updated: Issue): Issue {
  if (current?.id !== updated.id) return current ?? updated
  return current.revision > updated.revision ? current : updated
}

function isIssue(value: unknown): value is Issue {
  if (!isRecord(value)) return false
  return (
    typeof value['id'] === 'string' &&
    typeof value['projectId'] === 'string' &&
    typeof value['revision'] === 'number' &&
    typeof value['title'] === 'string'
  )
}

function isIssuePage(value: unknown): value is Page<Issue> {
  if (!isRecord(value) || !Array.isArray(value['items'])) return false
  return (
    typeof value['pageNumber'] === 'number' &&
    value['items'].every((item) => isIssue(item))
  )
}

function isInfiniteIssueData(
  value: unknown,
): value is InfiniteData<Page<Issue>, number> {
  if (!isRecord(value) || !Array.isArray(value['pages'])) return false
  return value['pages'].every((page) => isIssuePage(page))
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null
}
