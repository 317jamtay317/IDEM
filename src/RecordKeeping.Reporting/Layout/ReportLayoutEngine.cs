using RecordKeeping.Application.Reporting;
using RecordKeeping.Reporting.Expressions;
using RecordKeeping.Reporting.Model;

namespace RecordKeeping.Reporting.Layout;

/// <summary>
/// Turns a parsed <see cref="ReportDefinition"/> and a <see cref="ReportDataContext"/> into a list of
/// laid-out <see cref="RenderPage"/>s. The layout mirrors the front-end Preview
/// (<c>src/client/src/app/reportBuilder/preview.ts</c>): pages are driven by explicit page breaks,
/// the detail band repeats once per detail row, bands stack from the top of the page, every binding
/// is resolved (falling back to the element's display text, then its raw expression, if evaluation
/// fails), and the footer page number is resolved per page. The geometry the designer authored is
/// used as-is (page margins are carried on the definition but, like the builder canvas, not applied
/// to element positions), so the rendered page matches what the SiteAdmin sees while building.
/// </summary>
internal static class ReportLayoutEngine
{
    /// <summary>Lays the template out across its pages for the given data.</summary>
    /// <param name="definition">The parsed report definition.</param>
    /// <param name="data">The data bindings resolve against.</param>
    /// <returns>The laid-out pages, in order.</returns>
    public static IReadOnlyList<RenderPage> Layout(ReportDefinition definition, ReportDataContext data)
    {
        var pageCount = PageCount(definition);
        var pages = new List<RenderPage>(pageCount);

        for (var pageIndex = 0; pageIndex < pageCount; pageIndex++)
        {
            var pageNumber = pageIndex + 1;
            var pageContext = data with { Page = new ReportPageContext(pageNumber, pageCount) };
            var items = new List<RenderPrimitive>();
            var y = 0d;

            foreach (var band in definition.Bands)
            {
                if (!BandAppearsOnPage(band.Kind, pageIndex, pageCount))
                {
                    continue;
                }

                if (band.Kind == BandKind.Detail)
                {
                    for (var row = 0; row < pageContext.Detail.Count; row++)
                    {
                        var rowContext = pageContext with { Detail = new[] { pageContext.Detail[row] } };
                        AddBandElements(items, band, rowContext, y);
                        y += band.Height;
                    }
                }
                else
                {
                    AddBandElements(items, band, pageContext, y);
                    if (band.Kind == BandKind.PageFooter && definition.PageNumbers.Show)
                    {
                        items.Add(PageNumberPrimitive(definition, band, y, pageNumber, pageCount));
                    }

                    y += band.Height;
                }
            }

            pages.Add(new RenderPage(pageNumber, definition.Page.Width, definition.Page.Height, items));
        }

        return pages;
    }

    private static void AddBandElements(
        List<RenderPrimitive> items, ReportBand band, ReportDataContext context, double bandTop)
    {
        foreach (var element in band.Elements)
        {
            if (ToPrimitive(element, context, bandTop) is { } primitive)
            {
                items.Add(primitive);
            }
        }
    }

    private static RenderPrimitive? ToPrimitive(ReportElementModel element, ReportDataContext context, double bandTop)
    {
        if (element.Type == ElementType.PageBreak)
        {
            return null; // a page break carries no drawable content
        }

        var rect = new ElementRect(element.Rect.X, bandTop + element.Rect.Y, element.Rect.Width, element.Rect.Height);

        return element.Type switch
        {
            ElementType.Label or ElementType.DataField or ElementType.Formula =>
                new RenderPrimitive(PrimitiveKind.Text, rect, ResolveText(element, context), element.Style),
            ElementType.Line => new RenderPrimitive(PrimitiveKind.Line, rect, null, element.Style),
            ElementType.Rectangle => new RenderPrimitive(PrimitiveKind.Rectangle, rect, null, element.Style),
            ElementType.Ellipse => new RenderPrimitive(PrimitiveKind.Ellipse, rect, null, element.Style),
            ElementType.Triangle => new RenderPrimitive(PrimitiveKind.Triangle, rect, null, element.Style),
            _ => new RenderPrimitive(PrimitiveKind.Placeholder, rect, PlaceholderLabel(element.Type), element.Style),
        };
    }

    /// <summary>
    /// Resolves the text shown for an element: an expression-bound element is evaluated against the
    /// data (falling back to its display text, then the raw expression, if evaluation fails); a static
    /// element shows its text; a textless element shows nothing.
    /// </summary>
    private static string ResolveText(ReportElementModel element, ReportDataContext context)
    {
        if (element.Expression is { } expression)
        {
            var result = ExpressionEvaluator.Evaluate(expression, context);
            return result.Ok ? result.Value : element.Text ?? expression;
        }

        return element.Text ?? string.Empty;
    }

    private static RenderPrimitive PageNumberPrimitive(
        ReportDefinition definition, ReportBand footer, double footerTop, int pageNumber, int pageCount)
    {
        var text = PageNumberFormatter.Format(definition.PageNumbers, pageNumber, pageCount);

        // Span the footer width and sit near the band's bottom, mirroring the preview's footer overlay.
        var height = Math.Min(0.22, footer.Height);
        var rect = new ElementRect(0, footerTop + (footer.Height - height), definition.Page.Width, height);
        var style = new ElementStyle(null, null, null, false, false, definition.PageNumbers.Position, null);

        return new RenderPrimitive(PrimitiveKind.Text, rect, text, style);
    }

    /// <summary>The page count: one, plus one per page-break element across all bands.</summary>
    private static int PageCount(ReportDefinition definition) =>
        1 + definition.Bands.Sum(b => b.Elements.Count(e => e.Type == ElementType.PageBreak));

    /// <summary>
    /// Whether a band renders on a given page: the report header and detail on the first page, the
    /// sub-report on the last page, and the page header and footer on every page.
    /// </summary>
    private static bool BandAppearsOnPage(BandKind kind, int pageIndex, int pageCount) => kind switch
    {
        BandKind.ReportHeader or BandKind.Detail => pageIndex == 0,
        BandKind.SubReport => pageIndex == pageCount - 1,
        _ => true, // PageHeader, PageFooter
    };

    private static string PlaceholderLabel(ElementType type) => type switch
    {
        ElementType.Image => "Image",
        ElementType.Barcode => "Barcode",
        ElementType.SubReport => "Sub Report",
        ElementType.Table => "Table",
        ElementType.Chart => "Chart",
        _ => type.ToString(),
    };
}
