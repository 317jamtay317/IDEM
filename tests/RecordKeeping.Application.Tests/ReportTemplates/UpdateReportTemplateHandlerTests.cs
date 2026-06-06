using ErrorOr;
using RecordKeeping.Application.ReportTemplates;
using RecordKeeping.Domain.ReportTemplates;
using Shouldly;

namespace RecordKeeping.Application.Tests.ReportTemplates;

public class UpdateReportTemplateHandlerTests
{
    private const string Rdl = "<Report><Body/></Report>";
    private static readonly DateTime Now = new(2026, 6, 5, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task Handle_WithExistingId_UpdatesAndReturnsTemplate()
    {
        var repository = new FakeReportTemplateRepository();
        var template = ReportTemplate.Create("Annual Emissions", Rdl, Now).Value;
        repository.Seed(template);

        var result = await UpdateReportTemplateHandler.Handle(
            new UpdateReportTemplateCommand(template.Id, "Quarterly Emissions", "<Report><Page/></Report>"),
            repository,
            CancellationToken.None);

        result.IsError.ShouldBeFalse();
        result.Value.Name.ShouldBe("Quarterly Emissions");
        result.Value.Rdl.ShouldBe("<Report><Page/></Report>");
        repository.SaveChangesCount.ShouldBe(1);
    }

    [Fact]
    public async Task Handle_WithUnknownId_ReturnsNotFoundAndDoesNotPersist()
    {
        var repository = new FakeReportTemplateRepository();

        var result = await UpdateReportTemplateHandler.Handle(
            new UpdateReportTemplateCommand(Guid.NewGuid(), "Quarterly Emissions", Rdl),
            repository,
            CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.NotFound);
        repository.SaveChangesCount.ShouldBe(0);
    }

    [Fact]
    public async Task Handle_WithBlankName_ReturnsValidationErrorAndDoesNotPersist()
    {
        var repository = new FakeReportTemplateRepository();
        var template = ReportTemplate.Create("Annual Emissions", Rdl, Now).Value;
        repository.Seed(template);

        var result = await UpdateReportTemplateHandler.Handle(
            new UpdateReportTemplateCommand(template.Id, "   ", Rdl), repository, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
        repository.SaveChangesCount.ShouldBe(0);
    }
}
