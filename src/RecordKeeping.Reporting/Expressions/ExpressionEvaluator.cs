using System.Globalization;
using System.Text;
using RecordKeeping.Application.Reporting;

namespace RecordKeeping.Reporting.Expressions;

/// <summary>The outcome of evaluating an expression: a value, or the first error met.</summary>
/// <param name="Ok">Whether evaluation succeeded.</param>
/// <param name="Value">The rendered string when <paramref name="Ok"/> is <c>true</c>.</param>
/// <param name="Error">The error message when <paramref name="Ok"/> is <c>false</c>.</param>
internal readonly record struct EvalResult(bool Ok, string Value, string? Error)
{
    /// <summary>A successful result carrying the rendered value.</summary>
    /// <param name="value">The rendered string.</param>
    /// <returns>A successful <see cref="EvalResult"/>.</returns>
    public static EvalResult Success(string value) => new(true, value, null);

    /// <summary>A failed result carrying the error message.</summary>
    /// <param name="error">The error message.</param>
    /// <returns>A failed <see cref="EvalResult"/>.</returns>
    public static EvalResult Failure(string error) => new(false, string.Empty, error);
}

/// <summary>
/// Evaluates a designer expression against a <see cref="ReportDataContext"/>, the C# port of
/// <c>evaluateExpression</c> in <c>src/client/src/app/reportBuilder/expressions.ts</c>. Field
/// references resolve from their scope (detail fields from the first detail row); page tokens
/// substitute the page numbers; aggregate functions fold a detail field over every row. The first
/// error encountered short-circuits the result.
/// </summary>
internal static class ExpressionEvaluator
{
    private static readonly string[] Functions = ["SUM", "AVG", "COUNT", "MIN", "MAX"];

    /// <summary>Evaluates an expression, producing the displayed string or the first error met.</summary>
    /// <param name="expression">The designer expression to evaluate.</param>
    /// <param name="ctx">The data the expression is evaluated against.</param>
    /// <returns>A successful <see cref="EvalResult"/> with the rendered string, or a failed one.</returns>
    public static EvalResult Evaluate(string expression, ReportDataContext ctx)
    {
        var value = new StringBuilder();

        foreach (var segment in ExpressionParser.Parse(expression))
        {
            var part = segment switch
            {
                TextSegment t => EvalResult.Success(t.Value),
                PageSegment p => EvalResult.Success(
                    (p.Token == 'n' ? ctx.Page.Number : ctx.Page.Total).ToString(CultureInfo.InvariantCulture)),
                FieldSegment f => ResolveField(f.Scope, f.Field, ctx),
                FunctionSegment fn => ApplyFunction(fn.Name, fn.Scope, fn.Field, ctx),
                InvalidSegment i => EvalResult.Failure($"Invalid expression: {i.Raw}"),
                _ => EvalResult.Failure("Invalid expression."),
            };

            if (!part.Ok)
            {
                return part;
            }

            value.Append(part.Value);
        }

        return EvalResult.Success(value.ToString());
    }

    private static EvalResult ResolveField(string scope, string field, ReportDataContext ctx)
    {
        if (scope == ctx.DetailScope)
        {
            if (ctx.Detail.Count == 0)
            {
                return EvalResult.Failure("No detail rows");
            }

            return ctx.Detail[0].TryGetValue(field, out var rowValue)
                ? EvalResult.Success(rowValue)
                : EvalResult.Failure($"Unknown field: {scope}.{field}");
        }

        return ctx.Scopes.TryGetValue(scope, out var values) && values.TryGetValue(field, out var value)
            ? EvalResult.Success(value)
            : EvalResult.Failure($"Unknown field: {scope}.{field}");
    }

    private static EvalResult ApplyFunction(string name, string scope, string field, ReportDataContext ctx)
    {
        if (!Functions.Contains(name))
        {
            return EvalResult.Failure($"Unknown function: {name}");
        }

        if (scope != ctx.DetailScope)
        {
            return EvalResult.Failure($"{name}() requires a detail field");
        }

        if (ctx.Detail.Count > 0 && !ctx.Detail[0].ContainsKey(field))
        {
            return EvalResult.Failure($"Unknown field: {scope}.{field}");
        }

        if (name == "COUNT")
        {
            return EvalResult.Success(ctx.Detail.Count.ToString(CultureInfo.InvariantCulture));
        }

        var numbers = ctx.Detail
            .Select(row => ToNumber(row.TryGetValue(field, out var v) ? v : null))
            .ToList();

        var result = name switch
        {
            "SUM" => numbers.Sum(),
            "AVG" => numbers.Count > 0 ? numbers.Sum() / numbers.Count : 0,
            "MIN" => numbers.Count > 0 ? numbers.Min() : 0,
            _ => numbers.Count > 0 ? numbers.Max() : 0, // MAX
        };

        return EvalResult.Success(FormatNumber(result));
    }

    private static double ToNumber(string? value) =>
        double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out var d) ? d : double.NaN;

    /// <summary>Formats an aggregate result to at most two decimals, dropping trailing zeros.</summary>
    private static string FormatNumber(double n)
    {
        var rounded = Math.Round(n * 100, MidpointRounding.AwayFromZero) / 100;
        return rounded.ToString("0.##", CultureInfo.InvariantCulture);
    }
}
