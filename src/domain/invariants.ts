import type { Issue, IssueRelation } from './issue'
import type { Membership } from './workspace'
import type { Project, WorkflowStatus } from './project'
import type { IssueId } from './ids'

export type DomainInvariantCode =
  | 'duplicate-membership'
  | 'invalid-project-key'
  | 'invalid-workflow'
  | 'invalid-issue-relation'
  | 'cyclic-issue-dependency'

export class DomainInvariantError extends Error {
  readonly code: DomainInvariantCode

  constructor(code: DomainInvariantCode, message: string) {
    super(message)
    this.name = 'DomainInvariantError'
    this.code = code
  }
}

export function assertProjectKey(key: string): void {
  if (!/^[A-Z][A-Z0-9]{1,9}$/.test(key)) {
    throw new DomainInvariantError(
      'invalid-project-key',
      'Project keys must contain 2-10 uppercase letters or digits and begin with a letter.',
    )
  }
}

export function assertUniqueMemberships(memberships: readonly Membership[]): void {
  const seen = new Set<string>()

  for (const membership of memberships) {
    const identity = `${membership.workspaceId}:${membership.userId}`

    if (seen.has(identity)) {
      throw new DomainInvariantError(
        'duplicate-membership',
        'A user may have only one membership in a workspace.',
      )
    }

    seen.add(identity)
  }
}

export function assertProjectWorkflow(
  project: Project,
  statuses: readonly WorkflowStatus[],
): void {
  if (statuses.length === 0) {
    throw new DomainInvariantError(
      'invalid-workflow',
      'A project workflow must contain at least one status.',
    )
  }

  const ids = new Set<string>()
  const names = new Set<string>()
  const orders = new Set<number>()

  for (const status of statuses) {
    const normalizedName = status.name.trim().toLocaleLowerCase()

    if (
      status.projectId !== project.id ||
      normalizedName.length === 0 ||
      ids.has(status.id) ||
      names.has(normalizedName) ||
      orders.has(status.order)
    ) {
      throw new DomainInvariantError(
        'invalid-workflow',
        'Workflow statuses must belong to the project and use unique ids, names, and order values.',
      )
    }

    ids.add(status.id)
    names.add(normalizedName)
    orders.add(status.order)
  }

  const sortedOrders = [...orders].sort((left, right) => left - right)
  const isContiguous = sortedOrders.every((order, index) => order === index)

  if (!isContiguous) {
    throw new DomainInvariantError(
      'invalid-workflow',
      'Workflow status order must be contiguous and start at zero.',
    )
  }
}

export function assertIssueRelations(
  issues: readonly Issue[],
  relations: readonly IssueRelation[],
): void {
  const issuesById = new Map(issues.map((issue) => [issue.id, issue]))
  const relationKeys = new Set<string>()
  const blockingGraph = new Map<IssueId, IssueId[]>()

  for (const issue of issues) {
    blockingGraph.set(issue.id, [])
  }

  for (const relation of relations) {
    const source = issuesById.get(relation.sourceIssueId)
    const target = issuesById.get(relation.targetIssueId)
    const relationKey = `${relation.sourceIssueId}:${relation.targetIssueId}:${relation.type}`

    if (!source || !target) {
      throw new DomainInvariantError(
        'invalid-issue-relation',
        'Issue relations require distinct, existing issues in the same project and may not be duplicated.',
      )
    }

    if (
      source.projectId !== target.projectId ||
      source.id === target.id ||
      relationKeys.has(relationKey)
    ) {
      throw new DomainInvariantError(
        'invalid-issue-relation',
        'Issue relations require distinct, existing issues in the same project and may not be duplicated.',
      )
    }

    relationKeys.add(relationKey)

    if (relation.type === 'blocks') {
      blockingGraph.get(source.id)?.push(target.id)
    }
  }

  assertAcyclicGraph(blockingGraph)
}

function assertAcyclicGraph(graph: ReadonlyMap<IssueId, readonly IssueId[]>): void {
  const visiting = new Set<IssueId>()
  const visited = new Set<IssueId>()

  const visit = (issueId: IssueId): void => {
    if (visiting.has(issueId)) {
      throw new DomainInvariantError(
        'cyclic-issue-dependency',
        'Blocking issue relations must form an acyclic graph.',
      )
    }

    if (visited.has(issueId)) {
      return
    }

    visiting.add(issueId)

    for (const blockedIssueId of graph.get(issueId) ?? []) {
      visit(blockedIssueId)
    }

    visiting.delete(issueId)
    visited.add(issueId)
  }

  for (const issueId of graph.keys()) {
    visit(issueId)
  }
}
