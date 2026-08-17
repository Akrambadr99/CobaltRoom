import type { IsoDateTime } from '../domain'
import type { IssueWorkspaceState } from '../features/issues/issue-workspace-state'

export const preferenceSchemaVersion = 4 as const
export const issuePageSizes = [5, 10, 25] as const
export const dashboardWidgetIds = [
  'active-projects',
  'total-issues',
  'urgent-open',
  'overdue',
  'unassigned-open',
] as const
export const issueTableColumnIds = [
  'number',
  'title',
  'project',
  'priority',
  'type',
  'dueDate',
] as const
export const issueTableDensities = ['comfortable', 'compact'] as const

export type IssuePageSize = (typeof issuePageSizes)[number]
export type DashboardWidgetId = (typeof dashboardWidgetIds)[number]
export type IssueTableColumnId = (typeof issueTableColumnIds)[number]
export type IssueTableDensity = (typeof issueTableDensities)[number]

export interface IssueTableLayout {
  readonly columns: readonly IssueTableColumnId[]
  readonly density: IssueTableDensity
}

export interface SavedIssueView {
  readonly id: string
  readonly name: string
  readonly state: IssueWorkspaceState
  readonly createdAt: IsoDateTime
  readonly updatedAt: IsoDateTime
}

export interface UserPreferences {
  readonly schemaVersion: typeof preferenceSchemaVersion
  readonly issuePageSize: IssuePageSize
  readonly savedIssueViews: readonly SavedIssueView[]
  readonly dashboardWidgets: readonly DashboardWidgetId[]
  readonly issueTableLayout: IssueTableLayout
}

export const defaultIssueTableLayout: IssueTableLayout = {
  columns: issueTableColumnIds,
  density: 'comfortable',
}

export const defaultUserPreferences: UserPreferences = {
  schemaVersion: preferenceSchemaVersion,
  issuePageSize: 5,
  savedIssueViews: [],
  dashboardWidgets: ['active-projects', 'total-issues', 'urgent-open'],
  issueTableLayout: defaultIssueTableLayout,
}
