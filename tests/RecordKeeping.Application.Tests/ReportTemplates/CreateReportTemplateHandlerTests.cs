using ErrorOr;
using RecordKeeping.Application.ReportTemplates;
using Shouldly;

namespace RecordKeeping.Application.Tests.ReportTemplates;

public class CreateReportTemplateHandlerTests
{
    private const string Rdl = "<Report><Body/></Report>";

    [Fact]
    public async Task Handle_WithValidValues_PersistsAndReturnsTemplate()
    {
        var repository = new FakeReportTemplateRepository();

        var result = await CreateReportTemplateHandler.Handle(
            new CreateReportTemplateCommand("Annual Emissions", Rdl), repository, CancellationToken.None);

        result.IsError.ShouldBeFalse();
        var response = result.Value;
        response.Id.ShouldNotBe(Guid.Empty);
        response.Name.ShouldBe("Annual Emissions");
        response.Rdl.ShouldBe(Rdl);
        repository.Stored.ShouldContain(t => t.Name == "Annual Emissions");
        repository.SaveChangesCount.ShouldBe(1);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Handle_WithBlankName_ReturnsValidationErrorAndDoesNotPersist(string name)
    {
        var repository = new FakeReportTemplateRepository();

        var result = await CreateReportTemplateHandler.Handle(
            new CreateReportTemplateCommand(name, Rdl), repository, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
        repository.SaveChangesCount.ShouldBe(0);
    }

    [Fact]
    public async Task Handle_WithBlankRdl_ReturnsValidationErrorAndDoesNotPersist()
    {
        var repository = new FakeReportTemplateRepository();

        var result = await CreateReportTemplateHandler.Handle(
            new CreateReportTemplateCommand("Annual Emissions", "   "), repository, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
        repository.SaveChangesCount.ShouldBe(0);
    }
}
