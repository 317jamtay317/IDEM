using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace RecordKeeping.Infrastructure.Identity;

/// <summary>
/// EF Core DbContext for ASP.NET Core Identity and OpenIddict storage.
/// All tables live under the <c>auth</c> SQL schema per Architecture.md §Auth.
/// </summary>
public sealed class AuthDbContext(DbContextOptions<AuthDbContext> options)
    : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>(options)
{
    /// <inheritdoc />
    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // Architecture.md §Auth: Identity + OpenIddict live in `auth`, separated
        // from domain tables to make the boundary visually obvious in the DB.
        builder.HasDefaultSchema("auth");

        // Registers OpenIddict's Application / Authorization / Scope / Token
        // entities on this DbContext so the EF-backed store can read/write them.
        builder.UseOpenIddict();
    }
}
