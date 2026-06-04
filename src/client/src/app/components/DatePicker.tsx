import { useEffect, useRef, useState } from 'react'
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from './icons'

/** Full month names, indexed by zero-based month. */
const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
/** Abbreviated month names, indexed by zero-based month. */
const MONTHS_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]
/** Weekday column headers, Sunday first. */
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

/** A calendar date broken into parts (month is 1-12), free of any time zone. */
interface DateParts {
  year: number
  month: number
  day: number
}

/** Parse an ISO `yyyy-MM-dd` string into its parts, or `null` if malformed. */
function parseIso(value: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return { year, month, day }
}

/** Format a `yyyy-MM-dd` date string from parts. */
function toIso(year: number, month: number, day: number): string {
  const mm = month < 10 ? `0${month}` : String(month)
  const dd = day < 10 ? `0${day}` : String(day)
  return `${year}-${mm}-${dd}`
}

/** Number of days in a given zero-based month. */
function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate()
}

/** Weekday (0 = Sunday) the first of a zero-based month falls on. */
function firstWeekday(year: number, month0: number): number {
  return new Date(year, month0, 1).getDay()
}

/** Props for {@link DatePicker}. */
export interface DatePickerProps {
  /** Selected date as an ISO `yyyy-MM-dd` string, or `''` when none is chosen. */
  value: string
  /** Called with the chosen date as an ISO `yyyy-MM-dd` string. */
  onChange: (value: string) => void
  /** Accessible label for the trigger, which shows the value but has no field label. */
  ariaLabel: string
  /** Text shown on the trigger when no date is selected. Defaults to `"Select date"`. */
  placeholder?: string
  /** Marks the field invalid for styling and assistive tech. */
  invalid?: boolean
}

/** The month a freshly-opened calendar should show: the value's month, else today's. */
function monthOf(value: string): { year: number; month0: number } {
  const parsed = parseIso(value)
  if (parsed) return { year: parsed.year, month0: parsed.month - 1 }
  const today = new Date()
  return { year: today.getFullYear(), month0: today.getMonth() }
}

/**
 * A themed single-date field: a trigger styled like the other form inputs that opens
 * a compact calendar popover, replacing the unstyleable native date control so dates
 * match the rest of the app. The value is a controlled ISO `yyyy-MM-dd` string;
 * choosing a day reports it through {@link DatePickerProps.onChange}. The popover
 * closes on selection, on Escape, and on an outside press. All date math is done on
 * integer parts, so a selected day is never shifted by a time zone.
 */
export function DatePicker({
  value,
  onChange,
  ariaLabel,
  placeholder = 'Select date',
  invalid,
}: DatePickerProps) {
  const selected = parseIso(value)
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(() => monthOf(value))
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    // Dismiss when intent leaves the calendar: an outside press or the Escape key.
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function openCalendar() {
    setView(monthOf(value))
    setOpen(true)
  }

  function selectDay(day: number) {
    onChange(toIso(view.year, view.month0 + 1, day))
    setOpen(false)
    triggerRef.current?.focus()
  }

  function shiftMonth(delta: number) {
    setView((current) => {
      const next = new Date(current.year, current.month0 + delta, 1)
      return { year: next.getFullYear(), month0: next.getMonth() }
    })
  }

  const triggerText = selected
    ? `${MONTHS_ABBR[selected.month - 1]} ${selected.day}, ${selected.year}`
    : placeholder
  const leadingBlanks = firstWeekday(view.year, view.month0)
  const days = Array.from({ length: daysInMonth(view.year, view.month0) }, (_, i) => i + 1)

  return (
    <div className="date-picker" ref={rootRef}>
      <button
        type="button"
        ref={triggerRef}
        className={`date-picker-trigger${invalid ? ' date-picker-trigger-invalid' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-invalid={invalid ? true : undefined}
        onClick={() => (open ? setOpen(false) : openCalendar())}
      >
        <span className={selected ? undefined : 'date-picker-placeholder'}>{triggerText}</span>
        <CalendarIcon className="date-picker-icon" aria-hidden="true" />
      </button>

      {open && (
        <div className="date-picker-popover" role="dialog" aria-label="Choose a date">
          <div className="date-picker-header">
            <button
              type="button"
              className="icon-button date-picker-nav"
              aria-label="Previous month"
              onClick={() => shiftMonth(-1)}
            >
              <ChevronLeftIcon className="date-picker-icon" />
            </button>
            <span className="date-picker-month" aria-live="polite">
              {MONTHS_FULL[view.month0]} {view.year}
            </span>
            <button
              type="button"
              className="icon-button date-picker-nav"
              aria-label="Next month"
              onClick={() => shiftMonth(1)}
            >
              <ChevronRightIcon className="date-picker-icon" />
            </button>
          </div>

          <div className="date-picker-grid">
            {WEEKDAYS.map((weekday) => (
              <span key={weekday} className="date-picker-weekday" aria-hidden="true">
                {weekday}
              </span>
            ))}
            {Array.from({ length: leadingBlanks }, (_, i) => (
              <span key={`blank-${i}`} className="date-picker-blank" />
            ))}
            {days.map((day) => {
              const isSelected =
                !!selected &&
                selected.year === view.year &&
                selected.month - 1 === view.month0 &&
                selected.day === day
              return (
                <button
                  key={day}
                  type="button"
                  className={`date-picker-day${isSelected ? ' date-picker-day-selected' : ''}`}
                  aria-label={`${MONTHS_FULL[view.month0]} ${day}, ${view.year}`}
                  aria-pressed={isSelected}
                  onClick={() => selectDay(day)}
                >
                  {day}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
