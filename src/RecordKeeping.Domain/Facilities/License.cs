using RecordKeeping.Domain.Common;

namespace RecordKeeping.Domain.Facilities;

public class License(Guid id, Guid facilityId, DateOnly expirationDate, string value) : Entity<Guid>(id), IEquatable<License>
{
    /// <summary>
    /// Gets the unique identifier of the plant associated with this license.
    /// </summary>
    /// <remarks>
    /// This property establishes a link between the license and the plant it is issued for.
    /// It is assigned during initialization and cannot be modified thereafter.
    /// </remarks>
    public Guid FacilityId { get; private set; } = facilityId;

    /// <summary>
    /// Gets the expiration date of the license.
    /// </summary>
    /// <remarks>
    /// This property represents the date when the validity of the license ends.
    /// It is assigned during construction of the license object and cannot be modified thereafter.
    /// </remarks>
    public DateOnly ExpirationDate { get; private set; } = expirationDate;

    /// <summary>
    /// Gets the value associated with this license.
    /// </summary>
    /// <remarks>
    /// This property represents the key information of the license, such as a license code or value.
    /// It is assigned during initialization and cannot be modified thereafter.
    /// </remarks>
    public string Value { get; private set; } = value;
    
    public static License Create( Guid facilityId, DateOnly expirationDate, string licenseValue, Guid? id = null)
    {
        return new License(id?? Guid.NewGuid(), facilityId, expirationDate, licenseValue);
    }
    
    public bool Equals(License? other)
    {
        return other is not null && Value == other.Value;
    }
}