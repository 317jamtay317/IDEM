using Microsoft.EntityFrameworkCore;
using RecordKeeping.Application.ReportTemplates;
using RecordKeeping.Domain.ReportTemplates;

namespace RecordKeeping.Infrastructure.Persistence;

/// <summary>
/// EF Core-backed <see cref="IReportTemplateRepository"/> over <see cref="RecordKeepingDbContext"/>.
/// </summary>
public sealed class ReportTemplateRepository(RecordKeepingDbContext dbContext) : IReportTemplateRepository
{
    /// <inheritdoc />
    public async Task AddAsync(ReportTemplate template, CancellationToken cancellationToken) =>
        await dbContext.ReportTemplates.AddAsync(template, cancellationToken);

    /// <inheritdoc />
    public Task<ReportTemplate?> GetByIdAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.ReportTemplates.FirstOrDefaultAsync(template => template.Id == id, cancellationToken);

    /// <inheritdoc />
    public async Task<IReadOnlyList<ReportTemplate>> GetAllAsync(CancellationToken cancellationToken) =>
        await dbContext.ReportTemplates.ToListAsync(cancellationToken);

    /// <inheritdoc />
    public Task RemoveAsync(ReportTemplate template, CancellationToken cancellationToken)
    {
        dbContext.ReportTemplates.Remove(template);
        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        dbContext.SaveChangesAsync(cancellationToken);
}
