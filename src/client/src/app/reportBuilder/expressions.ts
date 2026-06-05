/**
 * The Report Builder's designer-side expression dialect: the small language an
 * element's data binding is written in, plus a pure parser, evaluator and
 * validator for it.
 *
 * An expression is literal text interleaved with three kinds of token:
 * - a **field reference** `{Scope.Field}` (e.g. `{Facility.Name}`, `{Record.Tons}`),
 * - a **page-number token** `{n}` (current page) or `{N}` (total pages), and
 * - an **aggregate function** over a detail field, e.g. `SUM({Record.Tons})`.
 *
 * This is the *designer* dialect; it maps to RDL expressions
 * (`=Fields!Tons.Value`, `=Sum(Fields!Tons.Value)`, `=Globals!PageNumber`) only
 * at the Save boundary (a later phase). Everything here is pure: no DOM, no
 * model dependency, so it is exercised in isolation.
 */

/** Metadata for a bindable field, as offered in the Data Field dropdown. */
export interface DataFieldDef {
  /** The scope (entity) the field belongs to, e.g. `Facility`, `Record`. */
  scope: string
  /** The field name within the scope, e.g. `Name`, `Tons`. */
  field: string
  /** A human-readable label for the field, shown in the picker. */
  label: string
  /**
   * Whether the field lives on a *detail* row (one value per Record) rather than
   * a singular scope. Only detail fields may be aggregated by a function.
   */
  isDetail: boolean
}

/** Joins a field's scope and name into its dotted path, e.g. `Record.Tons`. */
export function fieldPath(field: { scope: string; field: string }): string {
  return `${field.scope}.${field.field}`
}

/** The aggregate functions an expression may apply to a detail field. */
export const EXPRESSION_FUNCTIONS = ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX'] as const

/** One of the supported {@link EXPRESSION_FUNCTIONS}. */
export type ExpressionFunction = (typeof EXPRESSION_FUNCTIONS)[number]

/**
 * A parsed piece of an expression: literal text, a field reference, a page-number
 * token, an aggregate function over a field, or an unrecognized (invalid) token.
 */
export type ExprSegment =
  | { kind: 'text'; value: string }
  | { kind: 'field'; scope: string; field: string }
  | { kind: 'page'; token: 'n' | 'N' }
  | { kind: 'function'; name: string; scope: string; field: string }
  | { kind: 'invalid'; raw: string }

/**
 * The data an expression is evaluated against — sample data while the builder is
 * front-end only, real Report data once the Report Engine runs a Template.
 */
export interface DataContext {
  /** Singular scope values, keyed by scope then field (e.g. `scopes.Facility.Name`). */
  scopes: Record<string, Record<string, string | number>>
  /** The scope whose fields are detail (per-row) fields, e.g. `Record`. */
  detailScope: string
  /** The detail rows, each a map of field name to value. */
  detail: Record<string, string | number>[]
  /** The page context backing the `{n}` / `{N}` tokens. */
  page: { number: number; total: number }
}

/** The outcome of evaluating an expression: a value, or the first error met. */
export type EvalResult = { ok: true; value: string } | { ok: false; error: string }

/** A single validation problem found in an expression. */
export interface ExprError {
  /** A human-readable description of the problem. */
  message: string
}

/** Matches a `NAME({inner})` aggregate call or a bare `{inner}` token. */
const TOKEN = /([A-Za-z][A-Za-z0-9]*)\(\s*\{([^{}]*)\}\s*\)|\{([^{}]*)\}/g

/** Matches a well-formed `Scope.Field` path inside a token. */
const FIELD_PATH = /^([A-Za-z][A-Za-z0-9]*)\.([A-Za-z][A-Za-z0-9_]*)$/

/** Parses the inner text of a token into a field segment, or `null` if malformed. */
function parseFieldToken(inner: string): { scope: string; field: string } | null {
  const m = FIELD_PATH.exec(inner)
  return m ? { scope: m[1], field: m[2] } : null
}

/**
 * Parses an expression string into its ordered {@link ExprSegment}s. Literal text
 * between tokens is preserved; malformed tokens become `invalid` segments rather
 * than throwing, so callers can flag them.
 *
 * @param expression The designer expression to parse.
 * @returns The segments in source order (empty for an empty string).
 */
export function parseExpression(expression: string): ExprSegment[] {
  const segments: ExprSegment[] = []
  let lastIndex = 0
  TOKEN.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = TOKEN.exec(expression)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ kind: 'text', value: expression.slice(lastIndex, match.index) })
    }
    lastIndex = TOKEN.lastIndex

    const [raw, funcName, funcInner, tokenInner] = match
    if (funcName !== undefined) {
      const field = parseFieldToken(funcInner)
      segments.push(
        field
          ? { kind: 'function', name: funcName.toUpperCase(), scope: field.scope, field: field.field }
          : { kind: 'invalid', raw },
      )
    } else if (tokenInner === 'n' || tokenInner === 'N') {
      segments.push({ kind: 'page', token: tokenInner })
    } else {
      const field = parseFieldToken(tokenInner)
      segments.push(field ? { kind: 'field', scope: field.scope, field: field.field } : { kind: 'invalid', raw })
    }
  }
  if (lastIndex < expression.length) {
    segments.push({ kind: 'text', value: expression.slice(lastIndex) })
  }
  return segments
}

/** Formats an aggregate result to at most two decimals, dropping trailing zeros. */
function formatNumber(n: number): string {
  return String(Math.round(n * 100) / 100)
}

/** Resolves a single field reference against the data context. */
function resolveField(scope: string, field: string, ctx: DataContext): EvalResult {
  if (scope === ctx.detailScope) {
    const row = ctx.detail[0]
    if (!row) return { ok: false, error: 'No detail rows' }
    if (!(field in row)) return { ok: false, error: `Unknown field: ${scope}.${field}` }
    return { ok: true, value: String(row[field]) }
  }
  const values = ctx.scopes[scope]
  if (!values || !(field in values)) return { ok: false, error: `Unknown field: ${scope}.${field}` }
  return { ok: true, value: String(values[field]) }
}

/** Applies an aggregate function to a detail field across all detail rows. */
function applyFunction(name: string, scope: string, field: string, ctx: DataContext): EvalResult {
  if (!(EXPRESSION_FUNCTIONS as readonly string[]).includes(name)) {
    return { ok: false, error: `Unknown function: ${name}` }
  }
  if (scope !== ctx.detailScope) return { ok: false, error: `${name}() requires a detail field` }
  if (ctx.detail.length > 0 && !(field in ctx.detail[0])) {
    return { ok: false, error: `Unknown field: ${scope}.${field}` }
  }
  if (name === 'COUNT') return { ok: true, value: String(ctx.detail.length) }

  const numbers = ctx.detail.map((row) => Number(row[field]))
  let result: number
  switch (name) {
    case 'SUM':
      result = numbers.reduce((a, b) => a + b, 0)
      break
    case 'AVG':
      result = numbers.length ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0
      break
    case 'MIN':
      result = Math.min(...numbers)
      break
    default: // MAX
      result = Math.max(...numbers)
  }
  return { ok: true, value: formatNumber(result) }
}

/**
 * Evaluates an expression against a {@link DataContext}, producing the displayed
 * string or the first error encountered. Field references resolve from their
 * scope (detail fields from the first detail row); page tokens substitute the
 * page numbers; aggregate functions fold a detail field over every row.
 *
 * @param expression The designer expression to evaluate.
 * @param ctx The data the expression is evaluated against.
 * @returns `{ ok: true, value }` with the rendered string, or `{ ok: false, error }`.
 */
export function evaluateExpression(expression: string, ctx: DataContext): EvalResult {
  let value = ''
  for (const segment of parseExpression(expression)) {
    let part: EvalResult
    switch (segment.kind) {
      case 'text':
        part = { ok: true, value: segment.value }
        break
      case 'page':
        part = { ok: true, value: String(segment.token === 'n' ? ctx.page.number : ctx.page.total) }
        break
      case 'field':
        part = resolveField(segment.scope, segment.field, ctx)
        break
      case 'function':
        part = applyFunction(segment.name, segment.scope, segment.field, ctx)
        break
      default: // invalid
        part = { ok: false, error: `Invalid expression: ${segment.raw}` }
    }
    if (!part.ok) return part
    value += part.value
  }
  return { ok: true, value }
}

/**
 * Validates an expression against the catalog of available fields, returning a
 * problem for every unknown field, unknown function, mis-applied aggregate or
 * malformed token (in source order). An empty array means the expression is
 * sound.
 *
 * @param expression The designer expression to validate.
 * @param fields The fields the expression may reference.
 * @returns The problems found, in source order (empty when valid).
 */
export function validateExpression(expression: string, fields: DataFieldDef[]): ExprError[] {
  const detailByPath = new Map(fields.map((f) => [fieldPath(f), f.isDetail]))
  const errors: ExprError[] = []
  for (const segment of parseExpression(expression)) {
    if (segment.kind === 'invalid') {
      errors.push({ message: `Invalid field reference: ${segment.raw}` })
    } else if (segment.kind === 'field') {
      const path = `${segment.scope}.${segment.field}`
      if (!detailByPath.has(path)) errors.push({ message: `Unknown field: ${path}` })
    } else if (segment.kind === 'function') {
      const path = `${segment.scope}.${segment.field}`
      if (!(EXPRESSION_FUNCTIONS as readonly string[]).includes(segment.name)) {
        errors.push({ message: `Unknown function: ${segment.name}` })
      } else if (!detailByPath.has(path)) {
        errors.push({ message: `Unknown field: ${path}` })
      } else if (!detailByPath.get(path)) {
        errors.push({ message: `${segment.name}() requires a detail field` })
      }
    }
  }
  return errors
}
