import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('GridLoom workspace', () => {
  it('opens a domain-specific operational surface', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: 'Energy balance' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'history' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Interval provenance' })).toBeVisible()
  })
})
