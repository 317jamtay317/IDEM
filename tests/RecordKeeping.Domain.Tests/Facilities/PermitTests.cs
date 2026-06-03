using RecordKeeping.Domain.Facilities;
using Shouldly;

namespace RecordKeeping.Domain.Tests.Facilities;

public class PermitTests
{
    [Theory]
    [InlineData("123456789", "123456789", true)]
    [InlineData("123456789", "987654321", false)]
    public void Equals_ShouldReturnTrue_WhenValuesAreEqual(string permitAValue, string permitBValue, bool expectedResult)
    {
        //arrange
        var facilityId = Guid.NewGuid();
        var permitA = Permit.Create(facilityId, DateOnly.FromDateTime(DateTime.Today.AddDays(1)), permitAValue);
        var permitB = Permit.Create(facilityId, DateOnly.FromDateTime(DateTime.Today.AddDays(1)), permitBValue);

        //act
        var result = permitA.Equals(permitB);

        //assert
        result.ShouldBe(expectedResult);
    }
}
