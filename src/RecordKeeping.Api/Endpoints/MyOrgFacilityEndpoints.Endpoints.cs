using RecordKeeping.Application.Facilities;
using RecordKeeping.Application.Orgs;

namespace RecordKeeping.Api.Endpoints;

/// <summary>
/// Self-service Facility endpoints for the signed-in Org User: manage the Facilities of
/// <em>their own</em> Org (I-D06). Every route is Org-scoped from the caller's <c>org_id</c>
/// claim, never from client input, so a User can only ever reach their own Org's data (I-D03).
/// </summary>
/// <remarks>
/// A SiteAdmin has no Org (I-D13); these routes return <c>403</c> for them. SiteAdmin
/// cross-Org facility management is a separate, deferred surface (<c>/orgs/{orgId}/facilities</c>).
/// </remarks>
public partial class MyOrgFacilityEndpoints : IEndpoint
{
    /// <inheritdoc />
    public void AddEndpoints(IEndpointRouteBuilder endpoints)
    {
        var facilities = endpoints.MapGroup("me/org/facilities")
            .WithTags("My Org Facilities")
            .RequireAuthorization("ApiUser");

        facilities.MapGet("/", GetMyFacilities)
            .Produces<IReadOnlyList<FacilityResponse>>()
            .ProducesProblem(StatusCodes.Status403Forbidden)
            .WithSummary("Lists the Facilities of the signed-in user's Org.");

        facilities.MapPost("/", AddMyFacility)
            .Produces<FacilityResponse>(StatusCodes.Status201Created)
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status403Forbidden)
            .WithSummary("Adds a Facility to the signed-in user's Org.");

        facilities.MapPut("/{facilityId:guid}", RenameMyFacility)
            .Produces<FacilityResponse>()
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status403Forbidden)
            .ProducesProblem(StatusCodes.Status404NotFound)
            .WithSummary("Renames a Facility in the signed-in user's Org.");

        facilities.MapDelete("/{facilityId:guid}", RemoveMyFacility)
            .Produces(StatusCodes.Status204NoContent)
            .ProducesProblem(StatusCodes.Status403Forbidden)
            .ProducesProblem(StatusCodes.Status404NotFound)
            .WithSummary("Removes a Facility from the signed-in user's Org.");

        facilities.MapGet("/{facilityId:guid}/licenses", GetMyFacilityLicenses)
            .Produces<IReadOnlyList<LicenseResponse>>()
            .ProducesProblem(StatusCodes.Status403Forbidden)
            .ProducesProblem(StatusCodes.Status404NotFound)
            .WithSummary("Lists the licenses of a Facility in the signed-in user's Org.");

        facilities.MapPost("/{facilityId:guid}/licenses", AddMyFacilityLicense)
            .Produces<LicenseResponse>(StatusCodes.Status201Created)
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status403Forbidden)
            .ProducesProblem(StatusCodes.Status404NotFound)
            .WithSummary("Adds a license to a Facility in the signed-in user's Org.");

        facilities.MapDelete("/{facilityId:guid}/licenses/{licenseId:guid}", RemoveMyFacilityLicense)
            .Produces(StatusCodes.Status204NoContent)
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status403Forbidden)
            .ProducesProblem(StatusCodes.Status404NotFound)
            .WithSummary("Removes a license from a Facility in the signed-in user's Org.");
    }
}
