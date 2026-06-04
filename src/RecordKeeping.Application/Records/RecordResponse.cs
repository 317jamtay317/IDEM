using RecordKeeping.Domain.Records;

namespace RecordKeeping.Application.Records;

/// <summary>Read model returned to API callers for a single field value on a Record.</summary>
/// <param name="PropertyName">The Production Field key the value is recorded against (I-D21).</param>
/// <param name="NumericValue">The numeric value for a Decimal/Integer field, or <c>null</c>.</param>
/// <param name="BooleanValue">The boolean value for a Boolean field, or <c>null</c>.</param>
/// <param name="DateValue">The date value for a Date field, or <c>null</c>.</param>
public sealed record RecordValueResponse(
    string PropertyName,
    decimal? NumericValue,
    bool? BooleanValue,
    DateOnly? DateValue)
{
    /// <summary>Projects a domain <see cref="RecordValue"/> into a <see cref="RecordValueResponse"/>.</summary>
    /// <param name="value">The value to project.</param>
    /// <returns>The response read model.</returns>
    public static RecordValueResponse FromRecordValue(RecordValue value) =>
        new(value.PropertyName, value.NumericValue, value.BooleanValue, value.DateValue);
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
    /// <summary>Projects a domain <see cref="Record"/> into a <see cref="RecordResponse"/>.</summary>
    /// <param name="record">The Record to project.</param>
    /// <returns>The response read model.</returns>
    public static RecordResponse FromRecord(Record record) => new(
        record.Id,
        record.FacilityId,
        record.Date,
        record.Values.Select(RecordValueResponse.FromRecordValue).ToList());
}
