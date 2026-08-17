import { describe, expect, it } from 'vitest'

import {
  InvalidDomainIdError,
  issueId,
  issueSubscriptionId,
  notificationId,
  notificationPreferenceId,
  projectId,
  userId,
  workspaceId,
  workspaceInvitationId,
} from './ids'

describe('domain identifiers', () => {
  it.each([
    [workspaceId, 'ws_atlas'],
    [workspaceInvitationId, 'invite_workspace_member_001'],
    [userId, 'usr_akram'],
    [projectId, 'prj_launch'],
    [issueId, 'issue_launch_42'],
    [issueSubscriptionId, 'subscription_launch_42'],
    [notificationId, 'notification_launch_42'],
    [notificationPreferenceId, 'notification_pref_launch_42'],
  ])('constructs a valid prefixed identifier', (factory, value) => {
    expect(factory(value)).toBe(value)
  })

  it.each([
    [workspaceId, 'workspace_atlas'],
    [workspaceInvitationId, 'inv_workspace_member_001'],
    [userId, 'usr_Akram'],
    [projectId, 'prj_'],
    [issueId, ' issue_launch_42'],
    [issueSubscriptionId, 'watch_launch_42'],
    [notificationId, 'notice_launch_42'],
    [notificationPreferenceId, 'notification_preference_launch_42'],
  ])('rejects an invalid prefixed identifier', (factory, value) => {
    expect(() => factory(value)).toThrow(InvalidDomainIdError)
  })
})
