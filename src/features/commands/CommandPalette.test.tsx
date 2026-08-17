import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { CommandPalette } from './CommandPalette'
import { AppProviders } from '../../app/providers/AppProviders'
import { createAtlasQueryClient } from '../../app/query-client'
import { createAppServices } from '../../app/services'
import { createAtlasFixtures } from '../../data'
import { issueWorkspaceDefaults } from '../issues/issue-workspace-state'
import type { UserId } from '../../domain'
import { render, screen } from '../../test/render'

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}{location.search}</output>
}

function renderPalette(actorId?: UserId, withSavedView = false) {
  const services = createAppServices(actorId ? { actorId } : {})
  if (withSavedView) {
    services.preferences.saveIssueView('Urgent queue', {
      ...issueWorkspaceDefaults,
      priority: 'urgent',
    })
  }

  function Harness() {
    const [open, setOpen] = useState(true)
    return (
      <div className="app-shell">
        <button
          type="button"
          onClick={() => {
            setOpen(true)
          }}
        >
          Commands
        </button>
        {open ? (
          <CommandPalette
            onClose={() => {
              setOpen(false)
            }}
          />
        ) : null}
        <Routes>
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </div>
    )
  }

  render(
    <AppProviders queryClient={createAtlasQueryClient()} services={services}>
      <MemoryRouter>
        <Harness />
      </MemoryRouter>
    </AppProviders>,
  )
}

describe('CommandPalette', () => {
  it('filters commands and executes the active result with the keyboard', async () => {
    const user = userEvent.setup()
    renderPalette()
    const input = screen.getByRole('combobox', { name: 'Search commands' })

    expect(input).toHaveFocus()
    await user.type(input, 'kanban')
    expect(screen.getByRole('option', { name: /Go to board.*Navigation/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await user.keyboard('{Enter}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/board')
  })

  it('includes private saved views and permission-allowed actions', async () => {
    const user = userEvent.setup()
    renderPalette(undefined, true)
    const input = screen.getByRole('combobox', { name: 'Search commands' })

    expect(screen.getByRole('option', { name: /Create issue.*Actions/ })).toBeVisible()
    await user.type(input, 'urgent queue')
    await user.keyboard('{Enter}')

    expect(screen.getByTestId('location')).toHaveTextContent(
      '/issues?priority=urgent',
    )
  })

  it('omits issue creation for a read-only actor', () => {
    const fixtures = createAtlasFixtures()
    const viewerId = fixtures.memberships.find(({ role }) => role === 'viewer')?.userId
    if (!viewerId) throw new Error('Expected viewer fixture.')

    renderPalette(viewerId)

    expect(
      screen.queryByRole('option', { name: /Create issue.*Actions/ }),
    ).not.toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(4)
  })
})
