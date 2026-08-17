import { useEffect, useEffectEvent } from 'react'

export interface KeyboardShortcut {
  readonly id: string
  readonly key: string
  readonly alt?: boolean
  readonly controlOrMeta?: boolean
  readonly shift?: boolean
  readonly allowInEditable?: boolean
  readonly handler: () => void
}

export function useKeyboardShortcuts(shortcuts: readonly KeyboardShortcut[]): void {
  const handleKeyDown = useEffectEvent((event: KeyboardEvent): void => {
    const shortcut = shortcuts.find((candidate) =>
      matchesShortcut(event, candidate),
    )
    if (!shortcut) return
    if (!shortcut.allowInEditable && isEditableTarget(event.target)) return

    event.preventDefault()
    shortcut.handler()
  })

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])
}

export function matchesShortcut(
  event: KeyboardEvent,
  shortcut: KeyboardShortcut,
): boolean {
  const wantsPrimaryModifier = shortcut.controlOrMeta === true
  const hasPrimaryModifier = event.ctrlKey || event.metaKey

  return (
    event.key.toLocaleLowerCase() === shortcut.key.toLocaleLowerCase() &&
    hasPrimaryModifier === wantsPrimaryModifier &&
    event.altKey === (shortcut.alt === true) &&
    event.shiftKey === (shortcut.shift === true)
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
