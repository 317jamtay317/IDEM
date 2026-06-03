using ErrorOr;
using RecordKeeping.Domain.Facilities;
using Shouldly;

namespace RecordKeeping.Domain.Tests.Facilities;

public class MonthlyLimitTests
{
    [Fact]
    public void Create_WithPositiveValue_ReturnsLimit()
    {
        var facilityId = Guid.NewGuid();

        var result = MonthlyLimit.Create(facilityId, EmissionType.VOC, 12.5);

        result.IsError.ShouldBeFalse();
        var limit = result.Value;
        limit.FacilityId.ShouldBe(facilityId);
        limit.EmissionType.ShouldBe(EmissionType.VOC);
        limit.Value.ShouldBe(12.5);
    }

    [Theory]
    [Trait("Invariant", "I-D20")]
    [InlineData(0)]
    [InlineData(-0.1)]
    [InlineData(-5)]
    public void Create_WithNonPositiveValue_ReturnsValidationError(double tons)
    {
        var result = MonthlyLimit.Create(Guid.NewGuid(), EmissionType.NOx, tons);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
        result.FirstError.ShouldBe(FacilityErrors.LimitValueMustBePositive);
    }

    [Fact]
    public void Equals_WithSameComponents_AreEqual()
    {
        var facilityId = Guid.NewGuid();

        var a = MonthlyLimit.Create(facilityId, EmissionType.SO2, 3).Value;
        var b = MonthlyLimit.Create(facilityId, EmissionType.SO2, 3).Value;

        a.ShouldBe(b);
    }

    [Fact]
    public void Equals_WithDifferentValue_AreNotEqual()
    {
        var facilityId = Guid.NewGuid();

        var a = MonthlyLimit.Create(facilityId, EmissionType.SO2, 3).Value;
        var b = MonthlyLimit.Create(facilityId, EmissionType.SO2, 4).Value;

        a.ShouldNotBe(b);
    }

    [Fact]
    public void Equals_WithDifferentEmissionType_AreNotEqual()
    {
        var facilityId = Guid.NewGuid();

        var a = MonthlyLimit.Create(facilityId, EmissionType.SO2, 3).Value;
        var b = MonthlyLimit.Create(facilityId, EmissionType.CO2, 3).Value;

        a.ShouldNotBe(b);
    }
}
