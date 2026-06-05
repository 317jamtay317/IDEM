/**
 * The Report Builder's right-hand panel for the selected element, across two
 * tabs: **Properties** (type, editable text, geometry, and styling) and **Data**
 * (the element's data binding — a field dropdown or formula editor, with a live
 * preview — see {@link DataBindingEditor}). Geometry is edited in whole pixels
 * (see {@link toDisplayPx}/{@link fromDisplayPx}) and font size in points; edits
 * are reported via `onChange` as a partial element the screen merges into the model.
 */
import { type ReactNode, useState } from 'react'
import { DataBindingEditor } from './DataBindingEditor'
import { ELEMENT_TYPE_LABELS, fromDisplayPx, toDisplayPx } from './elementDisplay'
import { type ElementStyle, type FontWeight, type Rect, type ReportElement } from './model'

/** Selectable font families. */
const FONT_OPTIONS = [
  { value: '', label: 'Default' },
  { value: 'Inter', label: 'Inter' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Courier New', label: 'Courier New' },
]

/** Selectable font weights. */
const WEIGHT_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'medium', label: 'Medium' },
  { value: 'semibold', label: 'Semi Bold' },
  { value: 'bold', label: 'Bold' },
]

/** A labelled text input. */
function TextField(props: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="rb-field">
      <label className="rb-field-label overline" htmlFor={props.id}>
        {props.label}
      </label>
      <input
        id={props.id}
        className="rb-field-input"
        type="text"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </div>
  )
}

/** A labelled numeric input (pixels). */
function NumberField(props: { id: string; label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="rb-field">
      <label className="rb-field-label overline" htmlFor={props.id}>
        {props.label}
      </label>
      <input
        id={props.id}
        className="rb-field-input"
        type="number"
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </div>
  )
}

/** A labelled dropdown. */
function SelectField(props: {
  id: string
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <div className="rb-field">
      <label className="rb-field-label overline" htmlFor={props.id}>
        {props.label}
      </label>
      <select
        id={props.id}
        className="rb-field-input"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      >
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

/** A pressable toggle (bold/italic/underline/alignment). */
function ToggleButton(props: { label: string; pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      className={`rb-toggle${props.pressed ? ' rb-toggle-active' : ''}`}
      aria-label={props.label}
      aria-pressed={props.pressed}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  )
}

/** Props for {@link PropertiesPanel}. */
export interface PropertiesPanelProps {
  /** The sole selected element, or `null` when nothing (or more than one) is selected. */
  element: ReportElement | null
  /**
   * How many elements are selected. Defaults to one when `element` is set and
   * zero otherwise; pass it explicitly so a multi-selection shows a count rather
   * than an editor.
   */
  selectedCount?: number
  /** Reports an edit as a partial element to merge into the model. */
  onChange?: (patch: Partial<ReportElement>) => void
}

/**
 * Renders the Properties/Data panel for the current selection. With no
 * selection it prompts the user to pick an element; with several selected it
 * shows a count and points to the alignment tools; with exactly one it exposes
 * that element's text, geometry and styling as editable controls.
 */
export function PropertiesPanel({ element, selectedCount, onChange }: PropertiesPanelProps) {
  const [tab, setTab] = useState<'properties' | 'data'>('properties')
  const style = element?.style
  const count = selectedCount ?? (element ? 1 : 0)

  // Patch one rect dimension (entered in px) while keeping the others' inches.
  const editRect = (dim: keyof Rect, px: number) => {
    if (element) onChange?.({ rect: { ...element.rect, [dim]: fromDisplayPx(px) } })
  }

  // Merge a style change into the element's style.
  const editStyle = (patch: Partial<ElementStyle>) => {
    if (element) onChange?.({ style: { ...element.style, ...patch } })
  }

  return (
    <div className="rb-props">
      <div className="rb-tabs" role="tablist" aria-label="Element panels">
        <button
          type="button"
          role="tab"
          id="rb-tab-properties"
          aria-selected={tab === 'properties'}
          className={`rb-tab${tab === 'properties' ? ' rb-tab-active' : ''}`}
          onClick={() => setTab('properties')}
        >
          Properties
        </button>
        <button
          type="button"
          role="tab"
          id="rb-tab-data"
          aria-selected={tab === 'data'}
          className={`rb-tab${tab === 'data' ? ' rb-tab-active' : ''}`}
          onClick={() => setTab('data')}
        >
          Data
        </button>
      </div>

      {count > 1 ? (
        <p className="rb-empty">{count} elements selected. Use the alignment tools to arrange them.</p>
      ) : element === null ? (
        <p className="rb-empty">Select an element to edit its properties.</p>
      ) : tab === 'properties' ? (
        <div role="tabpanel" aria-labelledby="rb-tab-properties" className="rb-prop-body">
          <span className="section-title">{ELEMENT_TYPE_LABELS[element.type]}</span>

          <TextField
            id="rb-field-text"
            label="Text"
            value={element.text ?? ''}
            onChange={(v) => onChange?.({ text: v })}
          />

          <div className="rb-prop-grid">
            <NumberField id="rb-field-x" label="X" value={toDisplayPx(element.rect.x)} onChange={(v) => editRect('x', v)} />
            <NumberField id="rb-field-y" label="Y" value={toDisplayPx(element.rect.y)} onChange={(v) => editRect('y', v)} />
            <NumberField id="rb-field-w" label="W" value={toDisplayPx(element.rect.w)} onChange={(v) => editRect('w', v)} />
            <NumberField id="rb-field-h" label="H" value={toDisplayPx(element.rect.h)} onChange={(v) => editRect('h', v)} />
          </div>

          <SelectField
            id="rb-field-font"
            label="Font"
            value={style?.fontFamily ?? ''}
            options={FONT_OPTIONS}
            onChange={(v) => editStyle({ fontFamily: v === '' ? undefined : v })}
          />

          <div className="rb-prop-grid">
            <div className="rb-field">
              <label className="rb-field-label overline" htmlFor="rb-field-size">
                Size
              </label>
              <input
                id="rb-field-size"
                className="rb-field-input"
                type="number"
                value={style?.fontSize ?? ''}
                onChange={(e) =>
                  editStyle({ fontSize: e.target.value === '' ? undefined : Number(e.target.value) })
                }
              />
            </div>
            <SelectField
              id="rb-field-weight"
              label="Weight"
              value={style?.fontWeight ?? 'normal'}
              options={WEIGHT_OPTIONS}
              onChange={(v) => editStyle({ fontWeight: v as FontWeight })}
            />
          </div>

          <div className="rb-field">
            <span className="rb-field-label overline">Style &amp; alignment</span>
            <div className="rb-toggle-row">
              <ToggleButton
                label="Bold"
                pressed={style?.fontWeight === 'bold'}
                onClick={() => editStyle({ fontWeight: style?.fontWeight === 'bold' ? 'normal' : 'bold' })}
              >
                <b>B</b>
              </ToggleButton>
              <ToggleButton
                label="Italic"
                pressed={!!style?.italic}
                onClick={() => editStyle({ italic: style?.italic ? undefined : true })}
              >
                <i>I</i>
              </ToggleButton>
              <ToggleButton
                label="Underline"
                pressed={!!style?.underline}
                onClick={() => editStyle({ underline: style?.underline ? undefined : true })}
              >
                <u>U</u>
              </ToggleButton>
              <span className="rb-toggle-gap" aria-hidden="true" />
              <ToggleButton label="Align left" pressed={style?.align === 'left'} onClick={() => editStyle({ align: 'left' })}>
                ⯇
              </ToggleButton>
              <ToggleButton label="Align center" pressed={style?.align === 'center'} onClick={() => editStyle({ align: 'center' })}>
                ≡
              </ToggleButton>
              <ToggleButton label="Align right" pressed={style?.align === 'right'} onClick={() => editStyle({ align: 'right' })}>
                ⯈
              </ToggleButton>
            </div>
          </div>

          <div className="rb-field">
            <label className="rb-field-label overline" htmlFor="rb-field-fill">
              Fill
            </label>
            <input
              id="rb-field-fill"
              className="rb-field-color"
              type="color"
              value={style?.color ?? '#000000'}
              onChange={(e) => editStyle({ color: e.target.value })}
            />
          </div>
        </div>
      ) : (
        <div role="tabpanel" aria-labelledby="rb-tab-data" className="rb-prop-body">
          <DataBindingEditor element={element} onChange={onChange} />
        </div>
      )}
    </div>
  )
}
