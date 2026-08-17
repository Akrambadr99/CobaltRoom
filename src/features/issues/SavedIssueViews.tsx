import { useState, type SyntheticEvent } from 'react'

import type { IssueWorkspaceState } from './issue-workspace-state'
import { useAppServices } from '../../app/providers/app-services-context'
import {
  issuePageSizes,
  useUserPreferences,
} from '../../preferences'

interface SavedIssueViewsProps {
  readonly currentState: IssueWorkspaceState
  readonly onApply: (state: IssueWorkspaceState) => void
  readonly onPageSizeChange: () => void
}

export function SavedIssueViews({
  currentState,
  onApply,
  onPageSizeChange,
}: SavedIssueViewsProps) {
  const { preferences: repository } = useAppServices()
  const preferences = useUserPreferences()
  const [selectedId, setSelectedId] = useState('')
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)

  const handleSave = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const form = event.currentTarget
    const value = new FormData(form).get('viewName')
    const name = typeof value === 'string' ? value : ''

    try {
      const view = repository.saveIssueView(name, currentState)
      setSelectedId(view.id)
      setMessage(`${view.name} saved as a private view.`)
      setIsError(false)
      form.reset()
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'The view could not be saved.',
      )
      setIsError(true)
    }
  }

  const handlePageSizeChange = (value: string): void => {
    const pageSize = issuePageSizes.find(
      (candidate) => candidate.toString() === value,
    )
    if (!pageSize) return

    try {
      repository.setIssuePageSize(pageSize)
      onPageSizeChange()
      setMessage(`Showing ${pageSize.toString()} issues per page.`)
      setIsError(false)
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'The page-size preference could not be saved.',
      )
      setIsError(true)
    }
  }

  const selectedView = preferences.savedIssueViews.find(
    ({ id }) => id === selectedId,
  )

  return (
    <section className="saved-views" aria-labelledby="saved-views-title">
      <div className="saved-views__heading">
        <div>
          <h2 id="saved-views-title">Saved views</h2>
          <p>Private to your account on this device.</p>
        </div>
        <label className="saved-views__page-size">
          <span>Rows per page</span>
          <select
            value={preferences.issuePageSize}
            onChange={(event) => {
              handlePageSizeChange(event.currentTarget.value)
            }}
          >
            {issuePageSizes.map((pageSize) => (
              <option key={pageSize} value={pageSize}>
                {pageSize}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="saved-views__actions">
        <label>
          <span>Open saved view</span>
          <select
            value={selectedId}
            onChange={(event) => {
              const id = event.currentTarget.value
              setSelectedId(id)
              const view = preferences.savedIssueViews.find(
                (candidate) => candidate.id === id,
              )
              if (view) {
                onApply(view.state)
                setMessage(`${view.name} applied.`)
                setIsError(false)
              }
            }}
          >
            <option value="">Choose a view</option>
            {preferences.savedIssueViews.map((view) => (
              <option key={view.id} value={view.id}>
                {view.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="secondary-button"
          type="button"
          disabled={!selectedView}
          onClick={() => {
            if (!selectedView) return
            try {
              repository.deleteIssueView(selectedView.id)
              setSelectedId('')
              setMessage(`${selectedView.name} deleted.`)
              setIsError(false)
            } catch (error) {
              setMessage(
                error instanceof Error
                  ? error.message
                  : 'The saved view could not be deleted.',
              )
              setIsError(true)
            }
          }}
        >
          Delete selected view
        </button>
        <form className="saved-views__save" onSubmit={handleSave}>
          <label>
            <span>View name</span>
            <input name="viewName" maxLength={60} required />
          </label>
          <button className="secondary-button" type="submit">
            Save current view
          </button>
        </form>
      </div>
      <p className="saved-views__status" role={isError ? 'alert' : 'status'}>
        {message}
      </p>
    </section>
  )
}
