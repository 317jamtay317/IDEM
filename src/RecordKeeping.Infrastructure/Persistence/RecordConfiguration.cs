using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RecordKeeping.Domain.Facilities;
using RecordKeeping.Domain.Records;

namespace RecordKeeping.Infrastructure.Persistence;

/// <summary>
/// EF Core mapping for the <see cref="Record"/> aggregate. A Record is its own aggregate root that
/// references its Org by <c>OrgId</c> (I-D01) and its Facility by <c>FacilityId</c> (I-D07), and holds
/// its field values sparsely in an owned <c>RecordValues</c> table.
/// </summary>
internal sealed class RecordConfiguration : IEntityTypeConfiguration<Record>
{
    public void Configure(EntityTypeBuilder<Record> builder)
    {
        builder.ToTable("Records");

        builder.HasKey(record => record.Id);
        builder.Property(record => record.Id).ValueGeneratedNever();

        // Domain events are an in-memory dispatch channel on the aggregate root, not state.
        builder.Ignore(record => record.DomainEvents);

        // I-D01: every Record belongs to exactly one Org. Stored directly (not via a second FK to Org)
        // so Org-scoped reads filter on it cheaply (I-D03); referential integrity to the Org flows
        // through the Facility FK below, avoiding multiple cascade paths.
        builder.Property(record => record.OrgId).IsRequired();
        builder.HasIndex(record => record.OrgId);

        // I-D07: every Record is associated with a Facility.
        builder.Property(record => record.FacilityId).IsRequired();

        builder.Property(record => record.Date).IsRequired();

        // I-D23: at most one Record per Facility per date.
        builder.HasIndex(record => new { record.FacilityId, record.Date }).IsUnique();

        // Field values are part of the Record aggregate: stored in their own table, loaded with the
        // Record, and exposed read-only through the _values backing field. Keyed by (Record, field) so
        // a field can appear at most once per Record at the database level too.
        builder.OwnsMany(record => record.Values, value =>
        {
            value.ToTable("RecordValues");
            value.WithOwner().HasForeignKey("RecordId");
            value.HasKey("RecordId", nameof(RecordValue.PropertyName));
            value.Property(recordValue => recordValue.PropertyName)
                .IsRequired()
                .HasMaxLength(RecordValue.MaxPropertyNameLength);
            value.Property(recordValue => recordValue.NumericValue).HasColumnType("decimal(18,6)");
            value.Property(recordValue => recordValue.BooleanValue);
            value.Property(recordValue => recordValue.DateValue);
        });

        // Deleting a Facility cascades to its Records (and on to their values). Facility itself cascades
        // from its Org, so an Org delete reaches Records through this single chain.
        builder.HasOne<Facility>()
            .WithMany()
            .HasForeignKey(record => record.FacilityId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
