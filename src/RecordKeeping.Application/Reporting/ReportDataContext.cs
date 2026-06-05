namespace RecordKeeping.Application.Reporting;

/// <summary>
/// The page context backing the <c>{n}</c> (current page) and <c>{N}</c> (total pages) tokens while
/// a Report Template's expressions are evaluated.
/// </summary>
/// <param name="Number">The current page number.</param>
/// <param name="Total">The total number of pages.</param>
public sealed record ReportPageContext(int Number, int Total);

/// <summary>
/// The data a Report Template's expressions are evaluated against when the Report Engine renders it —
/// the server-side counterpart of the front-end builder's <c>DataContext</c>. Singular scope values
/// (Org, Facility, Report, …) resolve a <c>{Scope.Field}</c> reference; the <see cref="Detail"/> rows
/// back the repeating detail band and the aggregate functions; <see cref="Page"/> backs the page
/// tokens. All values are pre-formatted strings so the evaluator stays free of formatting concerns.
/// </summary>
/// <param name="Scopes">Singular scope values, keyed by scope name then field name.</param>
/// <param name="DetailScope">The scope whose fields are per-row detail fields, e.g. <c>Record</c>.</param>
/// <param name="Detail">The detail rows, each a map of field name to value.</param>
/// <param name="Page">The page context backing the <c>{n}</c>/<c>{N}</c> tokens.</param>
public sealed record ReportDataContext(
    IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> Scopes,
    string DetailScope,
    IReadOnlyList<IReadOnlyDictionary<string, string>> Detail,
    ReportPageContext Page);
