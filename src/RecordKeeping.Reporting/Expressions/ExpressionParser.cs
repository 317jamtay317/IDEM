using System.Text.RegularExpressions;

namespace RecordKeeping.Reporting.Expressions;

/// <summary>A parsed piece of a designer expression.</summary>
internal abstract record ExprSegment;

/// <summary>Literal text between tokens.</summary>
/// <param name="Value">The literal text.</param>
internal sealed record TextSegment(string Value) : ExprSegment;

/// <summary>A field reference, e.g. <c>{Facility.Name}</c>.</summary>
/// <param name="Scope">The scope (entity) the field belongs to.</param>
/// <param name="Field">The field name within the scope.</param>
internal sealed record FieldSegment(string Scope, string Field) : ExprSegment;

/// <summary>A page-number token: <c>{n}</c> (current) or <c>{N}</c> (total).</summary>
/// <param name="Token">The token character, <c>'n'</c> or <c>'N'</c>.</param>
internal sealed record PageSegment(char Token) : ExprSegment;

/// <summary>An aggregate function over a detail field, e.g. <c>SUM({Record.Tons})</c>.</summary>
/// <param name="Name">The function name, upper-cased.</param>
/// <param name="Scope">The scope of the aggregated field.</param>
/// <param name="Field">The aggregated field name.</param>
internal sealed record FunctionSegment(string Name, string Scope, string Field) : ExprSegment;

/// <summary>An unrecognized or malformed token.</summary>
/// <param name="Raw">The raw token text.</param>
internal sealed record InvalidSegment(string Raw) : ExprSegment;

/// <summary>
/// Parses a designer expression into ordered <see cref="ExprSegment"/>s, the C# port of
/// <c>parseExpression</c> in <c>src/client/src/app/reportBuilder/expressions.ts</c>. Literal text
/// between tokens is preserved; malformed tokens become <see cref="InvalidSegment"/>s rather than
/// throwing, so callers can flag them.
/// </summary>
internal static partial class ExpressionParser
{
    /// <summary>Matches a <c>NAME({inner})</c> aggregate call or a bare <c>{inner}</c> token.</summary>
    [GeneratedRegex(@"([A-Za-z][A-Za-z0-9]*)\(\s*\{([^{}]*)\}\s*\)|\{([^{}]*)\}")]
    private static partial Regex TokenRegex();

    /// <summary>Matches a well-formed <c>Scope.Field</c> path inside a token.</summary>
    [GeneratedRegex(@"^([A-Za-z][A-Za-z0-9]*)\.([A-Za-z][A-Za-z0-9_]*)$")]
    private static partial Regex FieldPathRegex();

    /// <summary>Parses an expression string into its ordered segments (empty for an empty string).</summary>
    /// <param name="expression">The designer expression to parse.</param>
    /// <returns>The segments in source order.</returns>
    public static IReadOnlyList<ExprSegment> Parse(string expression)
    {
        var segments = new List<ExprSegment>();
        var lastIndex = 0;

        foreach (Match match in TokenRegex().Matches(expression))
        {
            if (match.Index > lastIndex)
            {
                segments.Add(new TextSegment(expression[lastIndex..match.Index]));
            }

            lastIndex = match.Index + match.Length;

            var funcName = match.Groups[1];
            var funcInner = match.Groups[2];
            var tokenInner = match.Groups[3];

            if (funcName.Success)
            {
                segments.Add(ParseFieldToken(funcInner.Value) is { } f
                    ? new FunctionSegment(funcName.Value.ToUpperInvariant(), f.Scope, f.Field)
                    : new InvalidSegment(match.Value));
            }
            else if (tokenInner.Value is "n" or "N")
            {
                segments.Add(new PageSegment(tokenInner.Value[0]));
            }
            else
            {
                segments.Add(ParseFieldToken(tokenInner.Value) is { } f
                    ? new FieldSegment(f.Scope, f.Field)
                    : new InvalidSegment(match.Value));
            }
        }

        if (lastIndex < expression.Length)
        {
            segments.Add(new TextSegment(expression[lastIndex..]));
        }

        return segments;
    }

    private static (string Scope, string Field)? ParseFieldToken(string inner)
    {
        var m = FieldPathRegex().Match(inner);
        return m.Success ? (m.Groups[1].Value, m.Groups[2].Value) : null;
    }
}
