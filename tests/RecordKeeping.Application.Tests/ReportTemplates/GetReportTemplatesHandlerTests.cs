using RecordKeeping.Application.ReportTemplates;
using RecordKeeping.Domain.ReportTemplates;
using Shouldly;

namespace RecordKeeping.Application.Tests.ReportTemplates;

public class GetReportTemplatesHandlerTests
{
    private const string Rdl = "<Report><Body/></Report>";
    private static readonly DateTime Now = new(2026, 6, 5, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task Handle_ReturnsTemplatesMostRecentlyUpdatedFirst()
    {
        var repository = new FakeReportTemplateRepository();
        var older = ReportTemplate.Create("Older", Rdl, Now).Value;
        var newer = ReportTemplate.Create("Newer", Rdl, Now.AddMinutes(10)).Value;
        // Seed in the "wrong" order to prove the handler sorts rather than relying on insertion order.
        repository.Seed(older);
        repository.Seed(newer);

        var result = await GetReportTemplatesHandler.Handle(repository, CancellationToken.None);

        result.Select(t => t.Name).ShouldBe(["Newer", "Older"]);
    }

    [Fact]
    public async Task Handle_WhenEmpty_ReturnsEmptyList()
    {
        var repository = new FakeReportTemplateRepository();

        var result = await GetReportTemplatesHandler.Handle(repository, CancellationToken.None);

        result.ShouldBeEmpty();
    }
}
