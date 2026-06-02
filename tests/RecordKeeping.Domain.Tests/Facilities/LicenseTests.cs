using RecordKeeping.Domain.Facilities;
using Shouldly;

namespace RecordKeeping.Domain.Tests.Facilities;

public class LicenseTests
{
    [Theory]
    [InlineData("123456789", "123456789", true)]
    [InlineData("123456789", "987654321", false)]
    public void Equals_ShouldReturnTrue_WhenValuesAreEqual(string licenseAValue, string licenseBValue, bool expectedResult)
    {
        //arrange
        var facilityId = Guid.NewGuid();
        var licenseA = License.Create(facilityId, DateOnly.FromDateTime(DateTime.Today.AddDays(1)), licenseAValue);
        var licenseB = License.Create(facilityId, DateOnly.FromDateTime(DateTime.Today.AddDays(1)), licenseBValue);
        
        //act
        var result = licenseA.Equals(licenseB);
        
        //assert
        result.ShouldBe(expectedResult);
    }
}