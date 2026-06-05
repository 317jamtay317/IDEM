using System.Security.Claims;

namespace RecordKeeping.Api.Endpoints;

/// <summary>
/// Claim helpers for resolving the signed-in caller's identity on API endpoints.
/// </summary>
public static class ClaimsPrincipalExtensions
{
    /// <summary>
    /// The access-token claim carrying the caller's Org id. Present only for Org Users; a
    /// SiteAdmin has no Org (I-D13), so the claim is absent for them. Emitted at
    /// <c>/connect/authorize</c>.
    /// </summary>
    public const string OrgIdClaimType = "org_id";

    /// <summary>
    /// The access-token claim flagging whether the caller is a SiteAdmin (platform operator). Emitted
    /// at <c>/connect/authorize</c> as the string <c>"true"</c> or <c>"false"</c>.
    /// </summary>
    public const string SiteAdminClaimType = "is_site_admin";

    /// <summary>
    /// Whether the caller is a SiteAdmin (platform operator, I-D13). SiteAdmins author platform
    /// resources such as Report Templates and the Production Field catalog; Org Users are not
    /// SiteAdmins. Used by the <c>SiteAdmin</c> authorization policy.
    /// </summary>
    /// <param name="principal">The authenticated caller.</param>
    /// <returns><c>true</c> when the caller's <c>is_site_admin</c> claim is <c>"true"</c>.</returns>
    public static bool IsSiteAdmin(this ClaimsPrincipal principal) =>
        principal.FindFirst(SiteAdminClaimType)?.Value == "true";

    /// <summary>
    /// Reads the caller's Org id from the <c>org_id</c> claim.
    /// </summary>
    /// <param name="principal">The authenticated caller.</param>
    /// <returns>
    /// The caller's Org id, or <c>null</c> when the claim is absent or unparsable — for example a
    /// SiteAdmin, who has no Org (I-D13). Endpoints scoped to "my Org" use this to enforce Org
    /// isolation (I-D03): the Org is taken from the token, never from client input.
    /// </returns>
    public static Guid? GetOrgId(this ClaimsPrincipal principal)
    {
        var value = principal.FindFirst(OrgIdClaimType)?.Value;
        return Guid.TryParse(value, out var orgId) ? orgId : null;
    }
}
