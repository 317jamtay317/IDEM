using RecordKeeping.Application.ProductionFields;
using RecordKeeping.Domain.ProductionFields;

namespace RecordKeeping.Application.Tests.ProductionFields;

/// <summary>
/// In-memory <see cref="IProductionFieldRepository"/> test double. Tracks save calls so tests can
/// assert persistence was requested, and matches the case-insensitive uniqueness semantics of the
/// real (SQL Server) store.
/// </summary>
internal sealed class FakeProductionFieldRepository : IProductionFieldRepository
{
    private readonly List<ProductionField> _fields = [];

    public int SaveChangesCount { get; private set; }

    public IReadOnlyList<ProductionField> Stored => _fields;

    public void Seed(ProductionField field) => _fields.Add(field);

    public Task AddAsync(ProductionField field, CancellationToken cancellationToken)
    {
        _fields.Add(field);
        return Task.CompletedTask;
    }

    public Task<ProductionField?> GetByIdAsync(Guid id, CancellationToken cancellationToken) =>
        Task.FromResult(_fields.FirstOrDefault(f => f.Id == id));

    public Task<ProductionField?> GetByPropertyNameAsync(string propertyName, CancellationToken cancellationToken) =>
        Task.FromResult(_fields.FirstOrDefault(f =>
            string.Equals(f.PropertyName, propertyName, StringComparison.OrdinalIgnoreCase)));

    public Task<ProductionField?> GetActiveByFriendlyNameAsync(string friendlyName, CancellationToken cancellationToken) =>
        Task.FromResult(_fields.FirstOrDefault(f =>
            f.IsActive && string.Equals(f.FriendlyName, friendlyName, StringComparison.OrdinalIgnoreCase)));

    public Task<IReadOnlyList<ProductionField>> GetAllAsync(CancellationToken cancellationToken) =>
        Task.FromResult((IReadOnlyList<ProductionField>)_fields.ToList());

    public Task SaveChangesAsync(CancellationToken cancellationToken)
    {
        SaveChangesCount++;
        return Task.CompletedTask;
    }
}
