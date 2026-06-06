using ErrorOr;
using RecordKeeping.Domain.ReportTemplates;
using Shouldly;

namespace RecordKeeping.Domain.Tests.ReportTemplates;

/// <summary>
/// Unit tests for the <see cref="ReportTemplate"/> aggregate: the SiteAdmin-authored, platform-global
/// report definition (Name + RDL) persisted so the Report Builder can list and re-edit it.
/// </summary>
public class ReportTemplateTests
{
    private const string Rdl = "<Report><Body/></Report>";
    private static readonly DateTime Now = new(2026, 6, 5, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void Create_WithValidValues_ReturnsTemplate()
    {
        var result = ReportTemplate.Create("Annual Emissions", Rdl, Now);

        result.IsError.ShouldBeFalse();
        var template = result.Value;
        template.Id.ShouldNotBe(Guid.Empty);
        template.Name.ShouldBe("Annual Emissions");
        template.Rdl.ShouldBe(Rdl);
        template.CreatedAtUtc.ShouldBe(Now);
        template.UpdatedAtUtc.ShouldBe(Now);
    }

    [Fact]
    public void Create_TrimsTheName()
    {
        var result = ReportTemplate.Create("  Annual Emissions  ", Rdl, Now);

        result.Value.Name.ShouldBe("Annual Emissions");
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_WithBlankName_ReturnsValidationError(string name)
    {
        var result = ReportTemplate.Create(name, Rdl, Now);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
    }

    [Fact]
    public void Create_WithNameTooLong_ReturnsValidationError()
    {
        var result = ReportTemplate.Create(new string('x', ReportTemplate.MaxNameLength + 1), Rdl, Now);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_WithBlankRdl_ReturnsValidationError(string rdl)
    {
        var result = ReportTemplate.Create("Annual Emissions", rdl, Now);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
    }

    [Fact]
    public void Update_WithValidValues_ChangesContentAndBumpsUpdatedAt()
    {
        var template = ReportTemplate.Create("Annual Emissions", Rdl, Now).Value;
        var later = Now.AddMinutes(5);

        var result = template.Update("Quarterly Emissions", "<Report><Page/></Report>", later);

        result.IsError.ShouldBeFalse();
        template.Name.ShouldBe("Quarterly Emissions");
        template.Rdl.ShouldBe("<Report><Page/></Report>");
        template.UpdatedAtUtc.ShouldBe(later);
        // CreatedAtUtc is set once at creation and never moves.
        template.CreatedAtUtc.ShouldBe(Now);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Update_WithBlankName_ReturnsValidationError(string name)
    {
        var template = ReportTemplate.Create("Annual Emissions", Rdl, Now).Value;

        var result = template.Update(name, Rdl, Now.AddMinutes(1));

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Update_WithBlankRdl_ReturnsValidationError(string rdl)
    {
        var template = ReportTemplate.Create("Annual Emissions", Rdl, Now).Value;

        var result = template.Update("Annual Emissions", rdl, Now.AddMinutes(1));

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
    }
}
