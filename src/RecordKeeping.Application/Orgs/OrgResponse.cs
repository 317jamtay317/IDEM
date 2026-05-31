using RecordKeeping.Domain.Orgs;

namespace RecordKeeping.Application.Orgs;

/// <summary>
/// Read model returned to API callers for an <see cref="Org"/>.
/// </summary>
/// <param name="Id">The Org's unique identifier.</param>
/// <param name="Name">The Org's display name.</param>
/// <param name="TenantId">The Entra ID directory GUID, or <c>null</c> when SSO is not configured (I-D12).</param>
/// <param name="Facilities">The Facilities operated by the Org (I-D06).</param>
public sealed record OrgResponse(
    Guid Id,
    string Name,
    Guid? TenantId,
    IReadOnlyList<FacilityResponse> Facilities)
{
    /// <summary>Projects a domain <see cref="Org"/> into an <see cref="OrgResponse"/>.</summary>
    /// <param name="org">The Org to project.</param>
    /// <returns>The response read model.</returns>
    public static OrgResponse FromOrg(Org org) => new(
        org.Id,
        org.Name,
        org.TenantId,
        org.Facilities.Select(FacilityResponse.FromFacility).ToList());
}

/// <summary>
/// Read model for a <see cref="Facility"/> owned by an Org.
/// </summary>
/// <param name="Id">The Facility's unique identifier.</param>
/// <param name="Name">The Facility's name.</param>
public sealed record FacilityResponse(Guid Id, string Name)
{
    /// <summary>Projects a domain <see cref="Facility"/> into a <see cref="FacilityResponse"/>.</summary>
    /// <param name="facility">The Facility to project.</param>
    /// <returns>The response read model.</returns>
    public static FacilityResponse FromFacility(Facility facility) =>
        new(facility.Id, facility.Name);
}
