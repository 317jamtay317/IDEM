using RecordKeeping.Application.ReportTemplates;
using RecordKeeping.Domain.ReportTemplates;

namespace RecordKeeping.Application.Tests.ReportTemplates;

/// <summary>
/// In-memory <see cref="IReportTemplateRepository"/> test double. Tracks save calls so tests can assert
/// persistence was requested.
/// </summary>
internal sealed class FakeReportTemplateRepository : IReportTemplateRepository
{
    private readonly List<ReportTemplate> _templates = [];

    public int SaveChangesCount { get; private set; }

    public IReadOnlyList<ReportTemplate> Stored => _templates;

    public void Seed(ReportTemplate template) => _templates.Add(template);

    public Task AddAsync(ReportTemplate template, CancellationToken cancellationToken)
    {
        _templates.Add(template);
        return Task.CompletedTask;
    }

    public Task<ReportTemplate?> GetByIdAsync(Guid id, CancellationToken cancellationToken) =>
        Task.FromResult(_templates.FirstOrDefault(t => t.Id == id));

    public Task<IReadOnlyList<ReportTemplate>> GetAllAsync(CancellationToken cancellationToken) =>
        Task.FromResult((IReadOnlyList<ReportTemplate>)_templates.ToList());

    public Task RemoveAsync(ReportTemplate template, CancellationToken cancellationToken)
    {
        _templates.RemoveAll(t => t.Id == template.Id);
        return Task.CompletedTask;
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken)
    {
        SaveChangesCount++;
        return Task.CompletedTask;
    }
}
