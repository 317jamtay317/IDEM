using RecordKeeping.Application.Records;

namespace RecordKeeping.Api.Endpoints;

/// <summary>
/// Self-service Record endpoint for the signed-in Org User: log a Record for a Facility of
/// <em>their own</em> Org. The route is Org-scoped from the caller's <c>org_id</c> claim, never from
/// client input, so a User can only ever write against their own Org's data (I-D03).
/// </summary>
/// <remarks>
/// A SiteAdmin has no Org (I-D13); the route returns <c>403</c> for them. Reading and searching
/// Records back out is a later slice; this surface is the "Log a Record" write path only.
/// </remarks>
public partial class MyOrgRecordEndpoints : IEndpoint
{
    /// <inheritdoc />
    public void AddEndpoints(IEndpointRouteBuilder endpoints)
    {
        var records = endpoints.MapGroup("me/org/records")
            .WithTags("My Org Records")
            .RequireAuthorization("ApiUser");

        records.MapPost("/", LogMyRecord)
            .Produces<RecordResponse>(StatusCodes.Status201Created)
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status403Forbidden)
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict)
            .WithSummary("Logs a Record for a Facility in the signed-in user's Org.");
    }
}
