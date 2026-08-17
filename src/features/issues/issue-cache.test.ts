import { QueryClient, type InfiniteData } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import { createAtlasFixtures, type Page } from '../../data'
import type { Issue } from '../../domain'
import { atlasQueryKeys } from '../query-keys'
import {
  cancelIssueDerivedReads,
  reconcileIssueCaches,
  rollbackIssueCaches,
} from './issue-cache'

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
}

function issuePage(issue: Issue): Page<Issue> {
  return {
    items: [issue],
    pageNumber: 1,
    pageSize: 20,
    pageCount: 1,
    totalItems: 1,
  }
}

describe('issue cache coordination', () => {
  it('reconciles detail, paged, and board caches without regressing revisions', () => {
    const queryClient = createQueryClient()
    const fixtures = createAtlasFixtures()
    const workspace = fixtures.workspaces[0]
    const issue = fixtures.issues[0]
    if (!workspace || !issue) throw new Error('Expected workspace and issue fixtures.')
    const updated = {
      ...issue,
      title: 'Newest coordinated title',
      revision: issue.revision + 1,
    }
    const newerDetail = {
      ...updated,
      title: 'A later detail revision',
      revision: updated.revision + 1,
    }
    const indexKey = atlasQueryKeys.issues(workspace.id, {
      filters: { workspaceId: workspace.id },
      page: { number: 1, size: 20 },
    })
    const boardKey = atlasQueryKeys.boardIssues(workspace.id, issue.projectId)
    const boardData: InfiniteData<Page<Issue>, number> = {
      pages: [issuePage(issue)],
      pageParams: [1],
    }

    queryClient.setQueryData(indexKey, issuePage(issue))
    queryClient.setQueryData(boardKey, boardData)
    queryClient.setQueryData(
      atlasQueryKeys.issue(workspace.id, issue.id),
      newerDetail,
    )
    reconcileIssueCaches(queryClient, workspace.id, updated)

    expect(queryClient.getQueryData<Page<Issue>>(indexKey)?.items[0]).toEqual(
      updated,
    )
    expect(
      queryClient.getQueryData<InfiniteData<Page<Issue>, number>>(boardKey)
        ?.pages[0]?.items[0],
    ).toEqual(updated)
    expect(
      queryClient.getQueryData<Issue>(
        atlasQueryKeys.issue(workspace.id, issue.id),
      ),
    ).toEqual(newerDetail)

    reconcileIssueCaches(queryClient, workspace.id, issue)
    expect(queryClient.getQueryData<Page<Issue>>(indexKey)?.items[0]).toEqual(
      updated,
    )

    rollbackIssueCaches(queryClient, workspace.id, issue, updated.revision)
    expect(queryClient.getQueryData<Page<Issue>>(indexKey)?.items[0]).toEqual(issue)
    expect(
      queryClient.getQueryData<InfiniteData<Page<Issue>, number>>(boardKey)
        ?.pages[0]?.items[0],
    ).toEqual(issue)
    expect(
      queryClient.getQueryData<Issue>(
        atlasQueryKeys.issue(workspace.id, issue.id),
      ),
    ).toEqual(newerDetail)
  })

  it('aborts every issue-derived read boundary before a mutation proceeds', async () => {
    const queryClient = createQueryClient()
    const fixtures = createAtlasFixtures()
    const workspace = fixtures.workspaces[0]
    if (!workspace) throw new Error('Expected a workspace fixture.')
    const aborted = new Set<string>()
    const pendingRead = (name: string, signal: AbortSignal) =>
      new Promise<never>((_resolve, reject) => {
        signal.addEventListener(
          'abort',
          () => {
            aborted.add(name)
            reject(new Error(`${name} aborted`))
          },
          { once: true },
        )
      })
    const reads = [
      queryClient.fetchQuery({
        queryKey: atlasQueryKeys.issues(workspace.id, {
          filters: { workspaceId: workspace.id },
          page: { number: 1, size: 20 },
        }),
        queryFn: ({ signal }) => pendingRead('issues', signal),
      }),
      queryClient.fetchQuery({
        queryKey: atlasQueryKeys.analytics(workspace.id),
        queryFn: ({ signal }) => pendingRead('analytics', signal),
      }),
      queryClient.fetchQuery({
        queryKey: atlasQueryKeys.notificationInbox(workspace.id),
        queryFn: ({ signal }) => pendingRead('notifications', signal),
      }),
    ].map((read) => read.catch(() => undefined))

    await Promise.resolve()
    await cancelIssueDerivedReads(queryClient, workspace.id)
    await Promise.all(reads)

    expect([...aborted].sort()).toEqual(['analytics', 'issues', 'notifications'])
  })
})
