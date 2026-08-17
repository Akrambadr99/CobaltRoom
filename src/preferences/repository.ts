import { SystemClock, type Clock } from '../data'
import type { IssueWorkspaceState } from '../features/issues/issue-workspace-state'
import { decodeUserPreferences, encodeUserPreferences } from './codec'
import type { PreferenceStorage } from './storage'
import {
  dashboardWidgetIds,
  issueTableColumnIds,
  issueTableDensities,
  type DashboardWidgetId,
  type IssuePageSize,
  type IssueTableLayout,
  type SavedIssueView,
  type UserPreferences,
} from './types'

type Listener = () => void

export class PreferencePersistenceError extends Error {
  constructor(message = 'Preferences could not be saved on this device.') {
    super(message)
    this.name = 'PreferencePersistenceError'
  }
}

export interface UserPreferenceRepositoryOptions {
  readonly storage: PreferenceStorage
  readonly storageKey: string
  readonly clock?: Clock
  readonly idFactory?: () => string
}

export class UserPreferenceRepository {
  private readonly storage: PreferenceStorage
  private readonly storageKey: string
  private readonly clock: Clock
  private readonly idFactory: () => string
  private readonly listeners = new Set<Listener>()
  private current: UserPreferences

  constructor(options: UserPreferenceRepositoryOptions) {
    this.storage = options.storage
    this.storageKey = options.storageKey
    this.clock = options.clock ?? new SystemClock()
    this.idFactory = options.idFactory ?? defaultViewId
    this.current = decodeUserPreferences(this.safeRead())
  }

  getSnapshot = (): UserPreferences => this.current

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  setIssuePageSize(pageSize: IssuePageSize): void {
    this.commit({ ...this.current, issuePageSize: pageSize })
  }

  setDashboardWidgets(widgets: readonly DashboardWidgetId[]): void {
    const unique = [...new Set(widgets)]
    if (
      unique.length === 0 ||
      unique.length !== widgets.length ||
      unique.some(
        (candidate) => !dashboardWidgetIds.some((widgetId) => widgetId === candidate),
      )
    ) {
      throw new RangeError('Dashboard widgets must be unique supported values.')
    }
    this.commit({ ...this.current, dashboardWidgets: unique })
  }

  setIssueTableLayout(layout: IssueTableLayout): void {
    const uniqueColumns = [...new Set(layout.columns)]
    if (
      uniqueColumns.length !== layout.columns.length ||
      !uniqueColumns.includes('number') ||
      !uniqueColumns.includes('title') ||
      uniqueColumns.some(
        (column) => !issueTableColumnIds.some((candidate) => candidate === column),
      ) ||
      !issueTableDensities.some((density) => density === layout.density)
    ) {
      throw new RangeError(
        'Issue table layouts require unique supported columns, including issue and title.',
      )
    }
    this.commit({
      ...this.current,
      issueTableLayout: { columns: uniqueColumns, density: layout.density },
    })
  }

  saveIssueView(name: string, state: IssueWorkspaceState): SavedIssueView {
    const normalizedName = name.trim()
    if (normalizedName.length === 0 || normalizedName.length > 60) {
      throw new RangeError('Saved view names must contain 1 to 60 characters.')
    }
    if (this.current.savedIssueViews.length >= 20) {
      throw new RangeError('A maximum of 20 issue views may be saved.')
    }
    if (
      this.current.savedIssueViews.some(
        (view) => view.name.toLocaleLowerCase() === normalizedName.toLocaleLowerCase(),
      )
    ) {
      throw new RangeError('Saved view names must be unique.')
    }

    const id = normalizeViewId(this.idFactory())
    if (this.current.savedIssueViews.some((view) => view.id === id)) {
      throw new TypeError('Saved view identifiers must be unique.')
    }
    const occurredAt = this.clock.now()
    const view: SavedIssueView = {
      id,
      name: normalizedName,
      state: { ...state, page: 1 },
      createdAt: occurredAt,
      updatedAt: occurredAt,
    }
    this.commit({
      ...this.current,
      savedIssueViews: [...this.current.savedIssueViews, view],
    })
    return view
  }

  updateIssueViewState(
    id: string,
    state: IssueWorkspaceState,
  ): SavedIssueView | null {
    const index = this.current.savedIssueViews.findIndex((view) => view.id === id)
    const currentView = this.current.savedIssueViews[index]
    if (!currentView) return null

    const updatedView: SavedIssueView = {
      ...currentView,
      state: { ...state, page: 1 },
      updatedAt: this.clock.now(),
    }
    const savedIssueViews = [...this.current.savedIssueViews]
    savedIssueViews[index] = updatedView
    this.commit({ ...this.current, savedIssueViews })
    return updatedView
  }

  deleteIssueView(id: string): void {
    const savedIssueViews = this.current.savedIssueViews.filter(
      (view) => view.id !== id,
    )
    if (savedIssueViews.length === this.current.savedIssueViews.length) return
    this.commit({ ...this.current, savedIssueViews })
  }

  private safeRead(): string | null {
    try {
      return this.storage.get(this.storageKey)
    } catch {
      return null
    }
  }

  private commit(next: UserPreferences): void {
    try {
      this.storage.set(this.storageKey, encodeUserPreferences(next))
    } catch {
      throw new PreferencePersistenceError()
    }
    this.current = next
    for (const listener of this.listeners) listener()
  }
}

function defaultViewId(): string {
  return `view_${globalThis.crypto.randomUUID().toLocaleLowerCase()}`
}

function normalizeViewId(value: string): string {
  const normalized = value.trim().toLocaleLowerCase()
  if (!/^view_[a-z0-9_-]{1,80}$/.test(normalized)) {
    throw new TypeError('Saved view identifiers must use the view_ prefix.')
  }
  return normalized
}
