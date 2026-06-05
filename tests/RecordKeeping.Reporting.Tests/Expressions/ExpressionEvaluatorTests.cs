using RecordKeeping.Application.Reporting;
using RecordKeeping.Reporting.Expressions;
using Shouldly;

namespace RecordKeeping.Reporting.Tests.Expressions;

/// <summary>
/// Verifies the C# port of the front-end designer expression dialect
/// (<c>src/client/src/app/reportBuilder/expressions.ts</c>): literal text interleaved with field
/// references <c>{Scope.Field}</c>, page tokens <c>{n}</c>/<c>{N}</c>, and aggregate functions
/// (<c>SUM/AVG/COUNT/MIN/MAX</c>) folded over the detail rows.
/// </summary>
public class ExpressionEvaluatorTests
{
    private static ReportDataContext Context() => new(
        Scopes: new Dictionary<string, IReadOnlyDictionary<string, string>>
        {
            ["Org"] = new Dictionary<string, string> { ["Name"] = "Rieth-Riley Construction Co." },
            ["Facility"] = new Dictionary<string, string>
            {
                ["Name"] = "Goshen Asphalt Plant",
                ["PermitNumber"] = "IN-018-00042",
            },
            ["Report"] = new Dictionary<string, string> { ["Year"] = "2025" },
        },
        DetailScope: "Record",
        Detail: new IReadOnlyDictionary<string, string>[]
        {
            new Dictionary<string, string> { ["Field"] = "Hot Mix", ["Tons"] = "1280.5" },
            new Dictionary<string, string> { ["Field"] = "Cold Mix", ["Tons"] = "642.25" },
            new Dictionary<string, string> { ["Field"] = "Steel Slag", ["Tons"] = "318" },
        },
        Page: new ReportPageContext(1, 3));

    private static string Eval(string expression)
    {
        var result = ExpressionEvaluator.Evaluate(expression, Context());
        result.Ok.ShouldBeTrue(result.Error);
        return result.Value;
    }

    [Fact]
    public void Evaluate_LiteralText_PassesThrough() => Eval("Hello").ShouldBe("Hello");

    [Fact]
    public void Evaluate_SingularField_ResolvesFromScope() =>
        Eval("{Facility.Name}").ShouldBe("Goshen Asphalt Plant");

    [Fact]
    public void Evaluate_MixedTextAndFields() =>
        Eval("{Facility.Name} — Calendar Year {Report.Year}")
            .ShouldBe("Goshen Asphalt Plant — Calendar Year 2025");

    [Fact]
    public void Evaluate_DetailField_ResolvesFirstRow() => Eval("{Record.Field}").ShouldBe("Hot Mix");

    [Fact]
    public void Evaluate_PageTokens_Substitute() => Eval("Page {n} of {N}").ShouldBe("Page 1 of 3");

    [Fact]
    public void Evaluate_Sum_FoldsOverDetailRows() => Eval("SUM({Record.Tons})").ShouldBe("2240.75");

    [Fact]
    public void Evaluate_Count_CountsDetailRows() => Eval("COUNT({Record.Tons})").ShouldBe("3");

    [Fact]
    public void Evaluate_Avg_RoundsToTwoDecimals() => Eval("AVG({Record.Tons})").ShouldBe("746.92");

    [Fact]
    public void Evaluate_Min_ReturnsSmallest() => Eval("MIN({Record.Tons})").ShouldBe("318");

    [Fact]
    public void Evaluate_Max_ReturnsLargest() => Eval("MAX({Record.Tons})").ShouldBe("1280.5");

    [Fact]
    public void Evaluate_UnknownField_ReturnsError() =>
        ExpressionEvaluator.Evaluate("{Facility.Nope}", Context()).Ok.ShouldBeFalse();

    [Fact]
    public void Evaluate_AggregateOverNonDetailScope_ReturnsError() =>
        ExpressionEvaluator.Evaluate("SUM({Org.Name})", Context()).Ok.ShouldBeFalse();

    [Fact]
    public void Evaluate_MalformedToken_ReturnsError() =>
        ExpressionEvaluator.Evaluate("{not a path}", Context()).Ok.ShouldBeFalse();

    [Fact]
    public void Evaluate_UnknownFunction_ReturnsError() =>
        ExpressionEvaluator.Evaluate("FOO({Record.Tons})", Context()).Ok.ShouldBeFalse();
}
