using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RecordKeeping.Domain.ReportTemplates;

namespace RecordKeeping.Infrastructure.Persistence;

/// <summary>
/// EF Core mapping for the <see cref="ReportTemplate"/> aggregate. Report Templates are platform-global
/// (they carry no OrgId). EF binds the private constructor by parameter name when materializing rows.
/// </summary>
internal sealed class ReportTemplateConfiguration : IEntityTypeConfiguration<ReportTemplate>
{
    public void Configure(EntityTypeBuilder<ReportTemplate> builder)
    {
        builder.ToTable("ReportTemplates");

        builder.HasKey(template => template.Id);
        builder.Property(template => template.Id).ValueGeneratedNever();

        // Domain events are an in-memory dispatch channel on the aggregate root, not state.
        builder.Ignore(template => template.DomainEvents);

        builder.Property(template => template.Name)
            .IsRequired()
            .HasMaxLength(ReportTemplate.MaxNameLength);

        // The RDL is the serialized template document; it can be large, so leave it as nvarchar(max).
        builder.Property(template => template.Rdl).IsRequired();

        builder.Property(template => template.CreatedAtUtc).IsRequired();
        builder.Property(template => template.UpdatedAtUtc).IsRequired();
    }
}
