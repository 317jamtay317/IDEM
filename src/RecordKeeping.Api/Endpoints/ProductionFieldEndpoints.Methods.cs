using RecordKeeping.Application.ProductionFields;
using RecordKeeping.Domain.ProductionFields;

namespace RecordKeeping.Api.Endpoints;

public partial class ProductionFieldEndpoints
{
    /// <summary>Request body for adding a Production Field to the catalog.</summary>
    /// <param name="PropertyName">The immutable machine key, e.g. <c>HotMix</c> (I-D21).</param>
    /// <param name="FriendlyName">The human-facing label, e.g. "Hot Mix".</param>
    /// <param name="DataType">The kind of value the field captures.</param>
    /// <param name="Description">Optional help text.</param>
    /// <param name="Category">Optional picker grouping.</param>
    /// <param name="IsSummary">Whether the field appears in summaries/Reports by default.</param>
    /// <param name="DisplayOrder">The field's sort position in the picker.</param>
    public sealed record CreateProductionFieldRequest(
        string PropertyName,
        string FriendlyName,
        ProductionFieldDataType DataType,
        string? Description,
        string? Category,
        bool IsSummary,
        int DisplayOrder);

    /// <summary>Request body for updating a Production Field. PropertyName is immutable and not accepted.</summary>
    /// <param name="FriendlyName">The new human-facing label.</param>
    /// <param name="DataType">The kind of value the field captures.</param>
    /// <param name="Description">Optional help text.</param>
    /// <param name="Category">Optional picker grouping.</param>
    /// <param name="IsSummary">Whether the field appears in summaries/Reports by default.</param>
    /// <param name="DisplayOrder">The field's sort position in the picker.</param>
    public sealed record UpdateProductionFieldRequest(
        string FriendlyName,
        ProductionFieldDataType DataType,
        string? Description,
        string? Category,
        bool IsSummary,
        int DisplayOrder);

    private static async Task<IResult> GetProductionFields(
        IProductionFieldRepository repository,
        CancellationToken cancellationToken,
        bool includeRetired = false)
    {
        var result = await GetProductionFieldsHandler.Handle(
            new GetProductionFieldsQuery(includeRetired), repository, cancellationToken);
        return Results.Ok(result);
    }

    private static async Task<IResult> CreateProductionField(
        CreateProductionFieldRequest request,
        IProductionFieldRepository repository,
        CancellationToken cancellationToken)
    {
        var result = await CreateProductionFieldHandler.Handle(
            new CreateProductionFieldCommand(
                request.PropertyName,
                request.FriendlyName,
                request.DataType,
                request.Description,
                request.Category,
                request.IsSummary,
                request.DisplayOrder),
            repository,
            cancellationToken);
        return result.Match(field => Results.Created($"/production-fields/{field.Id}", field));
    }

    private static async Task<IResult> UpdateProductionField(
        Guid id,
        UpdateProductionFieldRequest request,
        IProductionFieldRepository repository,
        CancellationToken cancellationToken)
    {
        var result = await UpdateProductionFieldHandler.Handle(
            new UpdateProductionFieldCommand(
                id,
                request.FriendlyName,
                request.DataType,
                request.Description,
                request.Category,
                request.IsSummary,
                request.DisplayOrder),
            repository,
            cancellationToken);
        return result.Match(Results.Ok);
    }

    private static async Task<IResult> RetireProductionField(
        Guid id, IProductionFieldRepository repository, CancellationToken cancellationToken)
    {
        var result = await RetireProductionFieldHandler.Handle(
            new RetireProductionFieldCommand(id), repository, cancellationToken);
        return result.Match(Results.Ok);
    }

    private static async Task<IResult> ReactivateProductionField(
        Guid id, IProductionFieldRepository repository, CancellationToken cancellationToken)
    {
        var result = await ReactivateProductionFieldHandler.Handle(
            new ReactivateProductionFieldCommand(id), repository, cancellationToken);
        return result.Match(Results.Ok);
    }
}
