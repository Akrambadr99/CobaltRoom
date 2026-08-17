import { describe, expect, it } from 'vitest'

import { createAppServices } from './services'
import { createAtlasFixtures } from '../data'

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
})
