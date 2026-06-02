using RecordKeeping.Domain.Common;

namespace RecordKeeping.Domain.Facilities;

public class MonthlyLimit(Guid facilityId, double value, string emissionName) : ValueObject
{
    /// <summary>
    /// Creates an instance of a <see cref="MonthlyLimit"/> representing a limit defined in tons for a specific facility.
    /// </summary>
    /// <param name="limit">The limit value in tons.</param>
    /// <param name="facilityId">The unique identifier of the facility.</param>
    /// <returns>A new <see cref="MonthlyLimit"/> instance with the specified limit in tons for the given facility.</returns>
    public static MonthlyLimit Tons(double limit, Guid facilityId) =>
        new(facilityId, limit, "Tons");

    /// <summary>
    /// Creates an instance of a <see cref="MonthlyLimit"/> representing a limit defined in fuel units for a specific facility.
    /// </summary>
    /// <param name="limit">The limit value in fuel units.</param>
    /// <param name="facilityId">The unique identifier of the facility.</param>
    /// <returns>A new <see cref="MonthlyLimit"/> instance with the specified limit in fuel units for the given facility.</returns>
    public static MonthlyLimit FUEL(double limit, Guid facilityId) =>
        new(facilityId, limit, "FUEL");

    /// <summary>
    /// Creates an instance of a <see cref="MonthlyLimit"/> representing a limit defined in volatile organic compounds (Voc) for a specific facility.
    /// </summary>
    /// <param name="limit">The limit value in volatile organic compounds (Voc).</param>
    /// <param name="facilityId">The unique identifier of the facility.</param>
    /// <returns>A new <see cref="MonthlyLimit"/> instance with the specified limit in volatile organic compounds (Voc) for the given facility.</returns>
    public static MonthlyLimit Voc(double limit, Guid facilityId) =>
        new(facilityId, limit, "Voc");

    /// <summary>
    /// Creates an instance of a <see cref="MonthlyLimit"/> representing a limit defined in HCl emissions for a specific facility.
    /// </summary>
    /// <param name="limit">The limit value in HCl emissions.</param>
    /// <param name="facilityId">The unique identifier of the facility.</param>
    /// <returns>A new <see cref="MonthlyLimit"/> instance with the specified HCl emissions limit for the given facility.</returns>
    public static MonthlyLimit HCl(double limit, Guid facilityId) =>
        new(facilityId, limit, "HCl");

    /// <summary>
    /// Creates an instance of a <see cref="MonthlyLimit"/> representing a limit defined for sulfur dioxide (SO2) emissions for a specific facility.
    /// </summary>
    /// <param name="limit">The limit value for SO2 emissions.</param>
    /// <param name="facilityId">The unique identifier of the facility.</param>
    /// <returns>A new <see cref="MonthlyLimit"/> instance with the specified SO2 limit for the given facility.</returns>
    public static MonthlyLimit SO2(double limit, Guid facilityId) =>
        new(facilityId, limit, "SO2");

    /// <summary>
    /// Creates an instance of a <see cref="MonthlyLimit"/> representing a limit defined in NOx emissions for a specific facility.
    /// </summary>
    /// <param name="limit">The limit value in NOx emissions.</param>
    /// <param name="facilityId">The unique identifier of the facility.</param>
    /// <returns>A new <see cref="MonthlyLimit"/> instance with the specified limit in NOx emissions for the given facility.</returns>
    public static MonthlyLimit NOx(double limit, Guid facilityId) =>
        new(facilityId, limit, "NOx");

    /// <summary>
    /// Creates an instance of a <see cref="MonthlyLimit"/> representing a limit defined in CO2 emissions for a specific facility.
    /// </summary>
    /// <param name="limit">The limit value for CO2 emissions.</param>
    /// <param name="facilityId">The unique identifier of the facility.</param>
    /// <returns>A new <see cref="MonthlyLimit"/> instance with the specified CO2 emission limit for the given facility.</returns>
    public static MonthlyLimit CO2(double limit, Guid facilityId) =>
        new(facilityId, limit, "CO2");

    /// <summary>
    /// Gets the unique identifier of the facility associated with this instance of <see cref="MonthlyLimit"/>.
    /// </summary>
    /// <remarks>
    /// The <c>FacilityId</c> property uniquely identifies the facility to which the monthly limit applies.
    /// It helps in associating a specific monthly limit with a corresponding facility in the system.
    /// </remarks>
    public Guid FacilityId { get; private set; } = facilityId;

    /// <summary>
    /// Gets the numerical value representing the defined monthly limit for a specific facility.
    /// </summary>
    /// <remarks>
    /// The <c>Value</c> property specifies the magnitude of the monthly limit, typically expressed in units such as tons or fuel units.
    /// This value is used to enforce restrictions on emissions or other measurable outputs for the associated facility.
    /// </remarks>
    public double Value { get; private set; } = value;

    /// <summary>
    /// Gets the name of the emission type associated with this instance of <see cref="MonthlyLimit"/>.
    /// </summary>
    /// <remarks>
    /// The <c>EmissionName</c> property represents the specific type of emission, such as "Tons", "FUEL",
    /// "Voc", "HCl", "SO2", "NOx", or "CO2". It identifies the category of the emission for which the monthly
    /// limit is defined, enabling precise tracking and management of emission types within the system.
    /// </remarks>
    public string EmissionName { get; private set; } = emissionName;
    
    /// <inheritdoc/>
    protected override IEnumerable<object?> GetEqualityComponents()
    {
        yield return FacilityId;
        yield return Value;
        yield return EmissionName;
    }
}