using RecordKeeping.Domain.Common;

namespace RecordKeeping.Domain.Facilities;

public class Address(string street, string city, string state, string zip) : ValueObject
{
    /// <summary>
    /// Gets the street name of the address.
    /// </summary>
    /// <remarks>
    /// This property represents the street component of a physical address. It is immutable
    /// and initialized through the constructor of the <c>Address</c> class. Changes to the value
    /// require creating a new <c>Address</c> instance.
    /// </remarks>
    public string Street { get; private set; } = street;

    /// <summary>
    /// Gets the city name of the address.
    /// </summary>
    /// <remarks>
    /// This property specifies the city component of a physical address. It is a required field
    /// that is initialized through the constructor of the <c>Address</c> class. Any modification
    /// to this value involves creating a new instance of the <c>Address</c> class to ensure immutability.
    /// </remarks>
    public string City { get; private set; } = city;

    /// <summary>
    /// Gets the state component of the address.
    /// </summary>
    /// <remarks>
    /// This property represents the state or province associated with the address.
    /// It is immutable and initialized through the constructor of the <c>Address</c> class.
    /// Modifying the value requires creating a new <c>Address</c> instance.
    /// </remarks>
    public string State { get; private set; } = state;

    /// <summary>
    /// Gets the postal code of the address.
    /// </summary>
    /// <remarks>
    /// This property represents the ZIP or postal code component of a physical address. It is immutable
    /// and initialized through the constructor of the <c>Address</c> class. Any changes to the value
    /// require creating a new <c>Address</c> instance.
    /// </remarks>
    public string Zip { get; private set; } = zip;
    protected override IEnumerable<object?> GetEqualityComponents()
    {
        yield return Street;
        yield return City;
        yield return State;
        yield return Zip;
    }
}