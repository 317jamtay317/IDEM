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

        // Permits are part of the Facility aggregate: stored in their own table, loaded with the
        // Facility, and exposed read-only through the _permits backing field.
        builder.OwnsMany(f => f.Permits, permit =>
        {
            permit.ToTable("Permits");
            permit.WithOwner().HasForeignKey(nameof(Permit.FacilityId));
            permit.HasKey(p => p.Id);
            permit.Property(p => p.Id).ValueGeneratedNever();
            permit.Property(p => p.ExpirationDate).IsRequired();
            permit.Property(p => p.Value).IsRequired();
        });

        // Monthly Limits are part of the Facility aggregate: stored in their own table, loaded with
        // the Facility, and exposed read-only through the _limits backing field. MonthlyLimit is a
        // keyless value object, so EF owns it with an implicit shadow surrogate key. "Editing" a
        // limit replaces the value object (I-D19 keeps it unique per Emission Type), which EF then
        // persists as a clean delete+insert rather than a natural-key update.
        builder.OwnsMany(f => f.Limits, limit =>
        {
            limit.ToTable("MonthlyLimits");
            limit.WithOwner().HasForeignKey(nameof(MonthlyLimit.FacilityId));
            // Store the Emission Type by name so the table is self-describing (e.g. "VOC").
            limit.Property(l => l.EmissionType)
                .HasConversion<string>()
                .IsRequired();
            limit.Property(l => l.Value).IsRequired();
        });

        // Org has no navigation back to its Facilities (separate aggregates). Deleting an Org
        // cascades to its Facilities, preserving the previous owned-collection behavior.
        builder.HasOne<Org>()
            .WithMany()
            .HasForeignKey(f => f.OrgId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
