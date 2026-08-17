import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { render, screen } from '../../test/render'
import { PrimaryNavigation } from './PrimaryNavigation'

describe('PrimaryNavigation', () => {
  it('identifies the current route', () => {
    render(
      <MemoryRouter initialEntries={['/projects']}>
        <PrimaryNavigation />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('moves focus with directional, Home, and End keys', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <PrimaryNavigation />
      </MemoryRouter>,
    )

    const dashboard = screen.getByRole('link', { name: 'Dashboard' })
    const projects = screen.getByRole('link', { name: 'Projects' })
    const settings = screen.getByRole('link', { name: 'Settings' })

    dashboard.focus()
    await user.keyboard('{ArrowDown}')
    expect(projects).toHaveFocus()

    await user.keyboard('{End}')
    expect(settings).toHaveFocus()

    await user.keyboard('{Home}')
    expect(dashboard).toHaveFocus()

    await user.keyboard('{ArrowUp}')
    expect(settings).toHaveFocus()
  })

  it('leaves focus unchanged for unrelated keys', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <PrimaryNavigation />
      </MemoryRouter>,
    )

    const dashboard = screen.getByRole('link', { name: 'Dashboard' })
    dashboard.focus()

    await user.keyboard('x')

    expect(dashboard).toHaveFocus()
  })
})
