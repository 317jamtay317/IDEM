using RecordKeeping.Application.Reporting;
using RecordKeeping.Reporting.Expressions;
using Shouldly;

namespace RecordKeeping.Reporting.Tests.SampleData;

/// <summary>
/// Verifies the server-side sample <see cref="ReportDataContext"/> mirrors the front-end's
/// <c>SAMPLE_DATA_CONTEXT</c> (Rieth-Riley's Goshen plant, three detail rows) so that every binding
/// the sample template authors resolves and previews cleanly. Asserted through the evaluator.
/// </summary>
public class SampleReportDataTests
{
    private static string Eval(string expression)
    {
        var result = ExpressionEvaluator.Evaluate(expression, SampleReportData.CreateContext());
        result.Ok.ShouldBeTrue(result.Error);
        return result.Value;
    }

    [Fact]
    public void Context_ResolvesSingularScopes()
    {
        Eval("{Org.Name}").ShouldBe("Rieth-Riley Construction Co.");
        Eval("{Facility.Name}").ShouldBe("Goshen Asphalt Plant");
        Eval("{Facility.PermitNumber}").ShouldBe("IN-018-00042");
        Eval("{Report.Year}").ShouldBe("2025");
        Eval("{Report.Date}").ShouldBe("March 12, 2026");
        Eval("{SubReport.opacity_detail}").ShouldBe("(opacity readings)");
    }

    [Fact]
    public void Context_HasThreeDetailRows() => SampleReportData.CreateContext().Detail.Count.ShouldBe(3);

    [Fact]
    public void Context_ResolvesDetailFieldsAndAggregates()
    {
        Eval("{Record.Field}").ShouldBe("Hot Mix");
        Eval("{Record.Tons}").ShouldBe("1280.5");
        Eval("SUM({Record.Tons})").ShouldBe("2240.75");
        Eval("COUNT({Record.Tons})").ShouldBe("3");
    }
}
