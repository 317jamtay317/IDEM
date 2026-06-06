using System.Text;
using RecordKeeping.Application.Reporting;
using RecordKeeping.Reporting.Layout;
using RecordKeeping.Reporting.Rdl;
using RecordKeeping.Reporting.Rendering;
using Shouldly;

namespace RecordKeeping.Reporting.Tests.Rendering;

/// <summary>
/// Verifies the QuestPDF renderer produces a valid PDF for a template that exercises every primitive
/// kind (styled text, line, rectangle, ellipse, triangle, image placeholder, footer page number),
/// across multiple pages, and surfaces RDL parse problems as errors rather than throwing.
/// </summary>
public class QuestPdfReportRendererTests
{
    private readonly QuestPdfReportRenderer _renderer = new();

    private static ReportDataContext Data() => SampleReportData.CreateContext();

    // A template touching every drawable element type, with a page break (two pages) and footer
    // page numbers, so rendering it executes every painter branch.
    private const string FullRdl = """
        <?xml version="1.0" encoding="utf-8"?>
        <Report xmlns="http://schemas.microsoft.com/sqlserver/reporting/2016/01/reportdefinition" xmlns:rk="urn:recordkeeping:reportbuilder:v1">
          <rk:Template id="t" name="Smoke" version="1" snapToGrid="true" gridSize="0.125"/>
          <rk:PageNumbers show="true" format="Page {n} of {N}" startAt="1" position="right"/>
          <Page><PageHeight>11in</PageHeight><PageWidth>8.5in</PageWidth><TopMargin>1in</TopMargin><RightMargin>1in</RightMargin><BottomMargin>1in</BottomMargin><LeftMargin>1in</LeftMargin></Page>
          <Body><ReportItems>
            <Rectangle Name="Band_reportHeader">
              <rk:Band kind="reportHeader"/><Height>1.5in</Height>
              <ReportItems>
                <Textbox Name="title"><rk:Element type="label"/><Top>0.1in</Top><Left>0.42in</Left><Height>0.34in</Height><Width>4in</Width>
                  <Style><FontFamily>Inter</FontFamily><FontSize>22pt</FontSize><FontWeight>SemiBold</FontWeight><FontStyle>Italic</FontStyle><TextDecoration>Underline</TextDecoration><TextAlign>Center</TextAlign><Color>#0f172a</Color></Style>
                  <Value>Smoke Test</Value></Textbox>
                <Line Name="rule"><rk:Element type="line"/><Top>0.6in</Top><Left>0.42in</Left><Height>0in</Height><Width>6.6in</Width></Line>
                <Rectangle Name="box"><rk:Element type="rectangle"/><Top>0.7in</Top><Left>0.42in</Left><Height>0.5in</Height><Width>1.5in</Width></Rectangle>
                <Rectangle Name="circle"><rk:Element type="ellipse"/><Top>0.7in</Top><Left>2.2in</Left><Height>0.5in</Height><Width>0.5in</Width></Rectangle>
                <Rectangle Name="tri"><rk:Element type="triangle"/><Top>0.7in</Top><Left>3in</Left><Height>0.5in</Height><Width>0.5in</Width></Rectangle>
                <Image Name="logo"><rk:Element type="image"/><Top>0.7in</Top><Left>4in</Left><Height>0.6in</Height><Width>1.2in</Width></Image>
              </ReportItems>
            </Rectangle>
            <Rectangle Name="Band_detail">
              <rk:Band kind="detail"/><Height>0.3in</Height>
              <ReportItems>
                <Textbox Name="rec"><rk:Element type="dataField" expression="{Record.Field}"/><Top>0.04in</Top><Left>0.42in</Left><Height>0.22in</Height><Width>2in</Width><Value>{Record.Field}</Value></Textbox>
                <Textbox Name="tot"><rk:Element type="formula" expression="SUM({Record.Tons})"/><Top>0.04in</Top><Left>3in</Left><Height>0.22in</Height><Width>2in</Width><Value>SUM({Record.Tons})</Value></Textbox>
                <Rectangle Name="pb"><rk:Element type="pageBreak"/><Top>0.2in</Top><Left>0in</Left><Height>0.1in</Height><Width>6.5in</Width></Rectangle>
              </ReportItems>
            </Rectangle>
            <Rectangle Name="Band_pageFooter">
              <rk:Band kind="pageFooter"/><Height>0.35in</Height>
              <ReportItems>
                <Textbox Name="foot"><rk:Element type="label"/><Top>0.08in</Top><Left>0.42in</Left><Height>0.22in</Height><Width>2in</Width><Value>Rieth-Riley</Value></Textbox>
              </ReportItems>
            </Rectangle>
          </ReportItems></Body>
        </Report>
        """;

    [Fact]
    public void RenderPdf_TemplateWithEveryPrimitive_ProducesValidPdf()
    {
        var result = _renderer.RenderPdf(FullRdl, Data());

        result.IsError.ShouldBeFalse(result.IsError ? result.FirstError.Description : null);
        var bytes = result.Value;
        bytes.Length.ShouldBeGreaterThan(1000);
        Encoding.ASCII.GetString(bytes, 0, 5).ShouldBe("%PDF-");
    }

    [Fact]
    public void RenderPdf_MalformedRdl_ReturnsValidationErrorAndDoesNotThrow()
    {
        var result = _renderer.RenderPdf("<Report><not-closed>", Data());

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorOr.ErrorType.Validation);
    }

    [Fact]
    public void RenderPdf_MissingTemplateMetadata_ReturnsError()
    {
        const string rdl = """
            <Report xmlns="http://schemas.microsoft.com/sqlserver/reporting/2016/01/reportdefinition" xmlns:rk="urn:recordkeeping:reportbuilder:v1">
              <Page><PageHeight>11in</PageHeight><PageWidth>8.5in</PageWidth><TopMargin>1in</TopMargin><RightMargin>1in</RightMargin><BottomMargin>1in</BottomMargin><LeftMargin>1in</LeftMargin></Page>
            </Report>
            """;

        _renderer.RenderPdf(rdl, Data()).IsError.ShouldBeTrue();
    }

    // The eight-byte PNG file signature; every page image the live preview pushes must start with it.
    private static readonly byte[] PngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

    [Fact]
    public void RenderPreviewImages_MultiPageTemplate_ProducesOnePngPerPage()
    {
        var data = Data();
        var expectedPageCount = ReportLayoutEngine.Layout(RdlReader.Parse(FullRdl).Value, data).Count;

        var result = _renderer.RenderPreviewImages(FullRdl, data);

        result.IsError.ShouldBeFalse(result.IsError ? result.FirstError.Description : null);
        result.Value.Count.ShouldBe(expectedPageCount);
        foreach (var png in result.Value)
        {
            png.Length.ShouldBeGreaterThan(100);
            png.Take(PngSignature.Length).ShouldBe(PngSignature);
        }
    }

    [Fact]
    public void RenderPreviewImages_MalformedRdl_ReturnsValidationErrorAndDoesNotThrow()
    {
        var result = _renderer.RenderPreviewImages("<Report><not-closed>", Data());

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorOr.ErrorType.Validation);
    }
}
