import { describe, expect, it } from 'vitest'

import {
  can,
  getPermissionFingerprint,
  permissions,
  type Permission,
} from './permissions'
import {
  createTestMembership,
  createTestProjectMember,
  testIds,
} from '../test/domain'

describe('permission policy', () => {
  it('denies every action to inactive memberships', () => {
    const context = {
      workspaceMembership: createTestMembership({ status: 'suspended' }),
      projectMembership: createTestProjectMember({ role: 'lead' }),
    }

    for (const permission of permissions) {
      expect(can(context, permission, testIds.project)).toBe(false)
    }
  })

  it('allows an active owner to perform every action', () => {
    const context = {
      workspaceMembership: createTestMembership({ role: 'owner' }),
      projectMembership: null,
    }

    for (const permission of permissions) {
      expect(can(context, permission, testIds.project)).toBe(true)
    }
  })

  it('keeps workspace ownership management exclusive to owners', () => {
    const context = {
      workspaceMembership: createTestMembership({ role: 'admin' }),
      projectMembership: null,
    }

    expect(can(context, 'workspace:manage')).toBe(false)
    expect(can(context, 'members:manage')).toBe(true)
    expect(can(context, 'audit:view')).toBe(true)
    expect(can(context, 'analytics:view')).toBe(true)
  })

  it.each([
    ['lead', ['project:update', 'project:archive', 'issue:delete', 'comment:moderate']],
    ['contributor', ['issue:create', 'issue:update', 'comment:create', 'comment:edit-own']],
    ['viewer', []],
  ] as const)(
    'applies project-scoped permissions for a %s',
    (role, allowedPermissions) => {
      const context = {
        workspaceMembership: createTestMembership({ role: 'member' }),
        projectMembership: createTestProjectMember({ role }),
      }

      for (const permission of allowedPermissions) {
        expect(can(context, permission, testIds.project)).toBe(true)
      }

      const disallowed: Permission = role === 'lead' ? 'workspace:manage' : 'project:archive'
      expect(can(context, disallowed, testIds.project)).toBe(false)
    },
  )

  it('does not transfer project permissions to another project', () => {
    const context = {
      workspaceMembership: createTestMembership({ role: 'member' }),
      projectMembership: createTestProjectMember({ role: 'lead' }),
    }

    expect(can(context, 'issue:update', testIds.secondProject)).toBe(false)
    expect(can(context, 'issue:update')).toBe(false)
  })

  it('grants active workspace viewers read-only access', () => {
    const context = {
      workspaceMembership: createTestMembership({ role: 'viewer' }),
      projectMembership: null,
    }

    expect(can(context, 'workspace:view')).toBe(true)
    expect(can(context, 'project:view')).toBe(true)
    expect(can(context, 'project:subscribe')).toBe(true)
    expect(can(context, 'issue:view')).toBe(true)
    expect(can(context, 'issue:subscribe')).toBe(true)
    expect(can(context, 'notification-preferences:manage-self')).toBe(true)
    expect(can(context, 'audit:view')).toBe(false)
    expect(can(context, 'issue:create', testIds.project)).toBe(false)
  })

  it('separates author comment actions from moderation', () => {
    const contributor = {
      workspaceMembership: createTestMembership({ role: 'member' }),
      projectMembership: createTestProjectMember({ role: 'contributor' }),
    }
    const lead = {
      workspaceMembership: createTestMembership({ role: 'member' }),
      projectMembership: createTestProjectMember({ role: 'lead' }),
    }

    expect(can(contributor, 'comment:edit-own', testIds.project)).toBe(true)
    expect(can(contributor, 'comment:delete-own', testIds.project)).toBe(true)
    expect(can(contributor, 'comment:moderate', testIds.project)).toBe(false)
    expect(can(lead, 'comment:moderate', testIds.project)).toBe(true)
  })

  it('changes the permission fingerprint for role and project-scope changes', () => {
    const membership = createTestMembership({ role: 'admin' })
    const projectMembership = createTestProjectMember({ role: 'lead' })
    const initial = getPermissionFingerprint(membership, [projectMembership])

    expect(
      getPermissionFingerprint({ ...membership, role: 'viewer' }, [projectMembership]),
    ).not.toBe(initial)
    expect(
      getPermissionFingerprint(membership, [
        { ...projectMembership, role: 'contributor' },
      ]),
    ).not.toBe(initial)
  })
})
