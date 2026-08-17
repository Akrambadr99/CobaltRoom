import { describe, expect, it } from 'vitest'

import { createAtlasFixtures } from './fixtures'
import { DataIntegrityError } from './snapshot-validation'
import { InMemoryDataStore, StaleSnapshotError } from './store'
import {
  commentMentionId,
  issueId,
  issueSubscriptionId,
  isoDateTime,
  userId,
  workspaceInvitationId,
} from '../domain'

describe('InMemoryDataStore', () => {
  it('isolates stored state from caller-owned snapshots', () => {
    const seed = createAtlasFixtures()
    const store = new InMemoryDataStore(seed)
    const firstRead = store.read()
    const [firstProject, ...remainingProjects] = firstRead.data.projects

    if (!firstProject) {
      throw new Error('Expected the fixture project.')
    }

    const changedProject = {
      ...firstProject,
      name: 'Locally changed name',
    }
    const callerOwnedSnapshot = {
      ...firstRead.data,
      projects: [changedProject, ...remainingProjects],
    }

    expect(store.read().data.projects[0]?.name).toBe('Launch readiness')
    expect(callerOwnedSnapshot.projects[0]?.name).toBe('Locally changed name')
  })

  it('commits valid snapshots atomically and increments the version', () => {
    const store = new InMemoryDataStore(createAtlasFixtures())
    const current = store.read()
    const [firstProject, ...remainingProjects] = current.data.projects

    if (!firstProject) {
      throw new Error('Expected the fixture project.')
    }

    const changedProject = {
      ...firstProject,
      name: 'Launch command center',
    }
    const nextData = {
      ...current.data,
      projects: [changedProject, ...remainingProjects],
    }

    const committed = store.commit(current.version, nextData)

    expect(committed.version).toBe(1)
    expect(committed.data.projects[0]?.name).toBe('Launch command center')
    expect(store.read()).toEqual(committed)
  })

  it('rejects stale concurrent writes without changing stored data', () => {
    const store = new InMemoryDataStore(createAtlasFixtures())
    const firstReader = store.read()
    const secondReader = store.read()

    store.commit(firstReader.version, firstReader.data)

    expect(() => store.commit(secondReader.version, secondReader.data)).toThrow(
      StaleSnapshotError,
    )
    expect(store.read().version).toBe(1)
  })

  it('rejects invalid seeds and invalid commits', () => {
    const seed = createAtlasFixtures()
    const [workspace] = seed.workspaces

    if (!workspace) {
      throw new Error('Expected the fixture workspace.')
    }

    const duplicateWorkspace = {
      ...seed,
      workspaces: [...seed.workspaces, workspace],
    }

    expect(() => new InMemoryDataStore(duplicateWorkspace)).toThrow(
      DataIntegrityError,
    )

    const store = new InMemoryDataStore(seed)
    const current = store.read()
    const orphanedIssues = {
      ...current.data,
      workflowStatuses: [],
    }

    expect(() => store.commit(current.version, orphanedIssues)).toThrow()
    expect(store.read().version).toBe(0)
  })

  it('rejects activity and audit records with orphaned actors', () => {
    const seed = createAtlasFixtures()
    const activity = seed.activityEvents[0]
    const audit = seed.auditEvents[0]

    if (!activity || !audit) throw new Error('Expected history fixtures.')

    expect(
      () =>
        new InMemoryDataStore({
          ...seed,
          activityEvents: [
            { ...activity, actorId: userId('usr_missing_activity_actor') },
          ],
        }),
    ).toThrow(DataIntegrityError)
    expect(
      () =>
        new InMemoryDataStore({
          ...seed,
          auditEvents: [
            { ...audit, actorId: userId('usr_missing_audit_actor') },
          ],
        }),
    ).toThrow(DataIntegrityError)
  })

  it('rejects notifications whose typed target is outside the workspace', () => {
    const seed = createAtlasFixtures()
    const notification = seed.notifications[0]
    if (!notification) throw new Error('Expected a notification fixture.')

    expect(() => new InMemoryDataStore({
      ...seed,
      notifications: [{
        ...notification,
        target: { kind: 'issue', id: issueId('issue_missing_notification_target') },
      }],
    })).toThrow(DataIntegrityError)
  })

  it('rejects orphaned and duplicate issue subscriptions', () => {
    const seed = createAtlasFixtures()
    const subscription = seed.issueSubscriptions[0]
    if (!subscription) throw new Error('Expected an issue subscription fixture.')

    expect(
      () =>
        new InMemoryDataStore({
          ...seed,
          issueSubscriptions: [
            {
              ...subscription,
              id: issueSubscriptionId('subscription_store_orphan_001'),
              userId: userId('usr_missing_subscription_owner'),
            },
          ],
        }),
    ).toThrow(DataIntegrityError)
    expect(
      () =>
        new InMemoryDataStore({
          ...seed,
          issueSubscriptions: [
            ...seed.issueSubscriptions,
            {
              ...subscription,
              id: issueSubscriptionId('subscription_store_duplicate_001'),
            },
          ],
        }),
    ).toThrow(DataIntegrityError)
  })

  it('rejects orphaned and duplicate delivered comment mentions', () => {
    const seed = createAtlasFixtures()
    const comment = seed.comments[0]
    const recipient = seed.users.find(({ id }) => id !== comment?.authorId)
    if (!comment || !recipient) throw new Error('Expected comment mention fixtures.')
    const mention = {
      id: commentMentionId('mention_store_recipient_001'),
      commentId: comment.id,
      userId: recipient.id,
      createdAt: comment.createdAt,
    }

    expect(
      () =>
        new InMemoryDataStore({
          ...seed,
          commentMentions: [
            { ...mention, userId: userId('usr_missing_mention_recipient') },
          ],
        }),
    ).toThrow(DataIntegrityError)
    expect(
      () =>
        new InMemoryDataStore({
          ...seed,
          commentMentions: [
            mention,
            { ...mention, id: commentMentionId('mention_store_duplicate_001') },
          ],
        }),
    ).toThrow(DataIntegrityError)
  })

  it('rejects invalid project revisions and mismatched lead memberships', () => {
    const seed = createAtlasFixtures()
    const project = seed.projects[0]
    if (!project) throw new Error('Expected a fixture project.')

    expect(
      () =>
        new InMemoryDataStore({
          ...seed,
          projects: seed.projects.map((candidate) =>
            candidate.id === project.id ? { ...candidate, revision: 0 } : candidate,
          ),
        }),
    ).toThrow(DataIntegrityError)
    expect(
      () =>
        new InMemoryDataStore({
          ...seed,
          projectMembers: seed.projectMembers.map((membership) =>
            membership.projectId === project.id && membership.role === 'lead'
              ? { ...membership, role: 'contributor' as const }
              : membership,
          ),
        }),
    ).toThrow(DataIntegrityError)
  })

  it('rejects malformed and duplicate pending workspace invitations', () => {
    const seed = createAtlasFixtures()
    const workspace = seed.workspaces[0]
    const actor = seed.memberships.find(({ role }) => role === 'admin')
    if (!workspace || !actor) throw new Error('Expected invitation fixtures.')
    const invitation = {
      id: workspaceInvitationId('invite_store_member_001'),
      workspaceId: workspace.id,
      email: 'new.member@example.test',
      role: 'member' as const,
      state: 'pending' as const,
      invitedById: actor.userId,
      createdAt: isoDateTime('2026-02-01T08:00:00.000Z'),
      lastSentAt: isoDateTime('2026-02-01T08:00:00.000Z'),
      expiresAt: isoDateTime('2026-02-08T08:00:00.000Z'),
      acceptedAt: null,
      revokedAt: null,
      revision: 1,
    }

    expect(
      () =>
        new InMemoryDataStore({
          ...seed,
          workspaceInvitations: [
            invitation,
            { ...invitation, id: workspaceInvitationId('invite_store_member_002') },
          ],
        }),
    ).toThrow(DataIntegrityError)
    expect(
      () =>
        new InMemoryDataStore({
          ...seed,
          workspaceInvitations: [
            {
              ...invitation,
              email: 'New.Member@example.test',
            },
          ],
        }),
    ).toThrow(DataIntegrityError)
  })
})
