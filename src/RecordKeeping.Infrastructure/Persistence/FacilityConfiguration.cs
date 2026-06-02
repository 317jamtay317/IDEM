using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RecordKeeping.Domain.Facilities;
using RecordKeeping.Domain.Orgs;

namespace RecordKeeping.Infrastructure.Persistence;

/// <summary>
/// EF Core mapping for the <see cref="Facility"/> aggregate (I-D06). Facility is its own
/// aggregate root, referencing its owning <see cref="Org"/> by <c>OrgId</c>.
/// </summary>
internal sealed class FacilityConfiguration : IEntityTypeConfiguration<Facility>
{
    public void Configure(EntityTypeBuilder<Facility> builder)
    {
        builder.ToTable("Facilities");

        builder.HasKey(f => f.Id);
        builder.Property(f => f.Id).ValueGeneratedNever();

        // Domain events are an in-memory dispatch channel on the aggregate root, not state.
        builder.Ignore(f => f.DomainEvents);

        // I-D06: every Facility belongs to exactly one Org; the FK is required and indexed.
        builder.Property(f => f.OrgId).IsRequired();
        builder.HasIndex(f => f.OrgId);

        builder.Property(f => f.Name)
            .IsRequired()
            .HasMaxLength(Facility.MaxNameLength);

        // Org has no navigation back to its Facilities (separate aggregates). Deleting an Org
        // cascades to its Facilities, preserving the previous owned-collection behavior.
        builder.HasOne<Org>()
            .WithMany()
            .HasForeignKey(f => f.OrgId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
