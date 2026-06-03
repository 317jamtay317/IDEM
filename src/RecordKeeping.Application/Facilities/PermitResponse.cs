using RecordKeeping.Domain.Facilities;

namespace RecordKeeping.Application.Facilities;

/// <summary>
/// Read model for a <see cref="Permit"/> held by a Facility.
/// </summary>
/// <param name="Id">The Permit's unique identifier.</param>
/// <param name="ExpirationDate">The date the Permit expires (inclusive).</param>
/// <param name="Value">The permit number / identifier.</param>
public sealed record PermitResponse(Guid Id, DateOnly ExpirationDate, string Value)
{
    /// <summary>Projects a domain <see cref="Permit"/> into a <see cref="PermitResponse"/>.</summary>
    /// <param name="permit">The Permit to project.</param>
    /// <returns>The response read model.</returns>
    public static PermitResponse FromPermit(Permit permit) =>
        new(permit.Id, permit.ExpirationDate, permit.Value);
}
