import { describe, expect, it } from 'vitest'

import {
  InvalidDomainIdError,
  issueId,
  notificationId,
  notificationPreferenceId,
  projectId,
  userId,
  workspaceId,
} from './ids'

describe('domain identifiers', () => {
  it.each([
    [workspaceId, 'ws_atlas'],
    [userId, 'usr_akram'],
    [projectId, 'prj_launch'],
    [issueId, 'issue_launch_42'],
    [notificationId, 'notification_launch_42'],
    [notificationPreferenceId, 'notification_pref_launch_42'],
  ])('constructs a valid prefixed identifier', (factory, value) => {
    expect(factory(value)).toBe(value)
  })

  it.each([
    [workspaceId, 'workspace_atlas'],
    [userId, 'usr_Akram'],
    [projectId, 'prj_'],
    [issueId, ' issue_launch_42'],
    [notificationId, 'notice_launch_42'],
    [notificationPreferenceId, 'notification_preference_launch_42'],
  ])('rejects an invalid prefixed identifier', (factory, value) => {
    expect(() => factory(value)).toThrow(InvalidDomainIdError)
  })
})
