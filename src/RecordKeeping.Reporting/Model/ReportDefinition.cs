namespace RecordKeeping.Reporting.Model;

/// <summary>Which band of a banded report an element belongs to.</summary>
internal enum BandKind
{
    /// <summary>Report header — appears once at the top of the report.</summary>
    ReportHeader,

    /// <summary>Page header — repeats at the top of every page.</summary>
    PageHeader,

    /// <summary>Detail — repeats once per detail row.</summary>
    Detail,

    /// <summary>Sub-report — a nested block, appears once near the end.</summary>
    SubReport,

    /// <summary>Page footer — repeats at the bottom of every page.</summary>
    PageFooter,
}

/// <summary>The kind of element placed in a band, mirroring the front-end Insert palette.</summary>
internal enum ElementType
{
    /// <summary>Static text.</summary>
    Label,

    /// <summary>A single bound field value, e.g. <c>{Record.Tons}</c>.</summary>
    DataField,

    /// <summary>An aggregate expression, e.g. <c>SUM({Record.Tons})</c>.</summary>
    Formula,

    /// <summary>A straight line.</summary>
    Line,

    /// <summary>A rectangle outline.</summary>
    Rectangle,

    /// <summary>A triangle.</summary>
    Triangle,

    /// <summary>An ellipse.</summary>
    Ellipse,

    /// <summary>A raster image placeholder.</summary>
    Image,

    /// <summary>A barcode placeholder.</summary>
    Barcode,

    /// <summary>A nested sub-report placeholder.</summary>
    SubReport,

    /// <summary>A table placeholder.</summary>
    Table,

    /// <summary>A chart placeholder.</summary>
    Chart,

    /// <summary>An explicit page break.</summary>
    PageBreak,
}

/// <summary>Font weight for an element's text.</summary>
internal enum FontWeight
{
    /// <summary>Normal weight (400).</summary>
    Normal,

    /// <summary>Medium weight (500).</summary>
    Medium,

    /// <summary>Semi-bold weight (600).</summary>
    SemiBold,

    /// <summary>Bold weight (700).</summary>
    Bold,
}

/// <summary>Horizontal text alignment.</summary>
internal enum TextAlign
{
    /// <summary>Left-aligned.</summary>
    Left,

    /// <summary>Centre-aligned.</summary>
    Center,

    /// <summary>Right-aligned.</summary>
    Right,
}

/// <summary>An element's position and size within its band, in inches.</summary>
/// <param name="X">Distance from the band's left edge.</param>
/// <param name="Y">Distance from the band's top edge.</param>
/// <param name="Width">Width.</param>
/// <param name="Height">Height.</param>
internal sealed record ElementRect(double X, double Y, double Width, double Height);

/// <summary>Page margins, in inches.</summary>
/// <param name="Top">Top margin.</param>
/// <param name="Right">Right margin.</param>
/// <param name="Bottom">Bottom margin.</param>
/// <param name="Left">Left margin.</param>
internal sealed record PageMargins(double Top, double Right, double Bottom, double Left);

/// <summary>Page geometry, in inches.</summary>
/// <param name="Width">Page width.</param>
/// <param name="Height">Page height.</param>
/// <param name="Margins">Page margins.</param>
internal sealed record ReportPage(double Width, double Height, PageMargins Margins);

/// <summary>Designer settings persisted alongside the template.</summary>
/// <param name="SnapToGrid">Whether move/resize snaps to the grid.</param>
/// <param name="GridSize">Grid spacing, in inches.</param>
internal sealed record BuilderSettings(bool SnapToGrid, double GridSize);

/// <summary>Footer page-number options.</summary>
/// <param name="Show">Whether the footer page number is shown.</param>
/// <param name="Format">The page-number text, with <c>{n}</c> (current) and <c>{N}</c> (total) tokens.</param>
/// <param name="StartAt">The number the first page counts as, offsetting <c>{n}</c> and <c>{N}</c>.</param>
/// <param name="Position">Horizontal placement of the page number within the footer.</param>
internal sealed record PageNumberOptions(bool Show, string Format, int StartAt, TextAlign Position)
{
    /// <summary>The defaults applied when the RDL omits the page-number metadata (mirrors the front-end).</summary>
    public static PageNumberOptions Default { get; } = new(true, "Page {n} of {N}", 1, TextAlign.Right);
}

/// <summary>Visual styling for an element; every field is optional and falls back to a render default.</summary>
/// <param name="FontFamily">Font family, or <c>null</c> for the default.</param>
/// <param name="FontSize">Font size in points, or <c>null</c> for the default.</param>
/// <param name="Weight">Font weight, or <c>null</c> for the default.</param>
/// <param name="Italic">Whether the text is italic.</param>
/// <param name="Underline">Whether the text is underlined.</param>
/// <param name="Align">Horizontal alignment, or <c>null</c> for the default.</param>
/// <param name="Color">Fill (text) colour as a CSS hex string, or <c>null</c> for the default.</param>
internal sealed record ElementStyle(
    string? FontFamily,
    double? FontSize,
    FontWeight? Weight,
    bool Italic,
    bool Underline,
    TextAlign? Align,
    string? Color);

/// <summary>A single element placed in a band.</summary>
/// <param name="Id">Stable identifier, unique within the template.</param>
/// <param name="Type">What kind of element this is.</param>
/// <param name="Rect">Where the element sits within its band, in inches.</param>
/// <param name="Text">Static text or the display token for a binding, or <c>null</c>.</param>
/// <param name="Expression">Designer expression for a dataField/formula, or <c>null</c>.</param>
/// <param name="Style">Visual styling, or <c>null</c> for all defaults.</param>
internal sealed record ReportElementModel(
    string Id,
    ElementType Type,
    ElementRect Rect,
    string? Text,
    string? Expression,
    ElementStyle? Style);

/// <summary>A horizontal band of the report holding positioned elements, in document order.</summary>
/// <param name="Kind">Which band this is.</param>
/// <param name="Height">The band's height, in inches.</param>
/// <param name="Elements">The elements placed in this band.</param>
internal sealed record ReportBand(BandKind Kind, double Height, IReadOnlyList<ReportElementModel> Elements);

/// <summary>The parsed definition of a Report Template, reconstructed from its RDL/RDLC XML.</summary>
/// <param name="Id">Stable template identifier.</param>
/// <param name="Name">Display name.</param>
/// <param name="Version">Definition schema version (supports reproducibility, I-D08).</param>
/// <param name="Page">Page geometry.</param>
/// <param name="Bands">The report bands, in document order.</param>
/// <param name="Settings">Designer settings.</param>
/// <param name="PageNumbers">Footer page-number options.</param>
internal sealed record ReportDefinition(
    string Id,
    string Name,
    int Version,
    ReportPage Page,
    IReadOnlyList<ReportBand> Bands,
    BuilderSettings Settings,
    PageNumberOptions PageNumbers);
