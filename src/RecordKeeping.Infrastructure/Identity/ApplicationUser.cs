using Microsoft.AspNetCore.Identity;

namespace RecordKeeping.Infrastructure.Identity;

/// <summary>
/// ASP.NET Core Identity storage entity. Persists auth state (password hash,
/// security stamp, MFA setup, lockout, etc.) plus the minimum business shape
/// needed to materialize a <c>RecordKeeping.Domain.Users.User</c> on read.
/// </summary>
/// <remarks>
/// One row per User. The Domain aggregate is reconstructed from this row by
/// the user repository (forthcoming). The duplication of <see cref="IsSiteAdmin"/>
/// and <see cref="OrgId"/> here is deliberate: claims and authorization filters
/// need them without taking a Domain dependency.
/// </remarks>
public sealed class ApplicationUser : IdentityUser<Guid>
{
    /// <summary>True when this User is a platform SiteAdmin (I-D13).</summary>
    public bool IsSiteAdmin { get; set; }

    /// <summary>The Org this User belongs to. Null for SiteAdmins (I-D13).</summary>
    public Guid? OrgId { get; set; }

    /// <summary>Human-readable display name shown in the UI.</summary>
    public string DisplayName { get; set; } = string.Empty;
}
