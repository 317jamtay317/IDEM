using System.Security.Claims;
using RecordKeeping.Application.Facilities;
using RecordKeeping.Application.Orgs;
using RecordKeeping.Domain.Facilities;

namespace RecordKeeping.Api.Endpoints;

public partial class MyOrgFacilityEndpoints
{
    /// <summary>Request body for adding or renaming a Facility.</summary>
    /// <param name="Name">The Facility's name.</param>
    public sealed record FacilityRequest(string Name);

    /// <summary>Request body for adding a Permit to a Facility.</summary>
    /// <param name="ExpirationDate">The Permit's expiration date.</param>
    /// <param name="Value">The permit number / identifier.</param>
    public sealed record PermitRequest(DateOnly ExpirationDate, string Value);

    /// <summary>Request body for adding a Monthly Limit to a Facility.</summary>
    /// <param name="EmissionType">The pollutant the limit constrains, e.g. <c>"VOC"</c>.</param>
    /// <param name="Value">The cap, in tons per calendar month.</param>
    public sealed record LimitRequest(string EmissionType, double Value);

    /// <summary>Request body for changing the value of a Facility's Monthly Limit.</summary>
    /// <param name="Value">The new cap, in tons per calendar month.</param>
    public sealed record UpdateLimitRequest(double Value);

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

    private static async Task<IResult> GetMyFacilityPermits(
        Guid facilityId,
        ClaimsPrincipal user,
        IFacilityRepository facilities,
        CancellationToken cancellationToken)
    {
        if (user.GetOrgId() is not Guid orgId)
        {
            return NoOrg();
        }

        var result = await GetPermitsHandler.Handle(
            new GetPermitsQuery(orgId, facilityId), facilities, cancellationToken);
        return result.Match(Results.Ok);
    }

    private static async Task<IResult> AddMyFacilityPermit(
        Guid facilityId,
        PermitRequest request,
        ClaimsPrincipal user,
        IFacilityRepository facilities,
        CancellationToken cancellationToken)
    {
        if (user.GetOrgId() is not Guid orgId)
        {
            return NoOrg();
        }

        var result = await AddPermitHandler.Handle(
            new AddPermitCommand(orgId, facilityId, request.ExpirationDate, request.Value),
            facilities, cancellationToken);
        return result.Match(permit =>
            Results.Created($"/me/org/facilities/{facilityId}/permits/{permit.Id}", permit));
    }

    private static async Task<IResult> RemoveMyFacilityPermit(
        Guid facilityId,
        Guid permitId,
        ClaimsPrincipal user,
        IFacilityRepository facilities,
        CancellationToken cancellationToken)
    {
        if (user.GetOrgId() is not Guid orgId)
        {
            return NoOrg();
        }

        var result = await RemovePermitHandler.Handle(
            new RemovePermitCommand(orgId, facilityId, permitId), facilities, cancellationToken);
        return result.Match(_ => Results.NoContent());
    }

    private static async Task<IResult> GetMyFacilityLimits(
        Guid facilityId,
        ClaimsPrincipal user,
        IFacilityRepository facilities,
        CancellationToken cancellationToken)
    {
        if (user.GetOrgId() is not Guid orgId)
        {
            return NoOrg();
        }

        var result = await GetLimitsHandler.Handle(
            new GetLimitsQuery(orgId, facilityId), facilities, cancellationToken);
        return result.Match(Results.Ok);
    }

    private static async Task<IResult> AddMyFacilityLimit(
        Guid facilityId,
        LimitRequest request,
        ClaimsPrincipal user,
        IFacilityRepository facilities,
        CancellationToken cancellationToken)
    {
        if (user.GetOrgId() is not Guid orgId)
        {
            return NoOrg();
        }

        if (!TryParseEmissionType(request.EmissionType, out var emissionType))
        {
            return UnknownEmissionType(request.EmissionType);
        }

        var result = await AddLimitHandler.Handle(
            new AddLimitCommand(orgId, facilityId, emissionType, request.Value),
            facilities, cancellationToken);
        return result.Match(limit =>
            Results.Created($"/me/org/facilities/{facilityId}/limits/{limit.EmissionType}", limit));
    }

    private static async Task<IResult> UpdateMyFacilityLimit(
        Guid facilityId,
        string emissionType,
        UpdateLimitRequest request,
        ClaimsPrincipal user,
        IFacilityRepository facilities,
        CancellationToken cancellationToken)
    {
        if (user.GetOrgId() is not Guid orgId)
        {
            return NoOrg();
        }

        if (!TryParseEmissionType(emissionType, out var parsed))
        {
            return UnknownEmissionType(emissionType);
        }

        var result = await UpdateLimitHandler.Handle(
            new UpdateLimitCommand(orgId, facilityId, parsed, request.Value),
            facilities, cancellationToken);
        return result.Match(Results.Ok);
    }

    private static async Task<IResult> RemoveMyFacilityLimit(
        Guid facilityId,
        string emissionType,
        ClaimsPrincipal user,
        IFacilityRepository facilities,
        CancellationToken cancellationToken)
    {
        if (user.GetOrgId() is not Guid orgId)
        {
            return NoOrg();
        }

        if (!TryParseEmissionType(emissionType, out var parsed))
        {
            return UnknownEmissionType(emissionType);
        }

        var result = await RemoveLimitHandler.Handle(
            new RemoveLimitCommand(orgId, facilityId, parsed), facilities, cancellationToken);
        return result.Match(_ => Results.NoContent());
    }

    // Parses an Emission Type name (case-insensitive) to the enum, rejecting unknown names and
    // out-of-range numeric strings (Enum.TryParse accepts those, so Enum.IsDefined guards them).
    private static bool TryParseEmissionType(string value, out EmissionType emissionType) =>
        Enum.TryParse(value, ignoreCase: true, out emissionType) && Enum.IsDefined(emissionType);

    private static IResult UnknownEmissionType(string value) => Results.Problem(
        statusCode: StatusCodes.Status400BadRequest,
        title: "Limit.UnknownEmissionType",
        detail: $"'{value}' is not a known Emission Type.");

    // I-D13: a SiteAdmin has no Org, so the "my Org" facility routes do not apply to them.
    // I-D03 by construction: the Org id comes only from the caller's token, never from input.
    private static IResult NoOrg() => Results.Problem(
        statusCode: StatusCodes.Status403Forbidden,
        title: "Org.Required",
        detail: "This operation requires an Org User; the caller has no Org.");
}
