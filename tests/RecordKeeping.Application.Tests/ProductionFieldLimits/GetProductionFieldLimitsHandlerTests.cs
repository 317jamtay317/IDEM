using RecordKeeping.Application.ProductionFieldLimits;
using RecordKeeping.Domain.ProductionFieldLimits;
using Shouldly;

namespace RecordKeeping.Application.Tests.ProductionFieldLimits;

public class GetProductionFieldLimitsHandlerTests
{
    [Fact]
    [Trait("Invariant", "I-D03")]
    public async Task Handle_ReturnsOnlyTheCallersOrgLimits()
    {
        var orgA = Guid.NewGuid();
        var orgB = Guid.NewGuid();
        var limits = new FakeProductionFieldLimitRepository();
        limits.Seed(ProductionFieldLimit.Create(orgA, "HotMix", 0m, 100m, LimitUnit.Tons).Value);
        limits.Seed(ProductionFieldLimit.Create(orgB, "ColdMix", 0m, 50m, LimitUnit.Tons).Value);

        var result = await GetProductionFieldLimitsHandler.Handle(
            new GetProductionFieldLimitsQuery(orgA), limits, CancellationToken.None);

        result.IsError.ShouldBeFalse();
        result.Value.Count.ShouldBe(1);
        result.Value.ShouldAllBe(l => l.PropertyName == "HotMix");
    }

    [Fact]
    public async Task Handle_WhenNoLimits_ReturnsEmpty()
    {
        var result = await GetProductionFieldLimitsHandler.Handle(
            new GetProductionFieldLimitsQuery(Guid.NewGuid()),
            new FakeProductionFieldLimitRepository(),
            CancellationToken.None);

        result.IsError.ShouldBeFalse();
        result.Value.ShouldBeEmpty();
    }
}
