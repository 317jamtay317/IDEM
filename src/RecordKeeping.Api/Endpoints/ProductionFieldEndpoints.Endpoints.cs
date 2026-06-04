using RecordKeeping.Application.ProductionFields;

namespace RecordKeeping.Api.Endpoints;

/// <summary>
/// Endpoints for the platform-global Production Field catalog: SiteAdmin-managed mutations plus a
/// shared read used by the Log a Record field picker.
/// </summary>
/// <remarks>
/// TODO (authorization): catalog mutations (create/update/retire/reactivate) must require a SiteAdmin
/// (I-D13); the read may be any authenticated Org User. Authorization is deferred to the dedicated
/// permissions session — these routes are currently ungated, matching <see cref="OrgEndpoints"/>.
/// </remarks>
public partial class ProductionFieldEndpoints : IEndpoint
{
    /// <inheritdoc />
    public void AddEndpoints(IEndpointRouteBuilder endpoints)
    {
        var fields = endpoints.MapGroup("production-fields").WithTags("Production Fields");

        fields.MapGet("/", GetProductionFields)
            .Produces<IReadOnlyList<ProductionFieldResponse>>()
            .WithSummary("Lists Production Fields. Active only by default; pass includeRetired=true for the full catalog.");

        fields.MapPost("/", CreateProductionField)
            .Produces<ProductionFieldResponse>(StatusCodes.Status201Created)
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status409Conflict)
            .WithSummary("Adds a Production Field to the catalog.");

        fields.MapPut("/{id:guid}", UpdateProductionField)
            .Produces<ProductionFieldResponse>()
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict)
            .WithSummary("Updates a Production Field's editable attributes (PropertyName is immutable).");

        fields.MapPost("/{id:guid}/retire", RetireProductionField)
            .Produces<ProductionFieldResponse>()
            .ProducesProblem(StatusCodes.Status404NotFound)
            .WithSummary("Retires a Production Field so it is no longer offered for new Records.");

        fields.MapPost("/{id:guid}/reactivate", ReactivateProductionField)
            .Produces<ProductionFieldResponse>()
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict)
            .WithSummary("Reactivates a retired Production Field.");
    }
}
