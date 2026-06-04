import { useState, type ReactNode } from 'react'

/** A single tab: its stable id, the label shown on the tab button, and the panel content. */
export interface TabItem {
  /** Stable identifier for the tab; also used to wire `aria-controls`/`aria-labelledby`. */
  id: string
  /** Text shown on the tab button. */
  label: string
  /** The panel rendered when this tab is active. */
  content: ReactNode
}

/** Props for {@link Tabs}. */
export interface TabsProps {
  /** The tabs to render, in display order. The first is active unless {@link TabsProps.initialTabId} is set. */
  tabs: TabItem[]
  /** Accessible label applied to the tablist. */
  ariaLabel?: string
  /** Id of the tab to activate initially. Defaults to the first tab. */
  initialTabId?: string
}

/**
 * An accessible tabbed panel: a row of tab buttons (`role="tablist"`) above the
 * active tab's panel (`role="tabpanel"`). Only the active panel is rendered, so
 * inactive panels do no work. Selection is internal state; the first tab is
 * active by default.
 */
export function Tabs({ tabs, ariaLabel, initialTabId }: TabsProps) {
  const [activeId, setActiveId] = useState(initialTabId ?? tabs[0]?.id)
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0]
  if (!active) return null

  return (
    <div className="tabs">
      <div className="tablist" role="tablist" aria-label={ariaLabel}>
        {tabs.map((tab) => {
          const selected = tab.id === active.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`tabpanel-${tab.id}`}
              className={selected ? 'tab tab-active' : 'tab'}
              onClick={() => setActiveId(tab.id)}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
      <div
        className="tabpanel"
        role="tabpanel"
        id={`tabpanel-${active.id}`}
        aria-labelledby={`tab-${active.id}`}
      >
        {active.content}
      </div>
    </div>
  )
}
