using RecordKeeping.Application.Orgs;

namespace RecordKeeping.Api.Endpoints;

/// <summary>
/// CRUD endpoints for the Org aggregate.
/// </summary>
/// <remarks>
/// TODO (authorization): every Org operation must require a SiteAdmin (I-D13).
/// Authorization is deferred to a dedicated permissions session; these routes are
/// currently ungated. Add <c>.RequireAuthorization("SiteAdmin")</c> (or the
/// permission abstraction once it exists) to every route below before launch.
/// </remarks>
public partial class OrgEndpoints : IEndpoint
{
    /// <inheritdoc />
    public void AddEndpoints(IEndpointRouteBuilder endpoints)
    {
        var orgs = endpoints.MapGroup("orgs").WithTags("Orgs");

        orgs.MapGet("/", GetOrgs)
            .Produces<IReadOnlyList<OrgResponse>>()
            .WithSummary("Lists all Orgs.");

        orgs.MapGet("/{id:guid}", GetOrgById)
            .Produces<OrgResponse>()
            .ProducesProblem(StatusCodes.Status404NotFound)
            .WithSummary("Gets a single Org by id.");

        orgs.MapPost("/", CreateOrg)
            .Produces<OrgResponse>(StatusCodes.Status201Created)
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .WithSummary("Creates a new Org.");

        orgs.MapPut("/{id:guid}", UpdateOrg)
            .Produces<OrgResponse>()
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict)
            .WithSummary("Updates an Org's SSO configuration. Orgs cannot be renamed.");

        orgs.MapDelete("/{id:guid}", DeleteOrg)
            .Produces(StatusCodes.Status204NoContent)
            .ProducesProblem(StatusCodes.Status404NotFound)
            .WithSummary("Permanently deletes an Org.");
    }
}
