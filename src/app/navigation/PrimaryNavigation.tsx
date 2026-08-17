import type { KeyboardEvent } from 'react'
import { NavLink } from 'react-router-dom'

import type { Permission } from '../../domain'
import { useAuthorization } from '../providers/authorization-context'
import './primary-navigation.css'

interface NavigationItem {
  readonly label: string
  readonly shortLabel: string
  readonly to: string
  readonly end?: boolean
  readonly permission?: Permission
}

const navigationItems: readonly NavigationItem[] = [
  { label: 'Dashboard', shortLabel: 'D', to: '/', end: true },
  { label: 'Projects', shortLabel: 'P', to: '/projects' },
  { label: 'Issues', shortLabel: 'I', to: '/issues' },
  { label: 'Board', shortLabel: 'B', to: '/board' },
  { label: 'Analytics', shortLabel: 'A', to: '/analytics' },
  { label: 'Governance', shortLabel: 'G', to: '/governance', permission: 'audit:view' },
  { label: 'Settings', shortLabel: 'S', to: '/settings' },
]

function handleNavigationKeyDown(event: KeyboardEvent<HTMLAnchorElement>) {
  const links = Array.from(
    event.currentTarget
      .closest('nav')
      ?.querySelectorAll<HTMLAnchorElement>('a[href]') ?? [],
  )
  const currentIndex = links.findIndex((link) => link === event.currentTarget)

  if (currentIndex < 0 || links.length === 0) {
    return
  }

  let nextIndex: number | undefined

  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowRight':
      nextIndex = (currentIndex + 1) % links.length
      break
    case 'ArrowUp':
    case 'ArrowLeft':
      nextIndex = (currentIndex - 1 + links.length) % links.length
      break
    case 'Home':
      nextIndex = 0
      break
    case 'End':
      nextIndex = links.length - 1
      break
    default:
      return
  }

  event.preventDefault()
  links[nextIndex]?.focus()
}

export function PrimaryNavigation() {
  const authorization = useAuthorization()

  return (
    <nav aria-label="Primary navigation">
      <ul className="primary-navigation">
        {navigationItems.filter((item) => !item.permission || authorization.can(item.permission)).map((item) => (
          <li key={item.to}>
            <NavLink
              className={({ isActive }) =>
                `primary-navigation__link${isActive ? ' primary-navigation__link--active' : ''}`
              }
              {...(item.end === undefined ? {} : { end: item.end })}
              onKeyDown={handleNavigationKeyDown}
              to={item.to}
            >
              <span className="primary-navigation__icon" aria-hidden="true">
                {item.shortLabel}
              </span>
              <span>{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
