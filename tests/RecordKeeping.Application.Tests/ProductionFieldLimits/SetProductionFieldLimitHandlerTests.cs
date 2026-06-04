using ErrorOr;
using RecordKeeping.Application.ProductionFieldLimits;
using RecordKeeping.Application.Tests.ProductionFields;
using RecordKeeping.Domain.ProductionFieldLimits;
using RecordKeeping.Domain.ProductionFields;
using Shouldly;

namespace RecordKeeping.Application.Tests.ProductionFieldLimits;

public class SetProductionFieldLimitHandlerTests
{
    private const string Property = "PercentSulfurNumber2";

    private sealed record Context(
        Guid OrgId,
        FakeProductionFieldLimitRepository Limits,
        FakeProductionFieldRepository Fields);

    private static Context Arrange()
    {
        var fields = new FakeProductionFieldRepository();
        fields.Seed(ProductionField.Create(Property, "% Sulfur #2", ProductionFieldDataType.Decimal).Value);
        return new Context(Guid.NewGuid(), new FakeProductionFieldLimitRepository(), fields);
    }

    [Fact]
    public async Task Handle_WhenNoLimitExists_CreatesAndPersists()
    {
        var ctx = Arrange();
        var command = new SetProductionFieldLimitCommand(
            ctx.OrgId, Property, LowLimit: 0m, HighLimit: 2m, LimitUnit.Percentage);

        var result = await SetProductionFieldLimitHandler.Handle(
            command, ctx.Limits, ctx.Fields, CancellationToken.None);

        result.IsError.ShouldBeFalse();
        result.Value.PropertyName.ShouldBe(Property);
        result.Value.LowLimit.ShouldBe(0m);
        result.Value.HighLimit.ShouldBe(2m);
        result.Value.Unit.ShouldBe(LimitUnit.Percentage);
        ctx.Limits.Stored.ShouldContain(l => l.OrgId == ctx.OrgId && l.PropertyName == Property);
        ctx.Limits.SaveChangesCount.ShouldBe(1);
    }

    [Fact]
    [Trait("Invariant", "I-D24")]
    public async Task Handle_WhenLimitAlreadyExists_UpdatesInPlaceWithoutDuplicating()
    {
        var ctx = Arrange();
        ctx.Limits.Seed(ProductionFieldLimit.Create(ctx.OrgId, Property, 0m, 2m, LimitUnit.Percentage).Value);
        var command = new SetProductionFieldLimitCommand(
            ctx.OrgId, Property, LowLimit: 1m, HighLimit: 3m, LimitUnit.Tons);

        var result = await SetProductionFieldLimitHandler.Handle(
            command, ctx.Limits, ctx.Fields, CancellationToken.None);

        result.IsError.ShouldBeFalse();
        result.Value.LowLimit.ShouldBe(1m);
        result.Value.HighLimit.ShouldBe(3m);
        result.Value.Unit.ShouldBe(LimitUnit.Tons);
        // I-D24: one limit per Org per Production Field — updated, never duplicated.
        ctx.Limits.Stored.Count.ShouldBe(1);
        ctx.Limits.Stored.ShouldAllBe(l => l.LowLimit == 1m && l.HighLimit == 3m && l.Unit == LimitUnit.Tons);
    }

    [Fact]
    public async Task Handle_NormalizesPropertyNameToCatalogCasing()
    {
        var ctx = Arrange();
        var command = new SetProductionFieldLimitCommand(
            ctx.OrgId, "percentsulfurnumber2", LowLimit: 0m, HighLimit: 2m, LimitUnit.Percentage);

        var result = await SetProductionFieldLimitHandler.Handle(
            command, ctx.Limits, ctx.Fields, CancellationToken.None);

        result.IsError.ShouldBeFalse();
        result.Value.PropertyName.ShouldBe(Property);
    }

    [Fact]
    public async Task Handle_WithUnknownField_ReturnsValidationErrorAndDoesNotPersist()
    {
        var ctx = Arrange();
        var command = new SetProductionFieldLimitCommand(
            ctx.OrgId, "NotARealField", LowLimit: 0m, HighLimit: 2m, LimitUnit.Tons);

        var result = await SetProductionFieldLimitHandler.Handle(
            command, ctx.Limits, ctx.Fields, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
        ctx.Limits.SaveChangesCount.ShouldBe(0);
    }

    [Fact]
    [Trait("Invariant", "I-D25")]
    public async Task Handle_WhenCreatingWithLowAboveHigh_ReturnsValidationErrorAndDoesNotPersist()
    {
        var ctx = Arrange();
        var command = new SetProductionFieldLimitCommand(
            ctx.OrgId, Property, LowLimit: 5m, HighLimit: 1m, LimitUnit.Percentage);

        var result = await SetProductionFieldLimitHandler.Handle(
            command, ctx.Limits, ctx.Fields, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Code.ShouldBe("I-D25");
        ctx.Limits.SaveChangesCount.ShouldBe(0);
    }

    [Fact]
    [Trait("Invariant", "I-D25")]
    public async Task Handle_WhenUpdatingExistingLimitWithLowAboveHigh_ReturnsErrorAndLeavesItUnchanged()
    {
        var ctx = Arrange();
        ctx.Limits.Seed(ProductionFieldLimit.Create(ctx.OrgId, Property, 0m, 2m, LimitUnit.Percentage).Value);
        var command = new SetProductionFieldLimitCommand(
            ctx.OrgId, Property, LowLimit: 9m, HighLimit: 1m, LimitUnit.Tons);

        var result = await SetProductionFieldLimitHandler.Handle(
            command, ctx.Limits, ctx.Fields, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Code.ShouldBe("I-D25");
        ctx.Limits.SaveChangesCount.ShouldBe(0);
        // The existing limit is left exactly as it was.
        var stored = ctx.Limits.Stored.ShouldHaveSingleItem();
        stored.LowLimit.ShouldBe(0m);
        stored.HighLimit.ShouldBe(2m);
        stored.Unit.ShouldBe(LimitUnit.Percentage);
    }
}
