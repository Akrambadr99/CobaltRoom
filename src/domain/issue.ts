import type {
  CommentId,
  IssueId,
  IssueRelationId,
  LabelId,
  ProjectId,
  UserId,
  WorkflowStatusId,
  WorkspaceId,
} from './ids'
import type { IsoDate, IsoDateTime } from './time'

export type IssueType = 'task' | 'bug' | 'story'
export type IssuePriority = 'urgent' | 'high' | 'medium' | 'low' | 'none'
export type IssueRelationType = 'blocks' | 'relates-to' | 'duplicates'

export interface Issue {
  readonly id: IssueId
  readonly workspaceId: WorkspaceId
  readonly projectId: ProjectId
  readonly number: number
  readonly type: IssueType
  readonly title: string
  readonly description: string
  readonly statusId: WorkflowStatusId
  readonly priority: IssuePriority
  readonly assigneeId: UserId | null
  readonly parentIssueId: IssueId | null
  readonly dueDate: IsoDate | null
  readonly labelIds: readonly LabelId[]
  readonly revision: number
  readonly createdAt: IsoDateTime
  readonly updatedAt: IsoDateTime
}

export interface IssueRelation {
  readonly id: IssueRelationId
  readonly sourceIssueId: IssueId
  readonly targetIssueId: IssueId
  readonly type: IssueRelationType
}

export interface Label {
  readonly id: LabelId
  readonly workspaceId: WorkspaceId
  readonly name: string
  readonly color: string
  readonly description: string
}

export interface Comment {
  readonly id: CommentId
  readonly issueId: IssueId
  readonly authorId: UserId
  readonly body: string
  readonly revision: number
  readonly createdAt: IsoDateTime
  readonly editedAt: IsoDateTime | null
  readonly deletedAt: IsoDateTime | null
  readonly deletedById: UserId | null
}
