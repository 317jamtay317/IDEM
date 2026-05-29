using ErrorOr;

namespace RecordKeeping.Domain.Users;

/// <summary>
/// A person who authenticates against RecordKeeping. Per I-D13, exactly one of two:
/// a <b>SiteAdmin</b> (platform operator, no <see cref="OrgId"/>) or an
/// <b>Org User</b> (belongs to exactly one Org via <see cref="OrgId"/>).
/// </summary>
public sealed class User
{
    /// <summary>Unique identifier.</summary>
    public Guid Id { get; }

    /// <summary>The User's email address — the canonical identifier for authentication.</summary>
    public Email Email { get; }

    /// <summary>Human-readable display name.</summary>
    public string DisplayName { get; }

    /// <summary>True when this User administers the platform (no <see cref="OrgId"/>); false when this User belongs to an Org.</summary>
    public bool IsSiteAdmin { get; }

    /// <summary>The Org this User belongs to. Null for SiteAdmins (I-D13).</summary>
    public Guid? OrgId { get; }

    private User(Guid id, Email email, string displayName, bool isSiteAdmin, Guid? orgId)
    {
        Id = id;
        Email = email;
        DisplayName = displayName;
        IsSiteAdmin = isSiteAdmin;
        OrgId = orgId;
    }

    /// <summary>
    /// Creates a new SiteAdmin User. SiteAdmins administer the platform and have
    /// no Org affiliation (I-D13).
    /// </summary>
    /// <param name="email">The SiteAdmin's email address.</param>
    /// <param name="displayName">A non-empty human-readable name.</param>
    /// <returns>The new SiteAdmin, or a validation error.</returns>
    public static ErrorOr<User> CreateSiteAdmin(Email email, string displayName)
    {
        if (string.IsNullOrWhiteSpace(displayName))
        {
            return Error.Validation("User.DisplayName.Empty", "Display name cannot be empty.");
        }

        // I-D13: SiteAdmin has no OrgId.
        return new User(Guid.NewGuid(), email, displayName, isSiteAdmin: true, orgId: null);
    }

    /// <summary>
    /// Creates a new Org User belonging to the specified <paramref name="orgId"/> (I-D13).
    /// </summary>
    /// <param name="email">The User's email address.</param>
    /// <param name="displayName">A non-empty human-readable name.</param>
    /// <param name="orgId">The Org this User belongs to; must be non-empty.</param>
    /// <returns>The new Org User, or a validation error.</returns>
    public static ErrorOr<User> CreateOrgUser(Email email, string displayName, Guid orgId)
    {
        if (string.IsNullOrWhiteSpace(displayName))
        {
            return Error.Validation("User.DisplayName.Empty", "Display name cannot be empty.");
        }

        if (orgId == Guid.Empty)
        {
            return Error.Validation("User.OrgId.Empty", "OrgId is required for an Org User.");
        }

        // I-D13: Org User has IsSiteAdmin = false.
        return new User(Guid.NewGuid(), email, displayName, isSiteAdmin: false, orgId: orgId);
    }
}
