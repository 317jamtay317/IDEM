/**
 * The Report Builder's **Data** tab body: the editor for a selected element's
 * data binding. A `dataField` binds to one field through a dropdown; a `formula`
 * is written as a free expression with an aggregate-function hint and a
 * field-insert helper. Both show a live preview against sample Report data, or
 * flag the binding when its expression is invalid (an unknown field/function or a
 * malformed token). A static element (no expression) shows a short note instead.
 *
 * The fields and preview data are sample stand-ins until the Report Engine and
 * backend exist (Phase 13); they are accepted as props so real metadata can be
 * supplied later.
 */
import { Fragment } from 'react'
import {
  EXPRESSION_FUNCTIONS,
  evaluateExpression,
  fieldPath,
  validateExpression,
  type DataContext,
  type DataFieldDef,
} from './expressions'
import { SAMPLE_DATA_CONTEXT, SAMPLE_FIELDS } from './sampleData'
import { type ReportElement } from './model'

/** Props for {@link DataBindingEditor}. */
export interface DataBindingEditorProps {
  /** The selected element whose binding is edited. */
  element: ReportElement
  /** Reports an edit as a partial element to merge into the model. */
  onChange?: (patch: Partial<ReportElement>) => void
  /** The fields available to bind to; defaults to the sample field catalog. */
  fields?: DataFieldDef[]
  /** The data the preview evaluates against; defaults to the sample context. */
  context?: DataContext
}

/** The unique scopes of the given fields, in first-seen order. */
function scopesOf(fields: DataFieldDef[]): string[] {
  return [...new Set(fields.map((f) => f.scope))]
}

/** Field `<option>`s grouped under an `<optgroup>` per scope. */
function FieldOptions({ fields }: { fields: DataFieldDef[] }) {
  return (
    <>
      {scopesOf(fields).map((scope) => (
        <optgroup key={scope} label={scope}>
          {fields
            .filter((f) => f.scope === scope)
            .map((f) => (
              <option key={fieldPath(f)} value={fieldPath(f)}>
                {f.label}
              </option>
            ))}
        </optgroup>
      ))}
    </>
  )
}

/**
 * Renders the Data tab editor for one element's binding (see the module summary).
 *
 * @param props The selected {@link ReportElement}, an `onChange` to report edits,
 * and the available fields and preview data (defaulting to the sample stand-ins).
 */
export function DataBindingEditor({
  element,
  onChange,
  fields = SAMPLE_FIELDS,
  context = SAMPLE_DATA_CONTEXT,
}: DataBindingEditorProps) {
  if (element.expression === undefined) {
    return <p className="rb-empty">No data binding — this is a static element.</p>
  }
  const expression = element.expression

  // A binding keeps the display token in sync with the expression (the common
  // case); a richer display string is still authorable via the Properties Text field.
  const setExpression = (next: string) => onChange?.({ expression: next, text: next })

  // The field a single-token expression binds to, or '' when the expression is
  // not a bare, known field reference (so the dropdown shows the custom option).
  const bound = /^\{([^{}]+)\}$/.exec(expression)?.[1] ?? ''
  const boundField = fields.some((f) => fieldPath(f) === bound) ? bound : ''

  const errors = validateExpression(expression, fields)
  const evaluated = errors.length === 0 ? evaluateExpression(expression, context) : null

  return (
    <div className="rb-data">
      {element.type === 'dataField' ? (
        <div className="rb-field">
          <label className="rb-field-label overline" htmlFor="rb-field-binding">
            Field
          </label>
          <select
            id="rb-field-binding"
            className="rb-field-input"
            value={boundField}
            onChange={(e) => setExpression(`{${e.target.value}}`)}
          >
            <option value="">— Select a field —</option>
            <FieldOptions fields={fields} />
          </select>
        </div>
      ) : (
        <Fragment>
          <div className="rb-field">
            <label className="rb-field-label overline" htmlFor="rb-field-expression">
              Expression
            </label>
            <input
              id="rb-field-expression"
              className="rb-field-input"
              type="text"
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
            />
          </div>

          <p className="rb-expr-hint overline">Functions: {EXPRESSION_FUNCTIONS.join(', ')}</p>

          <div className="rb-field">
            <label className="rb-field-label overline" htmlFor="rb-field-insert">
              Insert field
            </label>
            <select
              id="rb-field-insert"
              className="rb-field-input"
              value=""
              onChange={(e) => setExpression(`${expression}{${e.target.value}}`)}
            >
              <option value="">— Insert field —</option>
              <FieldOptions fields={fields} />
            </select>
          </div>
        </Fragment>
      )}

      {errors.length > 0 ? (
        <p className="rb-expr-error" role="alert">
          {errors[0].message}
        </p>
      ) : evaluated && !evaluated.ok ? (
        <p className="rb-expr-error" role="alert">
          {evaluated.error}
        </p>
      ) : (
        <p className="rb-expr-preview">Preview: {evaluated?.value}</p>
      )}
    </div>
  )
}
