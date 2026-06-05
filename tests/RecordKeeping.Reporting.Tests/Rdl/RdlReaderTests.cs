using RecordKeeping.Reporting.Model;
using RecordKeeping.Reporting.Rdl;
using Shouldly;

namespace RecordKeeping.Reporting.Tests.Rdl;

/// <summary>
/// Verifies <see cref="RdlReader"/> parses the exact RDL/RDLC shape the front-end Report Builder
/// emits (see <c>src/client/src/app/reportBuilder/rdl.ts</c>): the RDL <c>Report/Page/Body</c> shell,
/// bands as <c>rk:Band</c>-tagged Rectangles, elements as <c>rk:Element</c>-tagged report items with
/// geometry in inches, a <c>Style</c> block, and the <c>rk:Template</c>/<c>rk:PageNumbers</c> metadata.
/// </summary>
public class RdlReaderTests
{
    // A representative document in the exact form toRdl() produces: Letter page, two bands
    // (reportHeader with a styled label + an expression-bound dataField, detail with a dataField).
    private const string SampleRdl = """
        <?xml version="1.0" encoding="utf-8"?>
        <Report xmlns="http://schemas.microsoft.com/sqlserver/reporting/2016/01/reportdefinition" xmlns:rk="urn:recordkeeping:reportbuilder:v1">
          <rk:Template id="annual-emissions" name="Annual Emissions Inventory" version="1" snapToGrid="true" gridSize="0.125"/>
          <rk:PageNumbers show="true" format="Page {n} of {N}" startAt="1" position="right"/>
          <Page>
            <PageHeight>11in</PageHeight>
            <PageWidth>8.5in</PageWidth>
            <TopMargin>1in</TopMargin>
            <RightMargin>1in</RightMargin>
            <BottomMargin>1in</BottomMargin>
            <LeftMargin>1in</LeftMargin>
          </Page>
          <Body>
            <ReportItems>
              <Rectangle Name="Band_reportHeader">
                <rk:Band kind="reportHeader"/>
                <Height>1.5in</Height>
                <ReportItems>
                  <Textbox Name="title">
                    <rk:Element type="label"/>
                    <Top>0.44in</Top>
                    <Left>0.42in</Left>
                    <Height>0.34in</Height>
                    <Width>4in</Width>
                    <Style>
                      <FontFamily>Inter</FontFamily>
                      <FontSize>22pt</FontSize>
                      <FontWeight>SemiBold</FontWeight>
                      <FontStyle>Italic</FontStyle>
                      <TextDecoration>Underline</TextDecoration>
                      <TextAlign>Center</TextAlign>
                      <Color>#0f172a</Color>
                    </Style>
                    <Value>Annual Emissions Inventory</Value>
                  </Textbox>
                  <Textbox Name="subtitle">
                    <rk:Element type="dataField" expression="{Facility.Name}"/>
                    <Top>0.95in</Top>
                    <Left>0.42in</Left>
                    <Height>0.25in</Height>
                    <Width>4.8in</Width>
                    <Value>{Facility.Name} &#8212; Calendar Year {Report.Year}</Value>
                  </Textbox>
                </ReportItems>
              </Rectangle>
              <Rectangle Name="Band_detail">
                <rk:Band kind="detail"/>
                <Height>0.3in</Height>
                <ReportItems>
                  <Textbox Name="rec-tons">
                    <rk:Element type="dataField" expression="{Record.Tons}"/>
                    <Top>0.04in</Top>
                    <Left>3.6in</Left>
                    <Height>0.22in</Height>
                    <Width>1.2in</Width>
                    <Value>{Record.Tons}</Value>
                  </Textbox>
                </ReportItems>
              </Rectangle>
            </ReportItems>
          </Body>
        </Report>
        """;

    private static ReportDefinition Parsed()
    {
        var result = RdlReader.Parse(SampleRdl);
        result.IsError.ShouldBeFalse();
        return result.Value;
    }

    [Fact]
    public void Parse_ReadsTemplateMetadata()
    {
        var def = Parsed();

        def.Id.ShouldBe("annual-emissions");
        def.Name.ShouldBe("Annual Emissions Inventory");
        def.Version.ShouldBe(1);
        def.Settings.SnapToGrid.ShouldBeTrue();
        def.Settings.GridSize.ShouldBe(0.125);
    }

    [Fact]
    public void Parse_ReadsPageGeometry()
    {
        var page = Parsed().Page;

        page.Width.ShouldBe(8.5);
        page.Height.ShouldBe(11);
        page.Margins.Top.ShouldBe(1);
        page.Margins.Right.ShouldBe(1);
        page.Margins.Bottom.ShouldBe(1);
        page.Margins.Left.ShouldBe(1);
    }

    [Fact]
    public void Parse_ReadsPageNumberOptions()
    {
        var pn = Parsed().PageNumbers;

        pn.Show.ShouldBeTrue();
        pn.Format.ShouldBe("Page {n} of {N}");
        pn.StartAt.ShouldBe(1);
        pn.Position.ShouldBe(TextAlign.Right);
    }

    [Fact]
    public void Parse_ReadsBandsInDocumentOrder()
    {
        var bands = Parsed().Bands;

        bands.Count.ShouldBe(2);
        bands[0].Kind.ShouldBe(BandKind.ReportHeader);
        bands[0].Height.ShouldBe(1.5);
        bands[0].Elements.Count.ShouldBe(2);
        bands[1].Kind.ShouldBe(BandKind.Detail);
        bands[1].Height.ShouldBe(0.3);
        bands[1].Elements.Count.ShouldBe(1);
    }

    [Fact]
    public void Parse_ReadsElementGeometryTextAndExpression()
    {
        var title = Parsed().Bands[0].Elements[0];

        title.Id.ShouldBe("title");
        title.Type.ShouldBe(ElementType.Label);
        title.Rect.X.ShouldBe(0.42);
        title.Rect.Y.ShouldBe(0.44);
        title.Rect.Width.ShouldBe(4);
        title.Rect.Height.ShouldBe(0.34);
        title.Text.ShouldBe("Annual Emissions Inventory");
        title.Expression.ShouldBeNull();

        var subtitle = Parsed().Bands[0].Elements[1];
        subtitle.Type.ShouldBe(ElementType.DataField);
        subtitle.Expression.ShouldBe("{Facility.Name}");
        subtitle.Text.ShouldBe("{Facility.Name} — Calendar Year {Report.Year}");
    }

    [Fact]
    public void Parse_ReadsElementStyle()
    {
        var style = Parsed().Bands[0].Elements[0].Style;

        style.ShouldNotBeNull();
        style!.FontFamily.ShouldBe("Inter");
        style.FontSize.ShouldBe(22);
        style.Weight.ShouldBe(FontWeight.SemiBold);
        style.Italic.ShouldBeTrue();
        style.Underline.ShouldBeTrue();
        style.Align.ShouldBe(TextAlign.Center);
        style.Color.ShouldBe("#0f172a");
    }

    [Fact]
    public void Parse_UnstyledElement_HasNoStyle()
    {
        Parsed().Bands[1].Elements[0].Style.ShouldBeNull();
    }

    [Fact]
    public void Parse_SkipsForeignItemsWithoutRkMarker()
    {
        const string rdl = """
            <?xml version="1.0" encoding="utf-8"?>
            <Report xmlns="http://schemas.microsoft.com/sqlserver/reporting/2016/01/reportdefinition" xmlns:rk="urn:recordkeeping:reportbuilder:v1">
              <rk:Template id="t" name="T" version="1" snapToGrid="false" gridSize="0"/>
              <Page><PageHeight>11in</PageHeight><PageWidth>8.5in</PageWidth><TopMargin>1in</TopMargin><RightMargin>1in</RightMargin><BottomMargin>1in</BottomMargin><LeftMargin>1in</LeftMargin></Page>
              <Body><ReportItems>
                <Rectangle Name="Band_detail">
                  <rk:Band kind="detail"/>
                  <Height>0.3in</Height>
                  <ReportItems>
                    <Textbox Name="foreign"><Value>not ours</Value></Textbox>
                    <Textbox Name="mine"><rk:Element type="label"/><Top>0in</Top><Left>0in</Left><Height>0.2in</Height><Width>1in</Width><Value>Mine</Value></Textbox>
                  </ReportItems>
                </Rectangle>
              </ReportItems></Body>
            </Report>
            """;

        var def = RdlReader.Parse(rdl);

        def.IsError.ShouldBeFalse();
        def.Value.Bands[0].Elements.Count.ShouldBe(1);
        def.Value.Bands[0].Elements[0].Id.ShouldBe("mine");
    }

    [Fact]
    public void Parse_MissingPageNumbers_FallsBackToDefaults()
    {
        const string rdl = """
            <?xml version="1.0" encoding="utf-8"?>
            <Report xmlns="http://schemas.microsoft.com/sqlserver/reporting/2016/01/reportdefinition" xmlns:rk="urn:recordkeeping:reportbuilder:v1">
              <rk:Template id="t" name="T" version="1" snapToGrid="true" gridSize="0.125"/>
              <Page><PageHeight>11in</PageHeight><PageWidth>8.5in</PageWidth><TopMargin>1in</TopMargin><RightMargin>1in</RightMargin><BottomMargin>1in</BottomMargin><LeftMargin>1in</LeftMargin></Page>
              <Body><ReportItems/></Body>
            </Report>
            """;

        var pn = RdlReader.Parse(rdl).Value.PageNumbers;

        pn.Show.ShouldBeTrue();
        pn.Format.ShouldBe("Page {n} of {N}");
        pn.StartAt.ShouldBe(1);
        pn.Position.ShouldBe(TextAlign.Right);
    }

    [Fact]
    public void Parse_MalformedXml_ReturnsValidationError()
    {
        var result = RdlReader.Parse("<Report><not-closed>");

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorOr.ErrorType.Validation);
    }

    [Fact]
    public void Parse_MissingTemplateMetadata_ReturnsValidationError()
    {
        const string rdl = """
            <Report xmlns="http://schemas.microsoft.com/sqlserver/reporting/2016/01/reportdefinition" xmlns:rk="urn:recordkeeping:reportbuilder:v1">
              <Page><PageHeight>11in</PageHeight><PageWidth>8.5in</PageWidth><TopMargin>1in</TopMargin><RightMargin>1in</RightMargin><BottomMargin>1in</BottomMargin><LeftMargin>1in</LeftMargin></Page>
            </Report>
            """;

        RdlReader.Parse(rdl).IsError.ShouldBeTrue();
    }

    [Fact]
    public void Parse_MissingPage_ReturnsValidationError()
    {
        const string rdl = """
            <Report xmlns="http://schemas.microsoft.com/sqlserver/reporting/2016/01/reportdefinition" xmlns:rk="urn:recordkeeping:reportbuilder:v1">
              <rk:Template id="t" name="T" version="1" snapToGrid="true" gridSize="0.125"/>
            </Report>
            """;

        RdlReader.Parse(rdl).IsError.ShouldBeTrue();
    }

    private const string Rdl2016 = "http://schemas.microsoft.com/sqlserver/reporting/2016/01/reportdefinition";
    private const string RkNs = "urn:recordkeeping:reportbuilder:v1";

    private static string WrapBand(string bandKind, string elementsXml) => $$"""
        <?xml version="1.0" encoding="utf-8"?>
        <Report xmlns="{{Rdl2016}}" xmlns:rk="{{RkNs}}">
          <rk:Template id="t" name="T" version="1" snapToGrid="true" gridSize="0.125"/>
          <Page><PageHeight>11in</PageHeight><PageWidth>8.5in</PageWidth><TopMargin>1in</TopMargin><RightMargin>1in</RightMargin><BottomMargin>1in</BottomMargin><LeftMargin>1in</LeftMargin></Page>
          <Body><ReportItems>
            <Rectangle Name="Band_{{bandKind}}"><rk:Band kind="{{bandKind}}"/><Height>0.3in</Height><ReportItems>{{elementsXml}}</ReportItems></Rectangle>
          </ReportItems></Body>
        </Report>
        """;

    [Theory]
    [InlineData("reportHeader", "ReportHeader")]
    [InlineData("pageHeader", "PageHeader")]
    [InlineData("detail", "Detail")]
    [InlineData("subReport", "SubReport")]
    [InlineData("pageFooter", "PageFooter")]
    public void Parse_MapsEveryBandKind(string kind, string expected)
    {
        var def = RdlReader.Parse(WrapBand(kind, string.Empty));

        def.IsError.ShouldBeFalse();
        def.Value.Bands.ShouldHaveSingleItem().Kind.ToString().ShouldBe(expected);
    }

    [Theory]
    [InlineData("label", "Label")]
    [InlineData("dataField", "DataField")]
    [InlineData("formula", "Formula")]
    [InlineData("line", "Line")]
    [InlineData("rectangle", "Rectangle")]
    [InlineData("triangle", "Triangle")]
    [InlineData("ellipse", "Ellipse")]
    [InlineData("image", "Image")]
    [InlineData("barcode", "Barcode")]
    [InlineData("subReport", "SubReport")]
    [InlineData("table", "Table")]
    [InlineData("chart", "Chart")]
    [InlineData("pageBreak", "PageBreak")]
    public void Parse_MapsEveryElementType(string type, string expected)
    {
        var element = $"""<Textbox Name="e"><rk:Element type="{type}"/><Top>0in</Top><Left>0in</Left><Height>0.2in</Height><Width>1in</Width></Textbox>""";

        var def = RdlReader.Parse(WrapBand("detail", element));

        def.IsError.ShouldBeFalse();
        def.Value.Bands[0].Elements.ShouldHaveSingleItem().Type.ToString().ShouldBe(expected);
    }

    [Theory]
    [InlineData("Normal", "Normal")]
    [InlineData("Medium", "Medium")]
    [InlineData("SemiBold", "SemiBold")]
    [InlineData("Bold", "Bold")]
    public void Parse_MapsEveryFontWeight(string weight, string expected)
    {
        var element = $"""<Textbox Name="e"><rk:Element type="label"/><Top>0in</Top><Left>0in</Left><Height>0.2in</Height><Width>1in</Width><Style><FontWeight>{weight}</FontWeight></Style></Textbox>""";

        var def = RdlReader.Parse(WrapBand("detail", element));

        def.Value.Bands[0].Elements[0].Style!.Weight!.Value.ToString().ShouldBe(expected);
    }

    [Theory]
    [InlineData("Left", "Left")]
    [InlineData("Center", "Center")]
    [InlineData("Right", "Right")]
    public void Parse_MapsEveryStyleAlignment(string align, string expected)
    {
        var element = $"""<Textbox Name="e"><rk:Element type="label"/><Top>0in</Top><Left>0in</Left><Height>0.2in</Height><Width>1in</Width><Style><TextAlign>{align}</TextAlign></Style></Textbox>""";

        var def = RdlReader.Parse(WrapBand("detail", element));

        def.Value.Bands[0].Elements[0].Style!.Align!.Value.ToString().ShouldBe(expected);
    }

    [Theory]
    [InlineData("left", "Left")]
    [InlineData("center", "Center")]
    [InlineData("right", "Right")]
    public void Parse_MapsEveryPageNumberPosition(string position, string expected)
    {
        var rdl = $"""
            <?xml version="1.0" encoding="utf-8"?>
            <Report xmlns="{Rdl2016}" xmlns:rk="{RkNs}">
              <rk:Template id="t" name="T" version="1" snapToGrid="true" gridSize="0.125"/>
              <rk:PageNumbers show="true" format="Page" startAt="1" position="{position}"/>
              <Page><PageHeight>11in</PageHeight><PageWidth>8.5in</PageWidth><TopMargin>1in</TopMargin><RightMargin>1in</RightMargin><BottomMargin>1in</BottomMargin><LeftMargin>1in</LeftMargin></Page>
              <Body><ReportItems/></Body>
            </Report>
            """;

        RdlReader.Parse(rdl).Value.PageNumbers.Position.ToString().ShouldBe(expected);
    }
}
