import { useState } from 'react'
import { Link, Outlet } from 'react-router-dom'

import { CommandPalette } from '../../features/commands/CommandPalette'
import { NotificationCenter } from '../../features/notifications/NotificationCenter'
import { GlobalSearch } from '../../features/search/GlobalSearch'
import { useKeyboardShortcuts } from '../../interactions/keyboard-shortcuts'
import { PrimaryNavigation } from '../navigation/PrimaryNavigation'
import { useAppServices } from '../providers/app-services-context'
import './app-shell.css'

export function AppShell() {
  const { session } = useAppServices()
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  useKeyboardShortcuts([
    {
      id: 'commands.open',
      key: 'k',
      controlOrMeta: true,
      allowInEditable: true,
      handler: () => {
        setCommandPaletteOpen(true)
      },
    },
  ])

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <aside className="app-sidebar">
        <Link className="app-brand" to="/" aria-label="Atlas Ops dashboard">
          <span className="app-brand__mark" aria-hidden="true">
            AO
          </span>
          <span>Atlas Ops</span>
        </Link>

        <PrimaryNavigation />

        <button
          className="command-palette-trigger"
          type="button"
          aria-haspopup="dialog"
          onClick={() => {
            setCommandPaletteOpen(true)
          }}
        >
          <span>Commands</span>
          <kbd aria-hidden="true">Ctrl K</kbd>
        </button>

        <p className="app-sidebar__environment">
          <span className="status-dot" aria-hidden="true" />
          Local workspace
        </p>
      </aside>

      <div className="app-content">
        <header className="app-topbar">
          <div>
            <p className="app-topbar__label">Workspace</p>
            <p className="app-topbar__name">Atlas Operations</p>
          </div>
          <GlobalSearch />
          <NotificationCenter />
          <div
            className="user-summary"
            aria-label={`Signed in as ${session.user.displayName}`}
          >
            <span className="user-summary__avatar" aria-hidden="true">
              {session.user.initials}
            </span>
            <span className="user-summary__name">{session.user.displayName}</span>
          </div>
        </header>

        <main className="app-main" id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      {commandPaletteOpen ? (
        <CommandPalette
          onClose={() => {
            setCommandPaletteOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}
