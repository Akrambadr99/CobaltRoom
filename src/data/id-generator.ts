import {
  activityEventId,
  auditEventId,
  commentId,
  issueId,
  issueRelationId,
  labelId,
  membershipId,
  workspaceInvitationId,
  notificationId,
  notificationPreferenceId,
  projectId,
  projectMemberId,
  userId,
  workflowStatusId,
  workspaceId,
  type ActivityEventId,
  type AuditEventId,
  type CommentId,
  type IssueId,
  type IssueRelationId,
  type LabelId,
  type MembershipId,
  type WorkspaceInvitationId,
  type NotificationId,
  type NotificationPreferenceId,
  type ProjectId,
  type ProjectMemberId,
  type UserId,
  type WorkflowStatusId,
  type WorkspaceId,
} from '../domain'

const idSegmentPattern = /^[a-z0-9]+(?:_[a-z0-9]+)*$/

export class DeterministicIdGenerator {
  private readonly namespace: string
  private readonly counters = new Map<string, number>()

  constructor(namespace: string) {
    if (!idSegmentPattern.test(namespace)) {
      throw new TypeError('Identifier namespaces must be lowercase slug segments.')
    }

    this.namespace = namespace
  }

  workspace(scope: string): WorkspaceId {
    return workspaceId(this.next('ws', scope))
  }

  user(scope: string): UserId {
    return userId(this.next('usr', scope))
  }

  membership(scope: string): MembershipId {
    return membershipId(this.next('mem', scope))
  }

  workspaceInvitation(scope: string): WorkspaceInvitationId {
    return workspaceInvitationId(this.next('invite', scope))
  }

  project(scope: string): ProjectId {
    return projectId(this.next('prj', scope))
  }

  projectMember(scope: string): ProjectMemberId {
    return projectMemberId(this.next('pm', scope))
  }

  workflowStatus(scope: string): WorkflowStatusId {
    return workflowStatusId(this.next('status', scope))
  }

  issue(scope: string): IssueId {
    return issueId(this.next('issue', scope))
  }

  issueRelation(scope: string): IssueRelationId {
    return issueRelationId(this.next('rel', scope))
  }

  label(scope: string): LabelId {
    return labelId(this.next('label', scope))
  }

  comment(scope: string): CommentId {
    return commentId(this.next('comment', scope))
  }

  activity(scope: string): ActivityEventId {
    return activityEventId(this.next('activity', scope))
  }

  audit(scope: string): AuditEventId {
    return auditEventId(this.next('audit', scope))
  }

  notification(scope: string): NotificationId {
    return notificationId(this.next('notification', scope))
  }

  notificationPreference(scope: string): NotificationPreferenceId {
    return notificationPreferenceId(this.next('notification_pref', scope))
  }

  private next(prefix: string, scope: string): string {
    if (!idSegmentPattern.test(scope)) {
      throw new TypeError('Identifier scopes must be lowercase slug segments.')
    }

    const counterKey = `${prefix}:${scope}`
    const sequence = (this.counters.get(counterKey) ?? 0) + 1
    this.counters.set(counterKey, sequence)

    return `${prefix}_${this.namespace}_${scope}_${sequence.toString().padStart(3, '0')}`
  }
}
