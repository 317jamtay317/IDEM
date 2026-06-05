namespace RecordKeeping.Domain.ProductionFields;

/// <summary>
/// The kind of value a <see cref="ProductionField"/> captures on a Record. Carried over from the
/// value kinds of the legacy plant-pollution record.
/// </summary>
public enum ProductionFieldDataType
{
    /// <summary>A fractional numeric value (e.g. tons of mix, a percentage, BTU per gallon).</summary>
    Decimal,

    /// <summary>A whole-number value (e.g. a temperature reading).</summary>
    Integer,

    /// <summary>A yes/no flag (e.g. whether the plant operated that day).</summary>
    Boolean,

    /// <summary>A calendar date or date-time value (e.g. a shift reading time).</summary>
    Date,
}
