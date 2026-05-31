using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RecordKeeping.Domain.Orgs;

namespace RecordKeeping.Infrastructure.Persistence;

/// <summary>
/// EF Core mapping for the <see cref="Org"/> aggregate and its owned
/// <see cref="Facility"/> children (I-D06).
/// </summary>
internal sealed class OrgConfiguration : IEntityTypeConfiguration<Org>
{
    public void Configure(EntityTypeBuilder<Org> builder)
    {
        builder.ToTable("Orgs");

        builder.HasKey(o => o.Id);
        builder.Property(o => o.Id).ValueGeneratedNever();

        builder.Property(o => o.Name)
            .IsRequired()
            .HasMaxLength(Org.MaxNameLength);

        builder.Property(o => o.TenantId);

        // Facilities are owned by the Org aggregate (I-D06). The collection is
        // exposed read-only over a private backing field, so EF must use field access.
        builder.OwnsMany(o => o.Facilities, facilities =>
        {
            facilities.ToTable("Facilities");
            facilities.WithOwner().HasForeignKey(f => f.OrgId);
            facilities.HasKey(f => f.Id);
            facilities.Property(f => f.Id).ValueGeneratedNever();
            facilities.Property(f => f.Name)
                .IsRequired()
                .HasMaxLength(Org.MaxNameLength);
        });

        builder.Navigation(o => o.Facilities)
            .UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}
