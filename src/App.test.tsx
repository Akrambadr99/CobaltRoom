import { describe, expect, it } from 'vitest'

import App from './App'
import { render, screen } from './test/render'

describe('App', () => {
  it('renders the dashboard inside the application shell', async () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'Dashboard' }),
    ).toBeVisible()
    expect(
      screen.getByRole('navigation', { name: 'Primary navigation' }),
    ).toBeVisible()
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content')
    expect(await screen.findByText('Tracked issues')).toBeVisible()
  })
})
