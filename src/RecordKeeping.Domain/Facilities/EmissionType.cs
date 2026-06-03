namespace RecordKeeping.Domain.Facilities;

/// <summary>
/// The pollutant a <see cref="MonthlyLimit"/> constrains. The v1 set is the air-emission
/// pollutants tracked for asphalt plants (see UbiquitousLanguage "Emission Type"); a Monthly
/// Limit is always expressed in tons per calendar month of one of these.
/// </summary>
public enum EmissionType
{
    /// <summary>Volatile organic compounds.</summary>
    VOC,

    /// <summary>Hydrogen chloride.</summary>
    HCl,

    /// <summary>Sulfur dioxide.</summary>
    SO2,

    /// <summary>Oxides of nitrogen.</summary>
    NOx,

    /// <summary>Carbon dioxide.</summary>
    CO2,
}
