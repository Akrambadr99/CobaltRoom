import {
  issueWorkspaceDefaults,
  parseIssueWorkspaceState,
  serializeIssueWorkspaceState,
} from '../features/issues/issue-workspace-state'
import { isoDateTime, type IsoDateTime } from '../domain'
import {
  defaultUserPreferences,
  defaultIssueTableLayout,
  dashboardWidgetIds,
  issueTableColumnIds,
  issueTableDensities,
  issuePageSizes,
  preferenceSchemaVersion,
  type IssuePageSize,
  type SavedIssueView,
  type UserPreferences,
} from './types'

const maximumPreferenceBytes = 100_000
const maximumSavedViews = 20
const savedViewIdPattern = /^view_[a-z0-9_-]{1,80}$/

interface PersistedSavedView {
  readonly id: string
  readonly name: string
  readonly query: string
  readonly createdAt: string
  readonly updatedAt: string
}

interface PersistedPreferencesV4 {
  readonly schemaVersion: 4
  readonly issuePageSize: IssuePageSize
  readonly savedIssueViews: readonly PersistedSavedView[]
  readonly dashboardWidgets: UserPreferences['dashboardWidgets']
  readonly issueTableLayout: UserPreferences['issueTableLayout']
}

export function encodeUserPreferences(preferences: UserPreferences): string {
  const persisted: PersistedPreferencesV4 = {
    schemaVersion: preferenceSchemaVersion,
    issuePageSize: preferences.issuePageSize,
    savedIssueViews: preferences.savedIssueViews.map((view) => ({
      id: view.id,
      name: view.name,
      query: serializeSavedViewState(view.state),
      createdAt: view.createdAt,
      updatedAt: view.updatedAt,
    })),
    dashboardWidgets: preferences.dashboardWidgets,
    issueTableLayout: preferences.issueTableLayout,
  }
  return JSON.stringify(persisted)
}

export function decodeUserPreferences(serialized: string | null): UserPreferences {
  if (!serialized || serialized.length > maximumPreferenceBytes) {
    return defaultUserPreferences
  }

  try {
    const value: unknown = JSON.parse(serialized)
    if (!isRecord(value)) return defaultUserPreferences

    if (value['schemaVersion'] === 1) return migrateLegacy(value, 'pageSize', 'views')
    if (value['schemaVersion'] === 2) {
      return migrateLegacy(value, 'issuePageSize', 'savedIssueViews')
    }
    if (value['schemaVersion'] === 3) return migrateVersionThree(value)
    if (value['schemaVersion'] !== preferenceSchemaVersion) {
      return defaultUserPreferences
    }

    return {
      schemaVersion: preferenceSchemaVersion,
      issuePageSize: parsePageSize(value['issuePageSize']),
      savedIssueViews: parseSavedViews(value['savedIssueViews']),
      dashboardWidgets: parseDashboardWidgets(value['dashboardWidgets']),
      issueTableLayout: parseIssueTableLayout(value['issueTableLayout']),
    }
  } catch {
    return defaultUserPreferences
  }
}

export function serializeSavedViewState(state: SavedIssueView['state']): string {
  return serializeIssueWorkspaceState({ ...state, page: 1 }).toString()
}

function migrateLegacy(
  value: Record<string, unknown>,
  pageSizeKey: string,
  viewsKey: string,
): UserPreferences {
  return {
    schemaVersion: preferenceSchemaVersion,
    issuePageSize: parsePageSize(value[pageSizeKey]),
    savedIssueViews: parseSavedViews(value[viewsKey]),
    dashboardWidgets: defaultUserPreferences.dashboardWidgets,
    issueTableLayout: defaultIssueTableLayout,
  }
}

function migrateVersionThree(value: Record<string, unknown>): UserPreferences {
  return {
    schemaVersion: preferenceSchemaVersion,
    issuePageSize: parsePageSize(value['issuePageSize']),
    savedIssueViews: parseSavedViews(value['savedIssueViews']),
    dashboardWidgets: parseDashboardWidgets(value['dashboardWidgets']),
    issueTableLayout: defaultIssueTableLayout,
  }
}

function parseIssueTableLayout(value: unknown): UserPreferences['issueTableLayout'] {
  if (!isRecord(value) || !Array.isArray(value['columns'])) {
    return defaultIssueTableLayout
  }
  if (!value['columns'].every(isIssueTableColumnId)) return defaultIssueTableLayout
  const columns = value['columns']
  const uniqueColumns = [...new Set(columns)]
  const density = issueTableDensities.find(
    (candidate) => candidate === value['density'],
  )
  if (
    uniqueColumns.length !== columns.length ||
    !uniqueColumns.includes('number') ||
    !uniqueColumns.includes('title') ||
    !density
  ) {
    return defaultIssueTableLayout
  }
  return { columns: uniqueColumns, density }
}

function isIssueTableColumnId(
  value: unknown,
): value is UserPreferences['issueTableLayout']['columns'][number] {
  return typeof value === 'string' &&
    issueTableColumnIds.some((column) => column === value)
}

function parseDashboardWidgets(value: unknown): UserPreferences['dashboardWidgets'] {
  if (!Array.isArray(value)) return defaultUserPreferences.dashboardWidgets
  const widgets = value.filter(
    (candidate): candidate is UserPreferences['dashboardWidgets'][number] =>
      typeof candidate === 'string' &&
      dashboardWidgetIds.some((widgetId) => widgetId === candidate),
  )
  const unique = [...new Set(widgets)]
  return unique.length > 0 ? unique : defaultUserPreferences.dashboardWidgets
}

function parsePageSize(value: unknown): IssuePageSize {
  return issuePageSizes.find((candidate) => candidate === value) ?? 5
}

function parseSavedViews(value: unknown): readonly SavedIssueView[] {
  if (!Array.isArray(value)) return []

  return value
    .slice(0, maximumSavedViews)
    .flatMap((candidate): readonly SavedIssueView[] => {
      if (!isRecord(candidate)) return []
      const id = candidate['id']
      const rawName = candidate['name']
      const query = candidate['query']
      const createdAt = parseTimestamp(candidate['createdAt'])
      const updatedAt = parseTimestamp(candidate['updatedAt'])
      const name = typeof rawName === 'string' ? rawName.trim() : ''

      if (
        typeof id !== 'string' ||
        !savedViewIdPattern.test(id) ||
        name.length === 0 ||
        name.length > 60 ||
        typeof query !== 'string' ||
        query.length > 1_000 ||
        !createdAt ||
        !updatedAt
      ) {
        return []
      }

      return [
        {
          id,
          name,
          state: {
            ...issueWorkspaceDefaults,
            ...parseIssueWorkspaceState(new URLSearchParams(query)),
            page: 1,
          },
          createdAt,
          updatedAt,
        },
      ]
    })
}

function parseTimestamp(value: unknown): IsoDateTime | null {
  if (typeof value !== 'string') return null
  try {
    return isoDateTime(value)
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
