using RecordKeeping.Application.Reporting;
using RecordKeeping.Reporting.Layout;
using RecordKeeping.Reporting.Model;
using Shouldly;

namespace RecordKeeping.Reporting.Tests.Layout;

/// <summary>
/// Verifies the pure layout engine that turns a parsed template + data into pages of
/// absolutely-placed primitives. It mirrors the front-end Preview
/// (<c>src/client/src/app/reportBuilder/preview.ts</c> / <c>ReportPreview.tsx</c>): logical
/// pagination driven by explicit page breaks, the detail band repeated once per detail row,
/// bands stacked from the top of the page, expression bindings resolved (with a fallback to the
/// element's display text), and the footer page number resolved per page.
/// </summary>
public class ReportLayoutEngineTests
{
    private static readonly ReportDataContext Data = SampleReportData.CreateContext();

    private static ReportPage LetterPage() => new(8.5, 11, new PageMargins(1, 1, 1, 1));

    private static ReportElementModel El(
        ElementType type, double x, double y, double w, double h, string? text = null, string? expr = null) =>
        new($"{type}-{x}-{y}", type, new ElementRect(x, y, w, h), text, expr, null);

    private static ReportBand Band(BandKind kind, double height, params ReportElementModel[] els) =>
        new(kind, height, els);

    private static ReportDefinition Def(PageNumberOptions pageNumbers, params ReportBand[] bands) =>
        new("t", "T", 1, LetterPage(), bands, new BuilderSettings(false, 0), pageNumbers);

    private static ReportDefinition Def(params ReportBand[] bands) =>
        Def(new PageNumberOptions(false, "Page {n} of {N}", 1, TextAlign.Right), bands);

    [Fact]
    public void Layout_NoPageBreaks_ProducesOnePage()
    {
        var def = Def(Band(BandKind.ReportHeader, 1.0, El(ElementType.Label, 0.5, 0.2, 2, 0.3, text: "Title")));

        var pages = ReportLayoutEngine.Layout(def, Data);

        pages.Count.ShouldBe(1);
        pages[0].Number.ShouldBe(1);
        pages[0].Width.ShouldBe(8.5);
        pages[0].Height.ShouldBe(11);
    }

    [Fact]
    public void Layout_CountsPagesFromPageBreaksAcrossAllBands()
    {
        var def = Def(Band(BandKind.ReportHeader, 1.0,
            El(ElementType.PageBreak, 0, 0, 6, 0.1),
            El(ElementType.PageBreak, 0, 0.2, 6, 0.1)));

        ReportLayoutEngine.Layout(def, Data).Count.ShouldBe(3);
    }

    [Fact]
    public void Layout_DetailBandRepeatsOncePerRow_WithRowData()
    {
        var def = Def(Band(BandKind.Detail, 0.3, El(ElementType.DataField, 0.5, 0.05, 2, 0.22, expr: "{Record.Field}")));

        var texts = ReportLayoutEngine.Layout(def, Data)[0].Items
            .Where(i => i.Kind == PrimitiveKind.Text).ToList();

        texts.Select(t => t.Text).ShouldBe(new[] { "Hot Mix", "Cold Mix", "Steel Slag" });
        texts[0].Rect.Y.ShouldBe(0.05);
        texts[1].Rect.Y.ShouldBe(0.35); // band 0 (0.3) + el y 0.05
        texts[2].Rect.Y.ShouldBe(0.65); // band 0+1 (0.6) + el y 0.05
    }

    [Fact]
    public void Layout_StacksBandsFromTop_DetailBelowReportHeader()
    {
        var def = Def(
            Band(BandKind.ReportHeader, 1.0, El(ElementType.Label, 0.5, 0.2, 2, 0.3, text: "Title")),
            Band(BandKind.Detail, 0.3, El(ElementType.DataField, 0.5, 0.05, 2, 0.22, expr: "{Record.Field}")));

        var page = ReportLayoutEngine.Layout(def, Data)[0];

        page.Items.First(i => i.Text == "Title").Rect.Y.ShouldBe(0.2);
        page.Items.First(i => i.Text == "Hot Mix").Rect.Y.ShouldBe(1.05); // header height 1.0 + el y 0.05
    }

    [Fact]
    public void Layout_PageFooterRendersResolvedPageNumberOnEveryPage()
    {
        var def = Def(
            new PageNumberOptions(true, "Page {n} of {N}", 1, TextAlign.Right),
            Band(BandKind.ReportHeader, 1.0, El(ElementType.PageBreak, 0, 0, 6, 0.1)),
            Band(BandKind.PageFooter, 0.35));

        var pages = ReportLayoutEngine.Layout(def, Data);

        pages.Count.ShouldBe(2);
        pages[0].Items.ShouldContain(i => i.Text == "Page 1 of 2");
        pages[1].Items.ShouldContain(i => i.Text == "Page 2 of 2");
    }

    [Fact]
    public void Layout_PageNumberHidden_NotRendered()
    {
        var def = Def(
            new PageNumberOptions(false, "Page {n} of {N}", 1, TextAlign.Right),
            Band(BandKind.PageFooter, 0.35));

        ReportLayoutEngine.Layout(def, Data)[0].Items
            .ShouldNotContain(i => i.Text != null && i.Text.StartsWith("Page "));
    }

    [Fact]
    public void Layout_PageBreakElement_ProducesNoPrimitive()
    {
        var def = Def(Band(BandKind.PageHeader, 0.3, El(ElementType.PageBreak, 0, 0, 6, 0.1)));

        ReportLayoutEngine.Layout(def, Data)[0].Items.ShouldBeEmpty();
    }

    [Fact]
    public void Layout_ReportHeaderAndDetailOnlyOnFirstPage_SubReportOnlyOnLast()
    {
        var def = Def(
            Band(BandKind.ReportHeader, 0.5, El(ElementType.Label, 0, 0.1, 2, 0.2, text: "Header")),
            Band(BandKind.Detail, 0.3,
                El(ElementType.PageBreak, 0, 0, 6, 0.1),
                El(ElementType.DataField, 0, 0.05, 2, 0.2, expr: "{Record.Field}")),
            Band(BandKind.SubReport, 0.5, El(ElementType.Label, 0, 0.1, 2, 0.2, text: "Sub")));

        var pages = ReportLayoutEngine.Layout(def, Data);

        pages.Count.ShouldBe(2);
        pages[0].Items.ShouldContain(i => i.Text == "Header");
        pages[0].Items.ShouldNotContain(i => i.Text == "Sub");
        pages[1].Items.ShouldNotContain(i => i.Text == "Header");
        pages[1].Items.ShouldContain(i => i.Text == "Sub");
    }

    [Fact]
    public void Layout_AdvancedType_RendersPlaceholderWithLabel()
    {
        var def = Def(Band(BandKind.ReportHeader, 1.0, El(ElementType.Image, 0.5, 0.2, 1.5, 1)));

        var item = ReportLayoutEngine.Layout(def, Data)[0].Items.ShouldHaveSingleItem();

        item.Kind.ShouldBe(PrimitiveKind.Placeholder);
        item.Text.ShouldBe("Image");
    }

    [Fact]
    public void Layout_UnresolvableExpression_FallsBackToDisplayText()
    {
        var def = Def(Band(BandKind.Detail, 0.3, El(ElementType.DataField, 0, 0.05, 2, 0.2, text: "N/A", expr: "{Bad.Field}")));

        ReportLayoutEngine.Layout(def, Data)[0].Items
            .Where(i => i.Kind == PrimitiveKind.Text)
            .Select(t => t.Text)
            .ShouldAllBe(t => t == "N/A");
    }

    [Fact]
    public void Layout_ShapesRenderAsTheirOwnPrimitiveKinds()
    {
        var def = Def(Band(BandKind.ReportHeader, 1.0,
            El(ElementType.Line, 0, 0.1, 4, 0),
            El(ElementType.Rectangle, 0, 0.3, 2, 1),
            El(ElementType.Ellipse, 3, 0.3, 1, 1),
            El(ElementType.Triangle, 5, 0.3, 1, 1)));

        var kinds = ReportLayoutEngine.Layout(def, Data)[0].Items.Select(i => i.Kind).ToList();

        kinds.ShouldContain(PrimitiveKind.Line);
        kinds.ShouldContain(PrimitiveKind.Rectangle);
        kinds.ShouldContain(PrimitiveKind.Ellipse);
        kinds.ShouldContain(PrimitiveKind.Triangle);
    }
}
