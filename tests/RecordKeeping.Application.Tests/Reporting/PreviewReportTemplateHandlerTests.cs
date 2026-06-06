using ErrorOr;
using RecordKeeping.Application.Reporting;
using Shouldly;

namespace RecordKeeping.Application.Tests.Reporting;

/// <summary>
/// Verifies the preview handler renders the supplied RDL against the server-side sample data and
/// surfaces an empty template, or a renderer error, as an <see cref="ErrorOr{T}"/> failure.
/// </summary>
public class PreviewReportTemplateHandlerTests
{
    private sealed class FakeReportRenderer : IReportRenderer
    {
        public string? LastRdl { get; private set; }

        public ReportDataContext? LastData { get; private set; }

        public ErrorOr<byte[]> Result { get; set; } = new byte[] { 1, 2, 3 };

        public ErrorOr<IReadOnlyList<byte[]>> ImagesResult { get; set; } =
            new byte[][] { new byte[] { 1, 2, 3 } };

        public ErrorOr<byte[]> RenderPdf(string rdlXml, ReportDataContext data)
        {
            LastRdl = rdlXml;
            LastData = data;
            return Result;
        }

        public ErrorOr<IReadOnlyList<byte[]>> RenderPreviewImages(string rdlXml, ReportDataContext data)
        {
            LastRdl = rdlXml;
            LastData = data;
            return ImagesResult;
        }
    }

    [Fact]
    public void Handle_ValidRdl_RendersAgainstSampleDataAndReturnsBytes()
    {
        var renderer = new FakeReportRenderer { Result = new byte[] { 9, 9, 9 } };

        var result = PreviewReportTemplateHandler.Handle(new PreviewReportTemplateQuery("<rdl/>"), renderer);

        result.IsError.ShouldBeFalse();
        result.Value.ShouldBe(new byte[] { 9, 9, 9 });
        renderer.LastRdl.ShouldBe("<rdl/>");
        renderer.LastData.ShouldNotBeNull();
        renderer.LastData!.Detail.Count.ShouldBe(3); // the sample data context
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Handle_EmptyRdl_ReturnsValidationErrorWithoutCallingRenderer(string rdl)
    {
        var renderer = new FakeReportRenderer();

        var result = PreviewReportTemplateHandler.Handle(new PreviewReportTemplateQuery(rdl), renderer);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
        renderer.LastRdl.ShouldBeNull();
    }

    [Fact]
    public void Handle_RendererError_Propagates()
    {
        var renderer = new FakeReportRenderer { Result = Error.Validation("Reporting.InvalidRdl", "bad") };

        var result = PreviewReportTemplateHandler.Handle(new PreviewReportTemplateQuery("<bad>"), renderer);

        result.IsError.ShouldBeTrue();
        result.FirstError.Code.ShouldBe("Reporting.InvalidRdl");
    }
}
