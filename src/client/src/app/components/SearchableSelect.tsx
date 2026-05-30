import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDownIcon, CheckIcon, SearchIcon } from './icons'

/** Props for {@link SearchableSelect}. */
export interface SearchableSelectProps {
  /** The options the user can choose from, in display order. */
  options: string[]
  /** The currently selected option. */
  value: string
  /** Called with the chosen option when the user selects one. */
  onChange: (value: string) => void
  /** Accessible label for the control, e.g. "Field". */
  label: string
  /** Placeholder shown in the search box. Defaults to "Search…". */
  searchPlaceholder?: string
}

/** Viewport coordinates the popover is anchored to, in CSS pixels. */
interface Anchor {
  top: number
  left: number
  width: number
}

/**
 * A single-select control whose options are revealed in a popover with a
 * type-ahead search box. The collapsed trigger mirrors the native `.select`
 * look; once open it lets the user filter a long option list instead of
 * scrolling it, with the current value marked by a check.
 *
 * The popover is rendered through a portal and positioned beneath the trigger,
 * so it is never clipped by scrolling or `overflow: hidden` ancestors such as
 * the production-entries table.
 */
export function SearchableSelect({
  options,
  value,
  onChange,
  label,
  searchPlaceholder = 'Search…',
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [anchor, setAnchor] = useState<Anchor | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listboxId = useId()

  const needle = query.trim().toLowerCase()
  const filtered = options.filter((opt) => opt.toLowerCase().includes(needle))

  function anchorToTrigger() {
    const trigger = containerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    setAnchor({ top: rect.bottom + 4, left: rect.left, width: rect.width })
  }

  function openPopover() {
    anchorToTrigger()
    setQuery('')
    setOpen(true)
  }

  function selectOption(option: string) {
    onChange(option)
    setOpen(false)
  }

  // While open, keep the search box focused, re-anchor the popover on
  // scroll/resize, and close it on an outside click.
  useEffect(() => {
    if (!open) return
    searchRef.current?.focus()

    function reanchor() {
      anchorToTrigger()
    }
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (
        containerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return
      }
      setOpen(false)
    }

    window.addEventListener('scroll', reanchor, true)
    window.addEventListener('resize', reanchor)
    document.addEventListener('mousedown', onPointerDown)
    return () => {
      window.removeEventListener('scroll', reanchor, true)
      window.removeEventListener('resize', reanchor)
      document.removeEventListener('mousedown', onPointerDown)
    }
  }, [open])

  return (
    <div className="select searchable-select" ref={containerRef}>
      <button
        type="button"
        className="searchable-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={label}
        onClick={() => (open ? setOpen(false) : openPopover())}
      >
        {value}
      </button>
      <ChevronDownIcon className="select-chevron" aria-hidden="true" />

      {open &&
        anchor &&
        createPortal(
          <div
            ref={popoverRef}
            className="field-dropdown"
            style={{ top: anchor.top, left: anchor.left, width: anchor.width }}
          >
            <div className="field-dropdown-search">
              <SearchIcon className="field-dropdown-search-icon" aria-hidden="true" />
              <input
                ref={searchRef}
                type="text"
                className="field-dropdown-input"
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    setOpen(false)
                  }
                }}
              />
            </div>

            {filtered.length > 0 ? (
              <ul
                className="field-dropdown-list"
                role="listbox"
                id={listboxId}
                aria-label={label}
              >
                {filtered.map((option) => {
                  const selected = option === value
                  return (
                    <li
                      key={option}
                      role="option"
                      aria-selected={selected}
                      className={
                        selected
                          ? 'field-dropdown-option is-selected'
                          : 'field-dropdown-option'
                      }
                      onClick={() => selectOption(option)}
                    >
                      <span>{option}</span>
                      {selected && (
                        <CheckIcon className="field-dropdown-check" aria-hidden="true" />
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="field-dropdown-empty">No matches</p>
            )}
          </div>,
          document.body,
        )}
    </div>
  )
}
