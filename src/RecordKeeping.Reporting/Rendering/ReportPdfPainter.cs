using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using RecordKeeping.Reporting.Layout;
using RecordKeeping.Reporting.Model;
using Color = QuestPDF.Infrastructure.Color;
using ModelFontWeight = RecordKeeping.Reporting.Model.FontWeight;

namespace RecordKeeping.Reporting.Rendering;

/// <summary>
/// Draws laid-out <see cref="RenderPage"/>s into a PDF with QuestPDF. Each primitive is placed at its
/// absolute page position (in points) via an overlay layer, so the banded, absolutely-positioned
/// design canvas maps directly onto the page.
/// </summary>
internal static class ReportPdfPainter
{
    private const double PointsPerInch = 72.0;
    private const double MinSizeInches = 1.0 / PointsPerInch; // never emit a zero-size box
    private const float LineThickness = 0.75f;
    private const float DefaultFontSizePt = 10f;
    private const string DefaultTextColor = "#0F172A";
    private const string DefaultShapeColor = "#64748B";
    private const string PlaceholderBorderColor = "#CBD5E1";
    private const string PlaceholderTextColor = "#94A3B8";

    static ReportPdfPainter()
    {
        // QuestPDF Community License — free under the project's revenue threshold. Disabling the
        // glyph check keeps rendering resilient when an authored font is unavailable on the host.
        QuestPDF.Settings.License = LicenseType.Community;
        QuestPDF.Settings.CheckIfAllTextGlyphsAreAvailable = false;
    }

    /// <summary>Renders the laid-out pages into a PDF document.</summary>
    /// <param name="pages">The pages to draw.</param>
    /// <returns>The PDF document bytes.</returns>
    public static byte[] Paint(IReadOnlyList<RenderPage> pages)
    {
        return Document.Create(document =>
        {
            foreach (var page in pages)
            {
                document.Page(descriptor =>
                {
                    descriptor.Size(new PageSize(Pt(page.Width), Pt(page.Height)));
                    descriptor.Margin(0);
                    descriptor.Content().Layers(layers =>
                    {
                        layers.PrimaryLayer(); // empty base layer; items overlay it
                        foreach (var item in page.Items)
                        {
                            var box = layers.Layer()
                                .TranslateX(Pt(item.Rect.X), Unit.Point)
                                .TranslateY(Pt(item.Rect.Y), Unit.Point)
                                .Width(Pt(Math.Max(item.Rect.Width, MinSizeInches)))
                                .Height(Pt(Math.Max(item.Rect.Height, MinSizeInches)));
                            PaintPrimitive(box, item);
                        }
                    });
                });
            }
        }).GeneratePdf();
    }

    private static void PaintPrimitive(IContainer container, RenderPrimitive item)
    {
        switch (item.Kind)
        {
            case PrimitiveKind.Text:
                PaintText(container, item);
                break;
            case PrimitiveKind.Line:
                container.LineHorizontal(LineThickness).LineColor(ShapeColor(item));
                break;
            case PrimitiveKind.Rectangle:
            case PrimitiveKind.Ellipse:
            case PrimitiveKind.Triangle:
                // v1 draws shapes as their bounding outline; precise ellipse/triangle vector paths
                // are a follow-up (QuestPDF's public Skia canvas API was withdrawn).
                container.Border(LineThickness).BorderColor(ShapeColor(item));
                break;
            case PrimitiveKind.Placeholder:
                PaintPlaceholder(container, item);
                break;
        }
    }

    private static void PaintText(IContainer container, RenderPrimitive item)
    {
        var style = BuildTextStyle(item.Style);
        container.Text(text =>
        {
            ApplyAlignment(text, item.Style?.Align);
            text.DefaultTextStyle(style);
            text.Span(item.Text ?? string.Empty);
        });
    }

    private static void PaintPlaceholder(IContainer container, RenderPrimitive item)
    {
        container
            .Border(LineThickness)
            .BorderColor(Color.FromHex(PlaceholderBorderColor))
            .AlignCenter()
            .AlignMiddle()
            .Text(text =>
            {
                text.AlignCenter();
                text.DefaultTextStyle(TextStyle.Default.FontSize(8f).FontColor(Color.FromHex(PlaceholderTextColor)));
                text.Span(item.Text ?? string.Empty);
            });
    }

    private static void ApplyAlignment(TextDescriptor text, TextAlign? align)
    {
        switch (align)
        {
            case TextAlign.Center:
                text.AlignCenter();
                break;
            case TextAlign.Right:
                text.AlignRight();
                break;
            default:
                text.AlignLeft();
                break;
        }
    }

    private static TextStyle BuildTextStyle(ElementStyle? style)
    {
        var textStyle = TextStyle.Default
            .FontSize((float)(style?.FontSize ?? DefaultFontSizePt))
            .FontColor(Color.FromHex(style?.Color ?? DefaultTextColor));

        if (style?.FontFamily is { } family)
        {
            textStyle = textStyle.FontFamily(family);
        }

        textStyle = style?.Weight switch
        {
            ModelFontWeight.Medium => textStyle.Medium(),
            ModelFontWeight.SemiBold => textStyle.SemiBold(),
            ModelFontWeight.Bold => textStyle.Bold(),
            _ => textStyle,
        };

        if (style?.Italic == true)
        {
            textStyle = textStyle.Italic();
        }

        if (style?.Underline == true)
        {
            textStyle = textStyle.Underline();
        }

        return textStyle;
    }

    private static Color ShapeColor(RenderPrimitive item) =>
        Color.FromHex(item.Style?.Color ?? DefaultShapeColor);

    private static float Pt(double inches) => (float)(inches * PointsPerInch);
}
