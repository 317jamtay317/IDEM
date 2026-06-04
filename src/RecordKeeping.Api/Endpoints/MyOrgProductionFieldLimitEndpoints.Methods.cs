using System.Security.Claims;
using RecordKeeping.Application.ProductionFieldLimits;
using RecordKeeping.Application.ProductionFields;
using RecordKeeping.Domain.ProductionFieldLimits;

namespace RecordKeeping.Api.Endpoints;

public partial class MyOrgProductionFieldLimitEndpoints
{
    /// <summary>Request body for setting a Production Field limit (the field is addressed in the route).</summary>
    /// <param name="LowLimit">The lowest acceptable recorded value.</param>
    /// <param name="HighLimit">The highest acceptable recorded value; must be at least <paramref name="LowLimit"/> (I-D25).</param>
    /// <param name="Unit">Whether the bounds are expressed as a percentage or in tons.</param>
    public sealed record SetProductionFieldLimitRequest(
        decimal LowLimit,
        decimal HighLimit,
        LimitUnit Unit);

    private static async Task<IResult> GetMyProductionFieldLimits(
        ClaimsPrincipal user,
        IProductionFieldLimitRepository limits,
        CancellationToken cancellationToken)
    {
        if (user.GetOrgId() is not Guid orgId)
        {
            return NoOrg();
        }

        var result = await GetProductionFieldLimitsHandler.Handle(
            new GetProductionFieldLimitsQuery(orgId), limits, cancellationToken);
        return result.Match(Results.Ok);
    }

    private static async Task<IResult> SetMyProductionFieldLimit(
        string propertyName,
        SetProductionFieldLimitRequest request,
        ClaimsPrincipal user,
        IProductionFieldLimitRepository limits,
        IProductionFieldRepository fields,
        CancellationToken cancellationToken)
    {
        if (user.GetOrgId() is not Guid orgId)
        {
            return NoOrg();
        }

        // I-D03: the Org id comes only from the caller's token, never from the route or body.
        var result = await SetProductionFieldLimitHandler.Handle(
            new SetProductionFieldLimitCommand(
                orgId, propertyName, request.LowLimit, request.HighLimit, request.Unit),
            limits, fields, cancellationToken);

        return result.Match(Results.Ok);
    }

    // I-D13: a SiteAdmin has no Org, so the "my Org" limit routes do not apply to them.
    // I-D03 by construction: the Org id comes only from the caller's token, never from input.
    private static IResult NoOrg() => Results.Problem(
        statusCode: StatusCodes.Status403Forbidden,
        title: "Org.Required",
        detail: "This operation requires an Org User; the caller has no Org.");
}
