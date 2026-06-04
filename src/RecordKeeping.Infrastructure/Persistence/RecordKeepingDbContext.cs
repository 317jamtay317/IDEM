using Microsoft.EntityFrameworkCore;
using RecordKeeping.Domain.Facilities;
using RecordKeeping.Domain.Orgs;
using RecordKeeping.Domain.ProductionFields;
using RecordKeeping.Domain.Records;

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

    /// <summary>The Facility aggregate roots (I-D06).</summary>
    public DbSet<Facility> Facilities => Set<Facility>();

    /// <summary>The platform-global Production Field catalog (not Org-scoped).</summary>
    public DbSet<ProductionField> ProductionFields => Set<ProductionField>();

    /// <summary>The Record aggregate roots — daily Facility activity entries (I-D01, I-D07, I-D23).</summary>
    public DbSet<Record> Records => Set<Record>();

    /// <inheritdoc />
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfiguration(new OrgConfiguration());
        modelBuilder.ApplyConfiguration(new FacilityConfiguration());
        modelBuilder.ApplyConfiguration(new ProductionFieldConfiguration());
        modelBuilder.ApplyConfiguration(new RecordConfiguration());
    }
}
