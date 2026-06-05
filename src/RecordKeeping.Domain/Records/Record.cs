using ErrorOr;
using RecordKeeping.Domain.Common;

namespace RecordKeeping.Domain.Records;

/// <summary>
/// A persisted data entry capturing a Facility's compliance-relevant activity for a single date —
/// the thing a User creates on the "Log a Record" screen. Holds its field values
/// <see cref="Values">sparsely</see>, keyed by Production Field <c>PropertyName</c>.
/// </summary>
/// <remarks>
/// Aggregate root. Constructed only via <see cref="Create"/>. Its owning Org (I-D01), Facility
/// (I-D07), and <see cref="Date"/> are assigned at creation and never change; there is at most one
/// Record per Facility per date (I-D23, enforced at the application/persistence layer since it spans
/// Records). The aggregate owns the rule that a field appears at most once among its values.
/// </remarks>
public sealed class Record : AggregateRoot<Guid>
{
    /// <summary>The Org that owns this Record. Required and immutable (I-D01).</summary>
    public Guid OrgId { get; }

    /// <summary>The Facility this Record was logged for. Required and immutable (I-D07).</summary>
    public Guid FacilityId { get; }

    /// <summary>The calendar date the Record covers. Immutable; part of the Facility+date identity (I-D23).</summary>
    public DateOnly Date { get; }

    /// <summary>
    /// The field values recorded, keyed by Production Field <c>PropertyName</c>. Sparse — only the
    /// fields actually entered are present. Mutated only through <see cref="AddValue"/>.
    /// </summary>
    public IReadOnlyCollection<RecordValue> Values => _values;

    private Record(Guid id, Guid orgId, Guid facilityId, DateOnly date) : base(id)
    {
        OrgId = orgId;
        FacilityId = facilityId;
        Date = date;
    }

    /// <summary>
    /// Creates a new Record for a Facility on a date.
    /// </summary>
    /// <param name="orgId">The owning Org's id; required and immutable thereafter (I-D01).</param>
    /// <param name="facilityId">The Facility the Record is for; required and immutable thereafter (I-D07).</param>
    /// <param name="date">The calendar date the Record covers.</param>
    /// <returns>The new Record, or a validation error when the Org id or Facility id is empty.</returns>
    public static ErrorOr<Record> Create(Guid orgId, Guid facilityId, DateOnly date)
    {
        if (orgId == Guid.Empty)
        {
            // I-D01: a Record cannot exist without an owning Org.
            return Error.Validation("I-D01", "OrgId is required for a Record.");
        }

        if (facilityId == Guid.Empty)
        {
            // I-D07: a Record must be associated with a Facility.
            return Error.Validation("I-D07", "FacilityId is required for a Record.");
        }

        return new Record(Guid.NewGuid(), orgId, facilityId, date);
    }

    /// <summary>
    /// Adds a field <paramref name="value"/> to the Record. A field may be recorded at most once, so
    /// adding a second value for a <c>PropertyName</c> already present (case-insensitively) is rejected.
    /// </summary>
    /// <param name="value">The field value to add.</param>
    /// <returns>
    /// <see cref="Result.Success"/>, or <see cref="RecordErrors.DuplicateValue"/> when the Record
    /// already holds a value for the same field.
    /// </returns>
    public ErrorOr<Success> AddValue(RecordValue value)
    {
        if (_values.Any(existing =>
                string.Equals(existing.PropertyName, value.PropertyName, StringComparison.OrdinalIgnoreCase)))
        {
            return RecordErrors.DuplicateValue(value.PropertyName);
        }

        _values.Add(value);
        return Result.Success;
    }

    private readonly List<RecordValue> _values = [];
}
