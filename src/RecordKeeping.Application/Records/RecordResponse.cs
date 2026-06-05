using RecordKeeping.Domain.ProductionFieldLimits;
using RecordKeeping.Domain.Records;

namespace RecordKeeping.Application.Records;

/// <summary>Read model returned to API callers for a single field value on a Record.</summary>
/// <param name="PropertyName">The Production Field key the value is recorded against (I-D21).</param>
/// <param name="NumericValue">The numeric value for a Decimal/Integer field, or <c>null</c>.</param>
/// <param name="BooleanValue">The boolean value for a Boolean field, or <c>null</c>.</param>
/// <param name="DateValue">The date value for a Date field, or <c>null</c>.</param>
/// <param name="Exceedance">
/// Where the numeric value falls relative to the Org's configured limit for the field, or <c>null</c>
/// when the field is non-numeric or the Org has set no limit for it. A <c>Below</c>/<c>Above</c> result
/// is an Exceedance.
/// </param>
public sealed record RecordValueResponse(
    string PropertyName,
    decimal? NumericValue,
    bool? BooleanValue,
    DateOnly? DateValue,
    ExceedanceStatus? Exceedance)
{
    /// <summary>
    /// Projects a domain <see cref="RecordValue"/> into a <see cref="RecordValueResponse"/>, classifying
    /// its numeric value against the Org's limit for the field when one applies.
    /// </summary>
    /// <param name="value">The value to project.</param>
    /// <param name="limit">The Org's limit for this field, or <c>null</c> when none is configured.</param>
    /// <returns>The response read model.</returns>
    public static RecordValueResponse FromRecordValue(RecordValue value, ProductionFieldLimit? limit)
    {
        ExceedanceStatus? exceedance = value.NumericValue is decimal numeric && limit is not null
            ? limit.Classify(numeric)
            : null;

        return new(value.PropertyName, value.NumericValue, value.BooleanValue, value.DateValue, exceedance);
    }
}

/// <summary>Read model returned to API callers for a <see cref="Record"/>.</summary>
/// <param name="Id">The Record's unique identifier.</param>
/// <param name="FacilityId">The Facility the Record was logged for (I-D07).</param>
/// <param name="Date">The calendar date the Record covers.</param>
/// <param name="Values">The recorded field values, keyed by Production Field key.</param>
public sealed record RecordResponse(
    Guid Id,
    Guid FacilityId,
    DateOnly Date,
    IReadOnlyList<RecordValueResponse> Values)
{
    /// <summary>
    /// Projects a domain <see cref="Record"/> into a <see cref="RecordResponse"/>, annotating each value
    /// with its Exceedance status against the supplied Org limits (keyed by Production Field key).
    /// </summary>
    /// <param name="record">The Record to project.</param>
    /// <param name="limits">The Org's limits keyed by <c>PropertyName</c>; values without a limit are unannotated.</param>
    /// <returns>The response read model.</returns>
    public static RecordResponse FromRecord(
        Record record, IReadOnlyDictionary<string, ProductionFieldLimit> limits) => new(
        record.Id,
        record.FacilityId,
        record.Date,
        record.Values
            .Select(value => RecordValueResponse.FromRecordValue(
                value, limits.GetValueOrDefault(value.PropertyName)))
            .ToList());
}
