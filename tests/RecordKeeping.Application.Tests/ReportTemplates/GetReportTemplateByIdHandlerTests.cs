using ErrorOr;
using RecordKeeping.Application.ReportTemplates;
using RecordKeeping.Domain.ReportTemplates;
using Shouldly;

namespace RecordKeeping.Application.Tests.ReportTemplates;

public class GetReportTemplateByIdHandlerTests
{
    private const string Rdl = "<Report><Body/></Report>";
    private static readonly DateTime Now = new(2026, 6, 5, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task Handle_WithExistingId_ReturnsTemplateWithRdl()
    {
        var repository = new FakeReportTemplateRepository();
        var template = ReportTemplate.Create("Annual Emissions", Rdl, Now).Value;
        repository.Seed(template);

        var result = await GetReportTemplateByIdHandler.Handle(
            new GetReportTemplateByIdQuery(template.Id), repository, CancellationToken.None);

        result.IsError.ShouldBeFalse();
        result.Value.Id.ShouldBe(template.Id);
        result.Value.Rdl.ShouldBe(Rdl);
    }

    [Fact]
    public async Task Handle_WithUnknownId_ReturnsNotFound()
    {
        var repository = new FakeReportTemplateRepository();

        var result = await GetReportTemplateByIdHandler.Handle(
            new GetReportTemplateByIdQuery(Guid.NewGuid()), repository, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.NotFound);
    }
}
