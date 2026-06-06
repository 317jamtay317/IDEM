using ErrorOr;

namespace RecordKeeping.Application.Reporting;

/// <summary>
/// Renders a Report Template (its RDL/RDLC XML) bound to a <see cref="ReportDataContext"/> into a
/// PDF. Implemented by the Report Engine in the Infrastructure-equivalent Reporting project and
/// resolved at the composition root, so the Application layer stays free of the rendering library.
/// </summary>
public interface IReportRenderer
{
    /// <summary>
    /// Parses the template's RDL, binds it to <paramref name="data"/>, lays it out across its pages
    /// and renders a PDF.
    /// </summary>
    /// <param name="rdlXml">The Report Template's RDL/RDLC XML.</param>
    /// <param name="data">The data the template's expressions are evaluated against.</param>
    /// <returns>The rendered PDF bytes, or a validation error when the RDL cannot be parsed.</returns>
    ErrorOr<byte[]> RenderPdf(string rdlXml, ReportDataContext data);

    /// <summary>
    /// Renders the template to one raster image (PNG) per page, for the live in-browser preview that
    /// updates as a Report Template is built. Unlike <see cref="RenderPdf"/> the result is page-addressable,
    /// so a watcher can display each page directly without a PDF viewer.
    /// </summary>
    /// <param name="rdlXml">The Report Template's RDL/RDLC XML.</param>
    /// <param name="data">The data the template's expressions are evaluated against.</param>
    /// <returns>
    /// The page images in page order (one PNG per page), or a validation error when the RDL cannot be parsed.
    /// </returns>
    ErrorOr<IReadOnlyList<byte[]>> RenderPreviewImages(string rdlXml, ReportDataContext data);
}
