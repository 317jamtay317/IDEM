using ErrorOr;
using RecordKeeping.Application.ProductionFields;
using RecordKeeping.Domain.ProductionFields;
using Shouldly;

namespace RecordKeeping.Application.Tests.ProductionFields;

public class RetireProductionFieldHandlerTests
{
    [Fact]
    public async Task Handle_RetiresField()
    {
        var repository = new FakeProductionFieldRepository();
        var field = ProductionField.Create("HotMix", "Hot Mix", ProductionFieldDataType.Decimal).Value;
        repository.Seed(field);

        var result = await RetireProductionFieldHandler.Handle(
            new RetireProductionFieldCommand(field.Id), repository, CancellationToken.None);

        result.IsError.ShouldBeFalse();
        result.Value.IsActive.ShouldBeFalse();
        repository.SaveChangesCount.ShouldBe(1);
    }

    [Fact]
    public async Task Handle_WhenNotFound_ReturnsNotFound()
    {
        var repository = new FakeProductionFieldRepository();

        var result = await RetireProductionFieldHandler.Handle(
            new RetireProductionFieldCommand(Guid.NewGuid()), repository, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.NotFound);
        repository.SaveChangesCount.ShouldBe(0);
    }
}
