using RecordKeeping.Reporting.Layout;
using RecordKeeping.Reporting.Model;
using Shouldly;

namespace RecordKeeping.Reporting.Tests.Layout;

/// <summary>
/// Verifies the C# port of <c>formatPageNumber</c>
/// (<c>src/client/src/app/reportBuilder/pageNumbers.ts</c>): <c>{n}</c> becomes the current page
/// and <c>{N}</c> the total, each offset so the first page counts as <c>startAt</c>, every
/// occurrence substituted.
/// </summary>
public class PageNumberFormatterTests
{
    [Fact]
    public void Format_SubstitutesCurrentAndTotal() =>
        PageNumberFormatter.Format(PageNumberOptions.Default, 2, 5).ShouldBe("Page 2 of 5");

    [Fact]
    public void Format_AppliesStartAtOffsetToBothTokens()
    {
        var options = PageNumberOptions.Default with { StartAt = 5 };

        PageNumberFormatter.Format(options, 1, 3).ShouldBe("Page 5 of 7");
    }

    [Fact]
    public void Format_SubstitutesEveryOccurrence()
    {
        var options = new PageNumberOptions(true, "{n}/{N} — page {n}", 1, TextAlign.Right);

        PageNumberFormatter.Format(options, 2, 4).ShouldBe("2/4 — page 2");
    }

    [Fact]
    public void Format_LiteralWithoutTokens_PassesThrough()
    {
        var options = new PageNumberOptions(true, "Confidential", 1, TextAlign.Center);

        PageNumberFormatter.Format(options, 1, 1).ShouldBe("Confidential");
    }
}
