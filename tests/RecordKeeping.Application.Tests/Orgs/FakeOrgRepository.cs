using RecordKeeping.Application.Orgs;
using RecordKeeping.Domain.Orgs;

namespace RecordKeeping.Application.Tests.Orgs;

/// <summary>
/// In-memory <see cref="IOrgRepository"/> test double. Tracks save calls so tests
/// can assert persistence was requested.
/// </summary>
internal sealed class FakeOrgRepository : IOrgRepository
{
    private readonly List<Org> _orgs = [];

    public int SaveChangesCount { get; private set; }

    public IReadOnlyList<Org> Stored => _orgs;

    public void Seed(Org org) => _orgs.Add(org);

    public Task AddAsync(Org org, CancellationToken cancellationToken)
    {
        _orgs.Add(org);
        return Task.CompletedTask;
    }

    public Task<Org?> GetByIdAsync(Guid id, CancellationToken cancellationToken) =>
        Task.FromResult(_orgs.FirstOrDefault(o => o.Id == id));

    public Task<IReadOnlyList<Org>> GetAllAsync(CancellationToken cancellationToken) =>
        Task.FromResult((IReadOnlyList<Org>)_orgs.ToList());

    public Task RemoveAsync(Org org, CancellationToken cancellationToken)
    {
        _orgs.Remove(org);
        return Task.CompletedTask;
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken)
    {
        SaveChangesCount++;
        return Task.CompletedTask;
    }
}
