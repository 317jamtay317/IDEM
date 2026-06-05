using RecordKeeping.Application.ProductionFieldLimits;

namespace RecordKeeping.Api.Endpoints;

/// <summary>
/// Self-service Production Field Limit endpoints for the signed-in Org User: set and read the per-field
/// limits for <em>their own</em> Org. Every route is Org-scoped from the caller's <c>org_id</c> claim,
/// never from client input, so a User can only ever reach their own Org's limits (I-D03).
/// </summary>
/// <remarks>
/// A SiteAdmin has no Org (I-D13); these routes return <c>403</c> for them. Setting a limit is an upsert
/// addressed by the Production Field's PropertyName, so an Org holds at most one limit per field (I-D24).
/// </remarks>
public partial class MyOrgProductionFieldLimitEndpoints : IEndpoint
{
    /// <inheritdoc />
    public void AddEndpoints(IEndpointRouteBuilder endpoints)
    {
        var limits = endpoints.MapGroup("me/org/production-field-limits")
            .WithTags("My Org Production Field Limits")
            .RequireAuthorization("ApiUser");

        limits.MapGet("/", GetMyProductionFieldLimits)
            .Produces<IReadOnlyList<ProductionFieldLimitResponse>>()
            .ProducesProblem(StatusCodes.Status403Forbidden)
            .WithSummary("Lists the Production Field limits configured in the signed-in user's Org.");

        limits.MapPut("/{propertyName}", SetMyProductionFieldLimit)
            .Produces<ProductionFieldLimitResponse>()
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status403Forbidden)
            .WithSummary("Sets (creates or updates) the signed-in user's Org limit for a Production Field.");
    }
}
