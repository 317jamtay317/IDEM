using RecordKeeping.Reporting.Model;

namespace RecordKeeping.Reporting.Layout;

/// <summary>The kind of low-level primitive the layout engine emits for the painter to draw.</summary>
internal enum PrimitiveKind
{
    /// <summary>A run of resolved text within a box.</summary>
    Text,

    /// <summary>A straight horizontal rule.</summary>
    Line,

    /// <summary>A rectangle outline.</summary>
    Rectangle,

    /// <summary>An ellipse outline.</summary>
    Ellipse,

    /// <summary>A triangle outline.</summary>
    Triangle,

    /// <summary>A labelled placeholder block for an advanced element type not yet drawn for real.</summary>
    Placeholder,
}

/// <summary>
/// One drawing instruction at an absolute, page-relative position (in inches). The layout engine
/// has already resolved bindings, repeated the detail band, and stacked the bands, so the painter
/// only has to draw each primitive where it is told.
/// </summary>
/// <param name="Kind">What to draw.</param>
/// <param name="Rect">The page-absolute box, in inches.</param>
/// <param name="Text">The resolved text (for <see cref="PrimitiveKind.Text"/>) or the label
/// (for <see cref="PrimitiveKind.Placeholder"/>); <c>null</c> for shapes.</param>
/// <param name="Style">The element's styling (for text), or <c>null</c>.</param>
internal sealed record RenderPrimitive(PrimitiveKind Kind, ElementRect Rect, string? Text, ElementStyle? Style);

/// <summary>One laid-out page: its size and the primitives to draw on it.</summary>
/// <param name="Number">The 1-based page number.</param>
/// <param name="Width">Page width, in inches.</param>
/// <param name="Height">Page height, in inches.</param>
/// <param name="Items">The primitives to draw, in paint order.</param>
internal sealed record RenderPage(int Number, double Width, double Height, IReadOnlyList<RenderPrimitive> Items);
