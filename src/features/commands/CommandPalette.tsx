import { useId, useMemo, useState, type KeyboardEvent } from 'react'

import { filterCommands, useAppCommands, type AppCommand } from './command-registry'
import { classifyAppError } from '../../app/errors/classify-app-error'
import { ModalDialog } from '../../components/dialog/ModalDialog'
import './command-palette.css'

interface CommandPaletteProps {
  readonly onClose: () => void
}

export function CommandPalette({ onClose }: CommandPaletteProps) {
  const commands = useAppCommands()
  const [search, setSearch] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [pendingCommandId, setPendingCommandId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const titleId = useId()
  const descriptionId = useId()
  const listId = useId()
  const filteredCommands = useMemo(
    () => filterCommands(commands, search),
    [commands, search],
  )
  const safeActiveIndex = Math.min(activeIndex, filteredCommands.length - 1)
  const activeCommand = filteredCommands[safeActiveIndex]

  const execute = async (command: AppCommand): Promise<void> => {
    if (pendingCommandId) return
    setErrorMessage('')
    setPendingCommandId(command.id)
    try {
      await command.execute()
      setPendingCommandId(null)
      onClose()
    } catch (error) {
      setPendingCommandId(null)
      setErrorMessage(classifyAppError(error).message)
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((current) =>
        filteredCommands.length === 0 ? 0 : (current + 1) % filteredCommands.length,
      )
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((current) =>
        filteredCommands.length === 0
          ? 0
          : (current - 1 + filteredCommands.length) % filteredCommands.length,
      )
    } else if (event.key === 'Enter' && activeCommand) {
      event.preventDefault()
      void execute(activeCommand)
    }
  }

  return (
    <ModalDialog
      titleId={titleId}
      descriptionId={descriptionId}
      onRequestClose={() => {
        if (!pendingCommandId) onClose()
      }}
    >
      <div className="command-palette" aria-busy={pendingCommandId !== null}>
        <div className="command-palette__header">
          <h2 id={titleId}>Command palette</h2>
          <p id={descriptionId}>
            Search available navigation and actions. Use arrow keys and Enter to
            choose.
          </p>
        </div>
        <label className="command-palette__search">
          <span className="visually-hidden">Search commands</span>
          <input
            role="combobox"
            aria-autocomplete="list"
            aria-controls={listId}
            aria-expanded="true"
            aria-activedescendant={
              activeCommand ? commandOptionId(listId, activeCommand.id) : undefined
            }
            value={search}
            placeholder="Type a command…"
            autoComplete="off"
            disabled={pendingCommandId !== null}
            onChange={(event) => {
              setSearch(event.currentTarget.value)
              setActiveIndex(0)
              setErrorMessage('')
            }}
            onKeyDown={handleKeyDown}
          />
        </label>
        <ul className="command-palette__list" id={listId} role="listbox">
          {filteredCommands.map((item, index) => (
            <li
              id={commandOptionId(listId, item.id)}
              key={item.id}
              role="option"
              aria-selected={index === safeActiveIndex}
              aria-disabled={pendingCommandId !== null}
              onMouseEnter={() => {
                setActiveIndex(index)
              }}
              onMouseDown={(event) => {
                event.preventDefault()
                void execute(item)
              }}
            >
              <span>{item.label}</span>
              <small>{item.category}</small>
            </li>
          ))}
        </ul>
        {filteredCommands.length === 0 ? (
          <p className="command-palette__empty" role="status">
            No commands match “{search.trim()}”.
          </p>
        ) : null}
        {pendingCommandId ? (
          <p className="command-palette__status" role="status">
            Opening {commands.find(({ id }) => id === pendingCommandId)?.label ?? 'command'}…
          </p>
        ) : null}
        {errorMessage ? (
          <p className="command-palette__status" role="alert">
            {errorMessage}
          </p>
        ) : null}
      </div>
    </ModalDialog>
  )
}

function commandOptionId(listId: string, commandId: string): string {
  return `${listId}-${commandId.replaceAll('.', '-')}`
}
