using Microsoft.EntityFrameworkCore;
using RecordKeeping.Domain.Orgs;

namespace RecordKeeping.Infrastructure.Persistence;

/// <summary>
/// EF Core DbContext for RecordKeeping domain data. Lives in the default (<c>dbo</c>)
/// schema, separate from the <c>auth</c> schema owned by <c>AuthDbContext</c>.
/// </summary>
public sealed class RecordKeepingDbContext(DbContextOptions<RecordKeepingDbContext> options)
    : DbContext(options)
{
    /// <summary>The Org aggregate roots.</summary>
    public DbSet<Org> Orgs => Set<Org>();

    /// <inheritdoc />
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfiguration(new OrgConfiguration());
    }
}
