using ErrorOr;
using RecordKeeping.Application.Facilities;
using RecordKeeping.Application.ProductionFields;
using RecordKeeping.Domain.Records;

namespace RecordKeeping.Application.Records;

/// <summary>A single field value submitted when logging a Record.</summary>
/// <param name="PropertyName">The Production Field key the value is for (I-D21).</param>
/// <param name="NumericValue">The value when the field's DataType is Decimal or Integer.</param>
/// <param name="BooleanValue">The value when the field's DataType is Boolean.</param>
/// <param name="DateValue">The value when the field's DataType is Date.</param>
public sealed record RecordValueInput(
    string PropertyName,
    decimal? NumericValue = null,
    bool? BooleanValue = null,
    DateOnly? DateValue = null);

/// <summary>Command to log a Record for a Facility on a date (the "Log a Record" write path).</summary>
/// <param name="OrgId">The owning Org (taken from the caller's token, never client input) — I-D01/I-D03.</param>
/// <param name="FacilityId">The Facility the Record is for (I-D07).</param>
/// <param name="Date">The calendar date the Record covers.</param>
/// <param name="Values">The field values entered; may be empty for a day with nothing to record.</param>
public sealed record LogRecordCommand(
    Guid OrgId,
    Guid FacilityId,
    DateOnly Date,
    IReadOnlyList<RecordValueInput> Values);

/// <summary>Handles <see cref="LogRecordCommand"/>.</summary>
public static class LogRecordHandler
{
    /// <summary>
    /// Logs a new Record. Confirms the Facility belongs to the caller's Org (I-D07/I-D03), enforces
    /// one Record per Facility per date (I-D23), resolves each value against the active Production
    /// Field catalog, and lets the <see cref="Record"/> aggregate own its own invariants.
    /// </summary>
    /// <param name="command">The log command.</param>
    /// <param name="records">The Record repository.</param>
    /// <param name="facilities">The Facility repository, used to confirm the Facility within the Org.</param>
    /// <param name="fields">The Production Field catalog repository.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>
    /// The created Record as a <see cref="RecordResponse"/>; <see cref="FacilityErrors.NotFound"/> when
    /// the Facility is not in the caller's Org; <see cref="RecordErrors.DuplicateForDate"/> (I-D23) when
    /// the Facility already has a Record for the date; or a validation error when a value references an
    /// unavailable field or does not match its field's DataType.
    /// </returns>
    public static async Task<ErrorOr<RecordResponse>> Handle(
        LogRecordCommand command,
        IRecordRepository records,
        IFacilityRepository facilities,
        IProductionFieldRepository fields,
        CancellationToken cancellationToken)
    {
        // I-D07 + I-D03: the Facility must exist within the caller's Org. A Facility in another Org is
        // reported as not found, never as forbidden.
        var facility = await facilities.GetByIdAsync(command.OrgId, command.FacilityId, cancellationToken);
        if (facility is null)
        {
            return FacilityErrors.NotFound(command.FacilityId);
        }

        // I-D23: at most one Record per Facility per date.
        var existing = await records.GetByFacilityAndDateAsync(
            command.OrgId, command.FacilityId, command.Date, cancellationToken);
        if (existing is not null)
        {
            return RecordErrors.DuplicateForDate(command.FacilityId, command.Date);
        }

        var createResult = Record.Create(command.OrgId, command.FacilityId, command.Date);
        if (createResult.IsError)
        {
            return createResult.Errors;
        }

        var record = createResult.Value;

        // The catalog is the source of truth for which fields may be recorded. Resolve it once and key
        // by the immutable PropertyName, case-insensitively, considering active fields only.
        var catalog = await fields.GetAllAsync(cancellationToken);
        var activeByPropertyName = catalog
            .Where(field => field.IsActive)
            .ToDictionary(field => field.PropertyName, StringComparer.OrdinalIgnoreCase);

        foreach (var input in command.Values)
        {
            if (string.IsNullOrWhiteSpace(input.PropertyName) ||
                !activeByPropertyName.TryGetValue(input.PropertyName.Trim(), out var field))
            {
                return RecordErrors.FieldNotAvailable(input.PropertyName ?? string.Empty);
            }

            var valueResult = RecordValue.Create(
                field.PropertyName, field.DataType, input.NumericValue, input.BooleanValue, input.DateValue);
            if (valueResult.IsError)
            {
                return valueResult.Errors;
            }

            var addResult = record.AddValue(valueResult.Value);
            if (addResult.IsError)
            {
                return addResult.Errors;
            }
        }

        await records.AddAsync(record, cancellationToken);
        await records.SaveChangesAsync(cancellationToken);
        return RecordResponse.FromRecord(record);
    }
}
