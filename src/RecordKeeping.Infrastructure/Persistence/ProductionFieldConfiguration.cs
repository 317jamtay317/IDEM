using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RecordKeeping.Domain.ProductionFields;

namespace RecordKeeping.Infrastructure.Persistence;

/// <summary>
/// EF Core mapping for the <see cref="ProductionField"/> catalog aggregate. The catalog is
/// platform-global (it carries no OrgId).
/// </summary>
internal sealed class ProductionFieldConfiguration : IEntityTypeConfiguration<ProductionField>
{
    public void Configure(EntityTypeBuilder<ProductionField> builder)
    {
        builder.ToTable("ProductionFields");

        builder.HasKey(field => field.Id);
        builder.Property(field => field.Id).ValueGeneratedNever();

        // Domain events are an in-memory dispatch channel on the aggregate root, not state.
        builder.Ignore(field => field.DomainEvents);

        builder.Property(field => field.PropertyName)
            .IsRequired()
            .HasMaxLength(ProductionField.MaxPropertyNameLength);

        // I-D21: PropertyName is the unique key across the whole catalog.
        builder.HasIndex(field => field.PropertyName).IsUnique();

        builder.Property(field => field.FriendlyName)
            .IsRequired()
            .HasMaxLength(ProductionField.MaxFriendlyNameLength);

        // I-D22: FriendlyName is unique among active fields (a filtered unique index, so retired
        // fields may reuse a label).
        builder.HasIndex(field => field.FriendlyName)
            .IsUnique()
            .HasFilter("[IsActive] = 1");

        builder.Property(field => field.DataType)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(20);

        // Description and Category are unbounded free text the SiteAdmin controls; left as nvarchar(max)
        // so a long entry cannot throw at SaveChanges (business validation, if any, lives in the domain).
        builder.Property(field => field.Description);
        builder.Property(field => field.Category);
        builder.Property(field => field.IsSummary).IsRequired();
        builder.Property(field => field.DisplayOrder).IsRequired();
        builder.Property(field => field.IsActive).IsRequired();
    }
}
