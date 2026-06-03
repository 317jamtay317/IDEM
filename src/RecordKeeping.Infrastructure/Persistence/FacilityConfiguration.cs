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

        // Licenses are part of the Facility aggregate: stored in their own table, loaded with the
        // Facility, and exposed read-only through the _licenses backing field.
        builder.OwnsMany(f => f.Licenses, license =>
        {
            license.ToTable("Licenses");
            license.WithOwner().HasForeignKey(nameof(License.FacilityId));
            license.HasKey(l => l.Id);
            license.Property(l => l.Id).ValueGeneratedNever();
            license.Property(l => l.ExpirationDate).IsRequired();
            license.Property(l => l.Value).IsRequired();
        });

        // Not yet persisted: no surface populates monthly limits and MonthlyLimit is a keyless value
        // object. Ignore it so the model stays valid until limits get their own mapping.
        builder.Ignore(f => f.Limits);

        // Org has no navigation back to its Facilities (separate aggregates). Deleting an Org
        // cascades to its Facilities, preserving the previous owned-collection behavior.
        builder.HasOne<Org>()
            .WithMany()
            .HasForeignKey(f => f.OrgId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
