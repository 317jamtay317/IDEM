using System.Globalization;
using System.Xml;
using System.Xml.Linq;
using ErrorOr;
using RecordKeeping.Reporting.Model;

namespace RecordKeeping.Reporting.Rdl;

/// <summary>
/// Parses the RDL/RDLC XML produced by the front-end Report Builder
/// (<c>src/client/src/app/reportBuilder/rdl.ts</c>) back into a <see cref="ReportDefinition"/>.
/// The document is the real RDL <c>Report/Page/Body</c> shell with report bands carried as
/// <c>rk:Band</c>-tagged Rectangles and designer metadata (template id/version, element kind and
/// designer expression) carried in a custom namespace. Foreign report items — those without the
/// <c>rk:Element</c> marker — are skipped rather than rejected, mirroring the front-end parser.
/// </summary>
internal static class RdlReader
{
    /// <summary>The RDL 2016 report-definition namespace.</summary>
    private const string Rdl = "http://schemas.microsoft.com/sqlserver/reporting/2016/01/reportdefinition";

    /// <summary>The Report Builder custom-metadata namespace.</summary>
    private const string Rk = "urn:recordkeeping:reportbuilder:v1";

    /// <summary>
    /// Parses an RDL/RDLC document into a <see cref="ReportDefinition"/>.
    /// </summary>
    /// <param name="xml">The RDL XML document.</param>
    /// <returns>
    /// The parsed <see cref="ReportDefinition"/>, or a validation error when the document is not
    /// well-formed (<c>Reporting.InvalidRdl</c>), is missing the <c>rk:Template</c> metadata
    /// (<c>Reporting.MissingTemplate</c>), or is missing the <c>Page</c> element
    /// (<c>Reporting.MissingPage</c>).
    /// </returns>
    public static ErrorOr<ReportDefinition> Parse(string xml)
    {
        XDocument doc;
        try
        {
            doc = XDocument.Parse(xml);
        }
        catch (XmlException ex)
        {
            return Error.Validation(
                "Reporting.InvalidRdl", $"The RDL document is not well-formed XML: {ex.Message}");
        }

        var report = doc.Root;
        if (report is null)
        {
            return Error.Validation("Reporting.InvalidRdl", "The RDL document has no root element.");
        }

        var template = report.Element(XName.Get("Template", Rk));
        if (template is null)
        {
            return Error.Validation(
                "Reporting.MissingTemplate", "The RDL document is missing the rk:Template metadata.");
        }

        var pageEl = report.Element(XName.Get("Page", Rdl));
        if (pageEl is null)
        {
            return Error.Validation("Reporting.MissingPage", "The RDL document is missing the Page element.");
        }

        var page = new ReportPage(
            Width: SizeOf(pageEl, "PageWidth"),
            Height: SizeOf(pageEl, "PageHeight"),
            Margins: new PageMargins(
                Top: SizeOf(pageEl, "TopMargin"),
                Right: SizeOf(pageEl, "RightMargin"),
                Bottom: SizeOf(pageEl, "BottomMargin"),
                Left: SizeOf(pageEl, "LeftMargin")));

        var settings = new BuilderSettings(
            SnapToGrid: template.Attribute("snapToGrid")?.Value == "true",
            GridSize: ParseDouble(template.Attribute("gridSize")?.Value));

        return new ReportDefinition(
            Id: template.Attribute("id")?.Value ?? string.Empty,
            Name: template.Attribute("name")?.Value ?? string.Empty,
            Version: ParseInt(template.Attribute("version")?.Value),
            Page: page,
            Bands: ParseBands(report),
            Settings: settings,
            PageNumbers: ParsePageNumbers(report));
    }

    private static IReadOnlyList<ReportBand> ParseBands(XElement report)
    {
        var items = report.Element(XName.Get("Body", Rdl))?.Element(XName.Get("ReportItems", Rdl));
        if (items is null)
        {
            return Array.Empty<ReportBand>();
        }

        var bands = new List<ReportBand>();
        foreach (var rect in items.Elements(XName.Get("Rectangle", Rdl)))
        {
            if (ParseBand(rect) is { } band)
            {
                bands.Add(band);
            }
        }

        return bands;
    }

    private static ReportBand? ParseBand(XElement rect)
    {
        var meta = rect.Element(XName.Get("Band", Rk));
        if (ParseBandKind(meta?.Attribute("kind")?.Value) is not { } kind)
        {
            return null; // not a modelled band (no rk:Band marker)
        }

        var elements = new List<ReportElementModel>();
        var items = rect.Element(XName.Get("ReportItems", Rdl));
        if (items is not null)
        {
            foreach (var el in items.Elements())
            {
                if (ParseElement(el) is { } element)
                {
                    elements.Add(element);
                }
            }
        }

        return new ReportBand(kind, SizeOf(rect, "Height"), elements);
    }

    private static ReportElementModel? ParseElement(XElement el)
    {
        var meta = el.Element(XName.Get("Element", Rk));
        if (meta is null || ParseElementType(meta.Attribute("type")?.Value) is not { } type)
        {
            return null; // tolerate foreign / non-modelled RDL items
        }

        var rect = new ElementRect(
            X: SizeOf(el, "Left"),
            Y: SizeOf(el, "Top"),
            Width: SizeOf(el, "Width"),
            Height: SizeOf(el, "Height"));

        var styleEl = el.Element(XName.Get("Style", Rdl));

        return new ReportElementModel(
            Id: el.Attribute("Name")?.Value ?? string.Empty,
            Type: type,
            Rect: rect,
            Text: el.Element(XName.Get("Value", Rdl))?.Value,
            Expression: meta.Attribute("expression")?.Value,
            Style: styleEl is null ? null : ParseStyle(styleEl));
    }

    private static ElementStyle ParseStyle(XElement style) => new(
        FontFamily: ChildText(style, "FontFamily"),
        FontSize: ParseNullableDouble(StripUnit(ChildText(style, "FontSize"), "pt")),
        Weight: ParseFontWeight(ChildText(style, "FontWeight")),
        Italic: ChildText(style, "FontStyle") == "Italic",
        Underline: ChildText(style, "TextDecoration") == "Underline",
        Align: ParseTextAlign(ChildText(style, "TextAlign")),
        Color: ChildText(style, "Color"));

    private static PageNumberOptions ParsePageNumbers(XElement report)
    {
        var el = report.Element(XName.Get("PageNumbers", Rk));
        if (el is null)
        {
            return PageNumberOptions.Default;
        }

        return new PageNumberOptions(
            Show: el.Attribute("show")?.Value == "true",
            Format: el.Attribute("format")?.Value ?? PageNumberOptions.Default.Format,
            StartAt: ParseIntOr(el.Attribute("startAt")?.Value, PageNumberOptions.Default.StartAt),
            Position: ParseTextAlign(el.Attribute("position")?.Value) ?? PageNumberOptions.Default.Position);
    }

    private static string? ChildText(XElement el, string localName) =>
        el.Element(XName.Get(localName, Rdl))?.Value;

    private static double SizeOf(XElement el, string localName) =>
        ParseDouble(StripUnit(ChildText(el, localName), "in"));

    private static string? StripUnit(string? value, string unit)
    {
        if (value is null)
        {
            return null;
        }

        var trimmed = value.Trim();
        return trimmed.EndsWith(unit, StringComparison.OrdinalIgnoreCase)
            ? trimmed[..^unit.Length]
            : trimmed;
    }

    private static double ParseDouble(string? value) =>
        double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out var d) ? d : 0;

    private static double? ParseNullableDouble(string? value) =>
        double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out var d) ? d : null;

    private static int ParseInt(string? value) =>
        int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var n) ? n : 0;

    private static int ParseIntOr(string? value, int fallback) =>
        int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var n) ? n : fallback;

    private static BandKind? ParseBandKind(string? value) => value switch
    {
        "reportHeader" => BandKind.ReportHeader,
        "pageHeader" => BandKind.PageHeader,
        "detail" => BandKind.Detail,
        "subReport" => BandKind.SubReport,
        "pageFooter" => BandKind.PageFooter,
        _ => null,
    };

    private static ElementType? ParseElementType(string? value) => value switch
    {
        "label" => ElementType.Label,
        "dataField" => ElementType.DataField,
        "formula" => ElementType.Formula,
        "line" => ElementType.Line,
        "rectangle" => ElementType.Rectangle,
        "triangle" => ElementType.Triangle,
        "ellipse" => ElementType.Ellipse,
        "image" => ElementType.Image,
        "barcode" => ElementType.Barcode,
        "subReport" => ElementType.SubReport,
        "table" => ElementType.Table,
        "chart" => ElementType.Chart,
        "pageBreak" => ElementType.PageBreak,
        _ => null,
    };

    private static FontWeight? ParseFontWeight(string? value) => value switch
    {
        "Normal" => FontWeight.Normal,
        "Medium" => FontWeight.Medium,
        "SemiBold" => FontWeight.SemiBold,
        "Bold" => FontWeight.Bold,
        _ => null,
    };

    private static TextAlign? ParseTextAlign(string? value) => value?.ToLowerInvariant() switch
    {
        "left" => TextAlign.Left,
        "center" => TextAlign.Center,
        "right" => TextAlign.Right,
        _ => null,
    };
}
