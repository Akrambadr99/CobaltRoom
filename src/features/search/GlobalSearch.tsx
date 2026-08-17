import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react'
import { Link } from 'react-router-dom'

import { useGlobalIssueSearch } from './search-queries'

const debounceMilliseconds = 250

export function GlobalSearch() {
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsId = useId()
  const [value, setValue] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const normalizedValue = value.trim()
  const search = useGlobalIssueSearch(debouncedSearch)
  const queryIsCurrent = normalizedValue === debouncedSearch
  const showPanel = isFocused && normalizedValue.length >= 2

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(normalizedValue)
    }, debounceMilliseconds)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [normalizedValue])

  useEffect(() => {
    const handleShortcut = (event: globalThis.KeyboardEvent): void => {
      if (
        event.key !== '/' ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        isEditableTarget(event.target)
      ) {
        return
      }

      event.preventDefault()
      inputRef.current?.focus()
    }

    window.addEventListener('keydown', handleShortcut)
    return () => {
      window.removeEventListener('keydown', handleShortcut)
    }
  }, [])

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setValue(event.currentTarget.value)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    setValue('')
    setDebouncedSearch('')
    inputRef.current?.blur()
  }

  return (
    <div
      className="global-search"
      role="search"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsFocused(false)
      }}
      onFocus={() => {
        setIsFocused(true)
      }}
    >
      <label className="global-search__field">
        <span className="visually-hidden">Search all issues</span>
        <input
          ref={inputRef}
          type="search"
          value={value}
          placeholder="Search issues…"
          aria-keyshortcuts="/"
          autoComplete="off"
          onChange={handleChange}
          onKeyDown={handleKeyDown}
        />
        <kbd aria-hidden="true">/</kbd>
      </label>

      {showPanel ? (
        <div className="global-search__panel" id={resultsId}>
          {!queryIsCurrent || search.isPending ? (
            <p role="status">Searching issues…</p>
          ) : null}
          {queryIsCurrent && search.isError ? (
            <div role="alert">
              <p>Search is temporarily unavailable.</p>
              <button
                className="global-search__retry"
                type="button"
                onClick={() => {
                  void search.refetch()
                }}
              >
                Retry
              </button>
            </div>
          ) : null}
          {queryIsCurrent && search.isSuccess ? (
            search.data.issues.items.length === 0 ? (
              <p>No issues match “{normalizedValue}”.</p>
            ) : (
              <ul aria-label="Issue search results">
                {search.data.issues.items.map((issue) => {
                  const project = search.data.projects.find(
                    ({ id }) => id === issue.projectId,
                  )
                  return (
                    <li key={issue.id}>
                      <Link
                        to={`/issues/${issue.id}`}
                        onClick={() => {
                          setValue('')
                          setDebouncedSearch('')
                        }}
                      >
                        <span>{issue.title}</span>
                        <small>
                          {project?.key ?? 'Issue'}-{issue.number} · {issue.priority}
                        </small>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}
