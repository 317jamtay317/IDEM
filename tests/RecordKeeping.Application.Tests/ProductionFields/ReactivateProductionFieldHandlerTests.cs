using ErrorOr;
using RecordKeeping.Application.ProductionFields;
using RecordKeeping.Domain.ProductionFields;
using Shouldly;

namespace RecordKeeping.Application.Tests.ProductionFields;

public class ReactivateProductionFieldHandlerTests
{
    [Fact]
    public async Task Handle_ReactivatesField()
    {
        var repository = new FakeProductionFieldRepository();
        var field = ProductionField.Create("HotMix", "Hot Mix", ProductionFieldDataType.Decimal).Value;
        field.Retire();
        repository.Seed(field);

        var result = await ReactivateProductionFieldHandler.Handle(
            new ReactivateProductionFieldCommand(field.Id), repository, CancellationToken.None);

        result.IsError.ShouldBeFalse();
        result.Value.IsActive.ShouldBeTrue();
        repository.SaveChangesCount.ShouldBe(1);
    }

    [Fact]
    public async Task Handle_WhenNotFound_ReturnsNotFound()
    {
        var repository = new FakeProductionFieldRepository();

        var result = await ReactivateProductionFieldHandler.Handle(
            new ReactivateProductionFieldCommand(Guid.NewGuid()), repository, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.NotFound);
        repository.SaveChangesCount.ShouldBe(0);
    }

    [Fact]
    [Trait("Invariant", "I-D22")]
    public async Task Handle_WhenFriendlyNameClashesWithActiveField_ReturnsConflict()
    {
        var repository = new FakeProductionFieldRepository();
        var retired = ProductionField.Create("OldHotMix", "Hot Mix", ProductionFieldDataType.Decimal).Value;
        retired.Retire();
        var active = ProductionField.Create("HotMix", "Hot Mix", ProductionFieldDataType.Decimal).Value;
        repository.Seed(retired);
        repository.Seed(active);

        var result = await ReactivateProductionFieldHandler.Handle(
            new ReactivateProductionFieldCommand(retired.Id), repository, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Conflict);
        repository.SaveChangesCount.ShouldBe(0);
    }
}
