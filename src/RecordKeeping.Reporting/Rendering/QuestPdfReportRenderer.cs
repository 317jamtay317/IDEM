using ErrorOr;
using RecordKeeping.Application.Reporting;
using RecordKeeping.Reporting.Layout;
using RecordKeeping.Reporting.Rdl;

namespace RecordKeeping.Reporting.Rendering;

/// <summary>
/// The Report Engine's <see cref="IReportRenderer"/>: parses a Report Template's RDL, lays it out
/// against a <see cref="ReportDataContext"/> and renders the result to a PDF with QuestPDF.
/// </summary>
public sealed class QuestPdfReportRenderer : IReportRenderer
{
    /// <inheritdoc />
    public ErrorOr<byte[]> RenderPdf(string rdlXml, ReportDataContext data)
    {
        var parsed = RdlReader.Parse(rdlXml);
        if (parsed.IsError)
        {
            return parsed.Errors;
        }

        var pages = ReportLayoutEngine.Layout(parsed.Value, data);
        return ReportPdfPainter.Paint(pages);
    }
}
