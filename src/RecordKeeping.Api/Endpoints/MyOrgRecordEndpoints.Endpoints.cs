using RecordKeeping.Application.Records;

namespace RecordKeeping.Api.Endpoints;

/// <summary>
/// Self-service Record endpoints for the signed-in Org User: log and read Records for Facilities of
/// <em>their own</em> Org. Every route is Org-scoped from the caller's <c>org_id</c> claim, never from
/// client input, so a User can only ever reach their own Org's data (I-D03).
/// </summary>
/// <remarks>
/// A SiteAdmin has no Org (I-D13); these routes return <c>403</c> for them. Writing a day's Record is
/// the "Log a Record" path (<c>POST</c>); the <c>GET</c> routes read and search Records back out,
/// optionally filtered by Facility and date range.
/// </remarks>
public partial class MyOrgRecordEndpoints : IEndpoint
{
    /// <inheritdoc />
    public void AddEndpoints(IEndpointRouteBuilder endpoints)
    {
        var records = endpoints.MapGroup("me/org/records")
            .WithTags("My Org Records")
            .RequireAuthorization("ApiUser");

        records.MapGet("/", GetMyRecords)
            .Produces<IReadOnlyList<RecordResponse>>()
            .ProducesProblem(StatusCodes.Status403Forbidden)
            .WithSummary("Lists Records in the signed-in user's Org, optionally filtered by Facility and date range.");

        records.MapGet("/{recordId:guid}", GetMyRecord)
            .Produces<RecordResponse>()
            .ProducesProblem(StatusCodes.Status403Forbidden)
            .ProducesProblem(StatusCodes.Status404NotFound)
            .WithSummary("Gets a single Record in the signed-in user's Org by id.");

        records.MapPost("/", LogMyRecord)
            .Produces<RecordResponse>(StatusCodes.Status201Created)
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status403Forbidden)
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict)
            .WithSummary("Logs a Record for a Facility in the signed-in user's Org.");
    }
}
