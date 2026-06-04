using ErrorOr;
using RecordKeeping.Domain.ProductionFields;

namespace RecordKeeping.Domain.Records;

/// <summary>
/// A single field's value on a <see cref="Record"/>, keyed by a Production Field's immutable
/// <see cref="PropertyName"/> (I-D21). Exactly one of the typed value columns is populated, chosen
/// by the field's <see cref="ProductionFieldDataType"/>: <see cref="NumericValue"/> for
/// <c>Decimal</c>/<c>Integer</c>, <see cref="BooleanValue"/> for <c>Boolean</c>, or
/// <see cref="DateValue"/> for <c>Date</c>.
/// </summary>
/// <remarks>
/// Part of the <see cref="Record"/> aggregate and constructed only via <see cref="Create"/>, which
/// guarantees the populated column matches the declared DataType. A Record stores its values
/// <em>sparsely</em> — one of these per field actually entered, not one per catalog field.
/// </remarks>
public sealed class RecordValue
{
    /// <summary>Maximum permitted length of a <see cref="PropertyName"/> (matches the catalog key).</summary>
    public const int MaxPropertyNameLength = ProductionField.MaxPropertyNameLength;

    /// <summary>
    /// The Production Field key this value is recorded against (e.g. <c>HotMix</c>). Matches the
    /// catalog's immutable <c>PropertyName</c> (I-D21).
    /// </summary>
    public string PropertyName { get; private set; }

    /// <summary>The numeric value for a <c>Decimal</c> or <c>Integer</c> field; <see langword="null"/> otherwise.</summary>
    public decimal? NumericValue { get; private set; }

    /// <summary>The boolean value for a <c>Boolean</c> field; <see langword="null"/> otherwise.</summary>
    public bool? BooleanValue { get; private set; }

    /// <summary>The date value for a <c>Date</c> field; <see langword="null"/> otherwise.</summary>
    public DateOnly? DateValue { get; private set; }

    private RecordValue(string propertyName, decimal? numericValue, bool? booleanValue, DateOnly? dateValue)
    {
        PropertyName = propertyName;
        NumericValue = numericValue;
        BooleanValue = booleanValue;
        DateValue = dateValue;
    }

    /// <summary>
    /// Creates a Record value for a field, validating that the supplied value matches the field's
    /// <paramref name="dataType"/>. Only the argument that corresponds to the DataType is read; the
    /// others are ignored.
    /// </summary>
    /// <param name="propertyName">The catalog field key the value is for; required, trimmed (I-D21).</param>
    /// <param name="dataType">The field's declared data type, which dictates the required value.</param>
    /// <param name="numericValue">The value for a <c>Decimal</c>/<c>Integer</c> field.</param>
    /// <param name="booleanValue">The value for a <c>Boolean</c> field.</param>
    /// <param name="dateValue">The value for a <c>Date</c> field.</param>
    /// <returns>
    /// The Record value, or a validation error when the property name is blank or the value required
    /// by <paramref name="dataType"/> is missing or (for <c>Integer</c>) not a whole number.
    /// </returns>
    public static ErrorOr<RecordValue> Create(
        string propertyName,
        ProductionFieldDataType dataType,
        decimal? numericValue = null,
        bool? booleanValue = null,
        DateOnly? dateValue = null)
    {
        if (string.IsNullOrWhiteSpace(propertyName))
        {
            return Error.Validation(
                "Record.Value.PropertyName.Empty", "PropertyName is required for a Record value.");
        }

        var key = propertyName.Trim();

        switch (dataType)
        {
            case ProductionFieldDataType.Decimal:
                if (numericValue is null)
                {
                    return MissingValue(key, dataType);
                }

                return new RecordValue(key, numericValue, null, null);

            case ProductionFieldDataType.Integer:
                if (numericValue is null)
                {
                    return MissingValue(key, dataType);
                }

                if (numericValue.Value != Math.Truncate(numericValue.Value))
                {
                    return Error.Validation(
                        "Record.Value.NotAnInteger",
                        $"Field '{key}' is an Integer field; '{numericValue}' is not a whole number.");
                }

                return new RecordValue(key, numericValue, null, null);

            case ProductionFieldDataType.Boolean:
                if (booleanValue is null)
                {
                    return MissingValue(key, dataType);
                }

                return new RecordValue(key, null, booleanValue, null);

            case ProductionFieldDataType.Date:
                if (dateValue is null)
                {
                    return MissingValue(key, dataType);
                }

                return new RecordValue(key, null, null, dateValue);

            default:
                return Error.Validation(
                    "Record.Value.UnknownDataType", $"Unknown DataType '{dataType}' for field '{key}'.");
        }
    }

    private static Error MissingValue(string propertyName, ProductionFieldDataType dataType) =>
        Error.Validation(
            "Record.Value.Missing", $"Field '{propertyName}' requires a {dataType} value.");
}
