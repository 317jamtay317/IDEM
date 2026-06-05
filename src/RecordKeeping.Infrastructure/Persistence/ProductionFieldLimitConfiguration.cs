using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RecordKeeping.Domain.ProductionFieldLimits;
using RecordKeeping.Domain.ProductionFields;

namespace RecordKeeping.Infrastructure.Persistence;

/// <summary>
/// EF Core mapping for the <see cref="ProductionFieldLimit"/> aggregate. Org-scoped (I-D03): an Org
/// holds at most one limit per Production Field, enforced by a unique index on
/// (<c>OrgId</c>, <c>PropertyName</c>) (I-D24).
/// </summary>
internal sealed class ProductionFieldLimitConfiguration : IEntityTypeConfiguration<ProductionFieldLimit>
{
    public void Configure(EntityTypeBuilder<ProductionFieldLimit> builder)
    {
        builder.ToTable("ProductionFieldLimits");

        builder.HasKey(limit => limit.Id);
        builder.Property(limit => limit.Id).ValueGeneratedNever();

        // Domain events are an in-memory dispatch channel on the aggregate root, not state.
        builder.Ignore(limit => limit.DomainEvents);

        // I-D03: every limit belongs to exactly one Org; Org-scoped reads filter on it.
        builder.Property(limit => limit.OrgId).IsRequired();

        builder.Property(limit => limit.PropertyName)
            .IsRequired()
            .HasMaxLength(ProductionField.MaxPropertyNameLength);

        // I-D24: at most one limit per Org per Production Field.
        builder.HasIndex(limit => new { limit.OrgId, limit.PropertyName }).IsUnique();

        builder.Property(limit => limit.LowLimit).HasColumnType("decimal(18,6)");
        builder.Property(limit => limit.HighLimit).HasColumnType("decimal(18,6)");

        builder.Property(limit => limit.Unit)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(20);
    }
}
