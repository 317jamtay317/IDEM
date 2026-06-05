using System.Security.Claims;
using RecordKeeping.Application.Facilities;
using RecordKeeping.Application.ProductionFieldLimits;
using RecordKeeping.Application.ProductionFields;
using RecordKeeping.Application.Records;

namespace RecordKeeping.Api.Endpoints;

public partial class MyOrgRecordEndpoints
{
    /// <summary>A single field value in a <see cref="RecordRequest"/>.</summary>
    /// <param name="PropertyName">The Production Field key the value is for (I-D21).</param>
    /// <param name="NumericValue">The value when the field's DataType is Decimal or Integer.</param>
    /// <param name="BooleanValue">The value when the field's DataType is Boolean.</param>
    /// <param name="DateValue">The value when the field's DataType is Date.</param>
    public sealed record RecordValueRequest(
        string PropertyName,
        decimal? NumericValue = null,
        bool? BooleanValue = null,
        DateOnly? DateValue = null);

    /// <summary>Request body for logging a Record.</summary>
    /// <param name="FacilityId">The Facility the Record is for (must belong to the caller's Org).</param>
    /// <param name="Date">The calendar date the Record covers.</param>
    /// <param name="Values">The field values entered; may be empty.</param>
    public sealed record RecordRequest(
        Guid FacilityId,
        DateOnly Date,
        IReadOnlyList<RecordValueRequest> Values);

    private static async Task<IResult> GetMyRecords(
        ClaimsPrincipal user,
        IRecordRepository records,
        IProductionFieldLimitRepository limits,
        CancellationToken cancellationToken,
        Guid? facilityId = null,
        DateOnly? from = null,
        DateOnly? to = null)
    {
        if (user.GetOrgId() is not Guid orgId)
        {
            return NoOrg();
        }

        // I-D03: the Org id comes only from the caller's token; the filters narrow within it, never across.
        var result = await GetRecordsHandler.Handle(
            new GetRecordsQuery(orgId, facilityId, from, to), records, limits, cancellationToken);
        return result.Match(Results.Ok);
    }

    private static async Task<IResult> GetMyRecord(
        Guid recordId,
        ClaimsPrincipal user,
        IRecordRepository records,
        IProductionFieldLimitRepository limits,
        CancellationToken cancellationToken)
    {
        if (user.GetOrgId() is not Guid orgId)
        {
            return NoOrg();
        }

        var result = await GetRecordHandler.Handle(
            new GetRecordQuery(orgId, recordId), records, limits, cancellationToken);
        return result.Match(Results.Ok);
    }

    private static async Task<IResult> LogMyRecord(
        RecordRequest request,
        ClaimsPrincipal user,
        IRecordRepository records,
        IFacilityRepository facilities,
        IProductionFieldRepository fields,
        CancellationToken cancellationToken)
    {
        if (user.GetOrgId() is not Guid orgId)
        {
            return NoOrg();
        }

        var values = (request.Values ?? [])
            .Select(value => new RecordValueInput(
                value.PropertyName, value.NumericValue, value.BooleanValue, value.DateValue))
            .ToList();

        var result = await LogRecordHandler.Handle(
            new LogRecordCommand(orgId, request.FacilityId, request.Date, values),
            records, facilities, fields, cancellationToken);

        return result.Match(record => Results.Created($"/me/org/records/{record.Id}", record));
    }

    // I-D13: a SiteAdmin has no Org, so the "my Org" record route does not apply to them.
    // I-D03 by construction: the Org id comes only from the caller's token, never from input.
    private static IResult NoOrg() => Results.Problem(
        statusCode: StatusCodes.Status403Forbidden,
        title: "Org.Required",
        detail: "This operation requires an Org User; the caller has no Org.");
}
