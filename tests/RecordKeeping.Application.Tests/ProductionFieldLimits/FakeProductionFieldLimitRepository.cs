using RecordKeeping.Application.ProductionFieldLimits;
using RecordKeeping.Domain.ProductionFieldLimits;

namespace RecordKeeping.Application.Tests.ProductionFieldLimits;

/// <summary>
/// In-memory <see cref="IProductionFieldLimitRepository"/> test double. Reads are Org-scoped exactly
/// as the real repository is (I-D03), and lookups by property are case-insensitive to match the SQL
/// store. Tracks save calls so tests can assert persistence was requested.
/// </summary>
internal sealed class FakeProductionFieldLimitRepository : IProductionFieldLimitRepository
{
    private readonly List<ProductionFieldLimit> _limits = [];

    public int SaveChangesCount { get; private set; }

    public IReadOnlyList<ProductionFieldLimit> Stored => _limits;

    public void Seed(ProductionFieldLimit limit) => _limits.Add(limit);

    public Task AddAsync(ProductionFieldLimit limit, CancellationToken cancellationToken)
    {
        _limits.Add(limit);
        return Task.CompletedTask;
    }

    public Task<ProductionFieldLimit?> GetByPropertyAsync(
        Guid orgId, string propertyName, CancellationToken cancellationToken) =>
        Task.FromResult(_limits.FirstOrDefault(l =>
            l.OrgId == orgId &&
            string.Equals(l.PropertyName, propertyName, StringComparison.OrdinalIgnoreCase)));

    public Task<IReadOnlyList<ProductionFieldLimit>> GetByOrgAsync(
        Guid orgId, CancellationToken cancellationToken)
    {
        IReadOnlyList<ProductionFieldLimit> result = _limits.Where(l => l.OrgId == orgId).ToList();
        return Task.FromResult(result);
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken)
    {
        SaveChangesCount++;
        return Task.CompletedTask;
    }
}
