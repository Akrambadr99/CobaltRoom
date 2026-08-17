import { describe, expect, it } from 'vitest'

import { createAppServices } from './services'
import { createAtlasFixtures } from '../data'
import { MemoryPreferenceStorage } from '../preferences'

describe('application services', () => {
  it('binds the default gateway session to the active administrator', () => {
    const services = createAppServices()

    expect(services.session.user.displayName).toBe('Omar Haddad')
    expect(services.session.workspaceMembership.role).toBe('admin')
    expect(services.can('issue:create')).toBe(true)
  })

  it('uses the selected actor for project-scoped authorization decisions', () => {
    const fixtures = createAtlasFixtures()
    const member = fixtures.memberships.find(({ role }) => role === 'member')
    const projectMembership = fixtures.projectMembers.find(
      ({ userId }) => userId === member?.userId,
    )
    const otherProject = fixtures.projects.find(
      ({ id }) => id !== projectMembership?.projectId,
    )

    if (!member || !projectMembership || !otherProject) {
      throw new Error('Expected project-scoped member fixtures.')
    }

    const services = createAppServices({ actorId: member.userId })

    expect(services.can('issue:update', projectMembership.projectId)).toBe(true)
    expect(services.can('issue:update', otherProject.id)).toBe(false)
  })

  it('scopes durable preferences by workspace and actor identity', () => {
    const fixtures = createAtlasFixtures()
    const admin = fixtures.memberships.find(({ role }) => role === 'admin')
    const viewer = fixtures.memberships.find(({ role }) => role === 'viewer')
    const preferenceStorage = new MemoryPreferenceStorage()
    if (!admin || !viewer) throw new Error('Expected fixture identities.')

    const adminServices = createAppServices({
      actorId: admin.userId,
      preferenceStorage,
    })
    adminServices.preferences.setIssuePageSize(25)
    const reloadedAdmin = createAppServices({
      actorId: admin.userId,
      preferenceStorage,
    })
    const viewerServices = createAppServices({
      actorId: viewer.userId,
      preferenceStorage,
    })

    expect(reloadedAdmin.preferences.getSnapshot().issuePageSize).toBe(25)
    expect(viewerServices.preferences.getSnapshot().issuePageSize).toBe(5)
  })
})
