using ErrorOr;
using RecordKeeping.Domain.ProductionFieldLimits;
using Shouldly;

namespace RecordKeeping.Domain.Tests.ProductionFieldLimits;

public class ProductionFieldLimitTests
{
    private const string Property = "PercentSulfurNumber2";

    [Fact]
    public void Create_WithValidValues_ReturnsLimit()
    {
        var orgId = Guid.NewGuid();

        var result = ProductionFieldLimit.Create(
            orgId, Property, lowLimit: 0m, highLimit: 2m, LimitUnit.Percentage);

        result.IsError.ShouldBeFalse();
        var limit = result.Value;
        limit.Id.ShouldNotBe(Guid.Empty);
        limit.OrgId.ShouldBe(orgId);
        limit.PropertyName.ShouldBe(Property);
        limit.LowLimit.ShouldBe(0m);
        limit.HighLimit.ShouldBe(2m);
        limit.Unit.ShouldBe(LimitUnit.Percentage);
    }

    [Fact]
    public void Create_WithEqualLowAndHighLimits_ReturnsLimit()
    {
        var result = ProductionFieldLimit.Create(
            Guid.NewGuid(), Property, lowLimit: 5m, highLimit: 5m, LimitUnit.Tons);

        result.IsError.ShouldBeFalse();
    }

    [Fact]
    [Trait("Invariant", "I-D25")]
    public void Create_WithLowLimitAboveHighLimit_ReturnsValidationError()
    {
        var result = ProductionFieldLimit.Create(
            Guid.NewGuid(), Property, lowLimit: 3m, highLimit: 2m, LimitUnit.Tons);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
        result.FirstError.Code.ShouldBe("I-D25");
    }

    [Fact]
    public void Create_WithEmptyOrgId_ReturnsValidationError()
    {
        var result = ProductionFieldLimit.Create(
            Guid.Empty, Property, lowLimit: 0m, highLimit: 2m, LimitUnit.Percentage);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
    }

    [Fact]
    public void Create_WithBlankPropertyName_ReturnsValidationError()
    {
        var result = ProductionFieldLimit.Create(
            Guid.NewGuid(), "   ", lowLimit: 0m, highLimit: 2m, LimitUnit.Percentage);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
    }

    [Fact]
    public void Create_TrimsPropertyName()
    {
        var result = ProductionFieldLimit.Create(
            Guid.NewGuid(), "  HotMix  ", lowLimit: 0m, highLimit: 2m, LimitUnit.Tons);

        result.Value.PropertyName.ShouldBe("HotMix");
    }

    [Fact]
    public void Update_WithNewValues_ChangesBoundsAndUnit()
    {
        var limit = ProductionFieldLimit.Create(
            Guid.NewGuid(), Property, lowLimit: 0m, highLimit: 2m, LimitUnit.Percentage).Value;

        var result = limit.Update(lowLimit: 1m, highLimit: 5m, LimitUnit.Tons);

        result.IsError.ShouldBeFalse();
        limit.LowLimit.ShouldBe(1m);
        limit.HighLimit.ShouldBe(5m);
        limit.Unit.ShouldBe(LimitUnit.Tons);
    }

    [Fact]
    [Trait("Invariant", "I-D25")]
    public void Update_WithLowLimitAboveHighLimit_ReturnsErrorAndDoesNotMutate()
    {
        var limit = ProductionFieldLimit.Create(
            Guid.NewGuid(), Property, lowLimit: 0m, highLimit: 2m, LimitUnit.Percentage).Value;

        var result = limit.Update(lowLimit: 9m, highLimit: 1m, LimitUnit.Tons);

        result.IsError.ShouldBeTrue();
        result.FirstError.Code.ShouldBe("I-D25");
        limit.LowLimit.ShouldBe(0m);
        limit.HighLimit.ShouldBe(2m);
        limit.Unit.ShouldBe(LimitUnit.Percentage);
    }
}
