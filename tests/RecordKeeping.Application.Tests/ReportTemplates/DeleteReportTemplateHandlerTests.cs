using ErrorOr;
using RecordKeeping.Application.ReportTemplates;
using RecordKeeping.Domain.ReportTemplates;
using Shouldly;

namespace RecordKeeping.Application.Tests.ReportTemplates;

public class DeleteReportTemplateHandlerTests
{
    private const string Rdl = "<Report><Body/></Report>";
    private static readonly DateTime Now = new(2026, 6, 5, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task Handle_WithExistingId_RemovesAndReturnsDeleted()
    {
        var repository = new FakeReportTemplateRepository();
        var template = ReportTemplate.Create("Annual Emissions", Rdl, Now).Value;
        repository.Seed(template);

        var result = await DeleteReportTemplateHandler.Handle(
            new DeleteReportTemplateCommand(template.Id), repository, CancellationToken.None);

        result.IsError.ShouldBeFalse();
        repository.Stored.ShouldNotContain(t => t.Id == template.Id);
        repository.SaveChangesCount.ShouldBe(1);
    }

    [Fact]
    public async Task Handle_WithUnknownId_ReturnsNotFoundAndDoesNotPersist()
    {
        var repository = new FakeReportTemplateRepository();

        var result = await DeleteReportTemplateHandler.Handle(
            new DeleteReportTemplateCommand(Guid.NewGuid()), repository, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.NotFound);
        repository.SaveChangesCount.ShouldBe(0);
    }
}
