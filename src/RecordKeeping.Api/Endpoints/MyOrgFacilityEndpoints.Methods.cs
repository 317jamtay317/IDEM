using System.Security.Claims;
using RecordKeeping.Application.Orgs;

namespace RecordKeeping.Api.Endpoints;

public partial class MyOrgFacilityEndpoints
{
    /// <summary>Request body for adding or renaming a Facility.</summary>
    /// <param name="Name">The Facility's name.</param>
    public sealed record FacilityRequest(string Name);

    private static async Task<IResult> GetMyFacilities(
        ClaimsPrincipal user, IFacilityRepository facilities, CancellationToken cancellationToken)
    {
        if (user.GetOrgId() is not Guid orgId)
        {
            return NoOrg();
        }

        var result = await GetFacilitiesHandler.Handle(
            new GetFacilitiesQuery(orgId), facilities, cancellationToken);
        return result.Match(Results.Ok);
    }

    private static async Task<IResult> AddMyFacility(
        FacilityRequest request,
        ClaimsPrincipal user,
        IOrgRepository orgs,
        IFacilityRepository facilities,
        CancellationToken cancellationToken)
    {
        if (user.GetOrgId() is not Guid orgId)
        {
            return NoOrg();
        }

        var result = await AddFacilityHandler.Handle(
            new AddFacilityCommand(orgId, request.Name), orgs, facilities, cancellationToken);
        return result.Match(facility =>
            Results.Created($"/me/org/facilities/{facility.Id}", facility));
    }

    private static async Task<IResult> RenameMyFacility(
        Guid facilityId,
        FacilityRequest request,
        ClaimsPrincipal user,
        IFacilityRepository facilities,
        CancellationToken cancellationToken)
    {
        if (user.GetOrgId() is not Guid orgId)
        {
            return NoOrg();
        }

        var result = await RenameFacilityHandler.Handle(
            new RenameFacilityCommand(orgId, facilityId, request.Name), facilities, cancellationToken);
        return result.Match(Results.Ok);
    }

    private static async Task<IResult> RemoveMyFacility(
        Guid facilityId,
        ClaimsPrincipal user,
        IFacilityRepository facilities,
        CancellationToken cancellationToken)
    {
        if (user.GetOrgId() is not Guid orgId)
        {
            return NoOrg();
        }

        var result = await RemoveFacilityHandler.Handle(
            new RemoveFacilityCommand(orgId, facilityId), facilities, cancellationToken);
        return result.Match(_ => Results.NoContent());
    }

    // I-D13: a SiteAdmin has no Org, so the "my Org" facility routes do not apply to them.
    // I-D03 by construction: the Org id comes only from the caller's token, never from input.
    private static IResult NoOrg() => Results.Problem(
        statusCode: StatusCodes.Status403Forbidden,
        title: "Org.Required",
        detail: "This operation requires an Org User; the caller has no Org.");
}
