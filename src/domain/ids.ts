declare const domainIdBrand: unique symbol

type DomainId<TName extends string> = string & {
  readonly [domainIdBrand]: TName
}

export type WorkspaceId = DomainId<'WorkspaceId'>
export type UserId = DomainId<'UserId'>
export type MembershipId = DomainId<'MembershipId'>
export type WorkspaceInvitationId = DomainId<'WorkspaceInvitationId'>
export type ProjectId = DomainId<'ProjectId'>
export type ProjectMemberId = DomainId<'ProjectMemberId'>
export type ProjectSubscriptionId = DomainId<'ProjectSubscriptionId'>
export type WorkflowStatusId = DomainId<'WorkflowStatusId'>
export type IssueId = DomainId<'IssueId'>
export type IssueSubscriptionId = DomainId<'IssueSubscriptionId'>
export type IssueRelationId = DomainId<'IssueRelationId'>
export type LabelId = DomainId<'LabelId'>
export type CommentId = DomainId<'CommentId'>
export type CommentMentionId = DomainId<'CommentMentionId'>
export type ActivityEventId = DomainId<'ActivityEventId'>
export type AuditEventId = DomainId<'AuditEventId'>
export type NotificationId = DomainId<'NotificationId'>
export type NotificationPreferenceId = DomainId<'NotificationPreferenceId'>

export class InvalidDomainIdError extends Error {
  readonly kind: string
  readonly value: string

  constructor(kind: string, value: string) {
    super(`${kind} must use its required prefix and a lowercase slug.`)
    this.name = 'InvalidDomainIdError'
    this.kind = kind
    this.value = value
  }
}

const slugPattern = /^[a-z0-9]+(?:_[a-z0-9]+)*$/

function createDomainId<TName extends string>(
  value: string,
  prefix: string,
  kind: TName,
): DomainId<TName> {
  const expectedPrefix = `${prefix}_`
  const suffix = value.slice(expectedPrefix.length)

  if (!value.startsWith(expectedPrefix) || !slugPattern.test(suffix)) {
    throw new InvalidDomainIdError(kind, value)
  }

  return value as DomainId<TName>
}

export const workspaceId = (value: string) =>
  createDomainId(value, 'ws', 'WorkspaceId')
export const userId = (value: string) =>
  createDomainId(value, 'usr', 'UserId')
export const membershipId = (value: string) =>
  createDomainId(value, 'mem', 'MembershipId')
export const workspaceInvitationId = (value: string) =>
  createDomainId(value, 'invite', 'WorkspaceInvitationId')
export const projectId = (value: string) =>
  createDomainId(value, 'prj', 'ProjectId')
export const projectMemberId = (value: string) =>
  createDomainId(value, 'pm', 'ProjectMemberId')
export const projectSubscriptionId = (value: string) =>
  createDomainId(value, 'project_subscription', 'ProjectSubscriptionId')
export const workflowStatusId = (value: string) =>
  createDomainId(value, 'status', 'WorkflowStatusId')
export const issueId = (value: string) =>
  createDomainId(value, 'issue', 'IssueId')
export const issueSubscriptionId = (value: string) =>
  createDomainId(value, 'subscription', 'IssueSubscriptionId')
export const issueRelationId = (value: string) =>
  createDomainId(value, 'rel', 'IssueRelationId')
export const labelId = (value: string) =>
  createDomainId(value, 'label', 'LabelId')
export const commentId = (value: string) =>
  createDomainId(value, 'comment', 'CommentId')
export const commentMentionId = (value: string) =>
  createDomainId(value, 'mention', 'CommentMentionId')
export const activityEventId = (value: string) =>
  createDomainId(value, 'activity', 'ActivityEventId')
export const auditEventId = (value: string) =>
  createDomainId(value, 'audit', 'AuditEventId')
export const notificationId = (value: string) =>
  createDomainId(value, 'notification', 'NotificationId')
export const notificationPreferenceId = (value: string) =>
  createDomainId(value, 'notification_pref', 'NotificationPreferenceId')
