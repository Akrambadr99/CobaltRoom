import {
  issueId,
  issueRelationId,
  membershipId,
  projectId,
  projectMemberId,
  userId,
  workflowStatusId,
  workspaceId,
  isoDateTime,
  type Issue,
  type IssueRelation,
  type Membership,
  type Project,
  type ProjectMember,
  type WorkflowStatus,
} from '../domain'

export const testIds = {
  workspace: workspaceId('ws_atlas'),
  user: userId('usr_akram'),
  secondUser: userId('usr_mina'),
  membership: membershipId('mem_akram'),
  project: projectId('prj_launch'),
  secondProject: projectId('prj_mobile'),
  projectMember: projectMemberId('pm_akram_launch'),
  status: workflowStatusId('status_backlog'),
  secondStatus: workflowStatusId('status_active'),
  issue: issueId('issue_launch_1'),
  secondIssue: issueId('issue_launch_2'),
  thirdIssue: issueId('issue_launch_3'),
} as const

const timestamp = isoDateTime('2026-01-15T09:00:00.000Z')

export function createTestMembership(
  overrides: Partial<Membership> = {},
): Membership {
  return {
    id: testIds.membership,
    workspaceId: testIds.workspace,
    userId: testIds.user,
    role: 'member',
    status: 'active',
    joinedAt: timestamp,
    revision: 1,
    ...overrides,
  }
}

export function createTestProject(overrides: Partial<Project> = {}): Project {
  return {
    id: testIds.project,
    workspaceId: testIds.workspace,
    key: 'OPS',
    name: 'Launch operations',
    description: 'Coordinate the launch workspace.',
    leadId: testIds.user,
    status: 'active',
    revision: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  }
}

export function createTestProjectMember(
  overrides: Partial<ProjectMember> = {},
): ProjectMember {
  return {
    id: testIds.projectMember,
    projectId: testIds.project,
    userId: testIds.user,
    role: 'contributor',
    ...overrides,
  }
}

export function createTestWorkflowStatus(
  overrides: Partial<WorkflowStatus> = {},
): WorkflowStatus {
  return {
    id: testIds.status,
    projectId: testIds.project,
    name: 'Backlog',
    category: 'backlog',
    order: 0,
    ...overrides,
  }
}

export function createTestIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: testIds.issue,
    workspaceId: testIds.workspace,
    projectId: testIds.project,
    number: 1,
    type: 'task',
    title: 'Prepare launch brief',
    description: 'Create the shared launch brief.',
    statusId: testIds.status,
    priority: 'medium',
    assigneeId: testIds.user,
    parentIssueId: null,
    dueDate: null,
    labelIds: [],
    revision: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  }
}

export function createTestRelation(
  sourceIssueId = testIds.issue,
  targetIssueId = testIds.secondIssue,
  overrides: Partial<IssueRelation> = {},
): IssueRelation {
  return {
    id: issueRelationId(`rel_${sourceIssueId}_${targetIssueId}`),
    sourceIssueId,
    targetIssueId,
    type: 'blocks',
    ...overrides,
  }
}
