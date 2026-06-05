using RecordKeeping.Application.ProductionFields;
using RecordKeeping.Domain.ProductionFields;
using Shouldly;

namespace RecordKeeping.Application.Tests.ProductionFields;

public class GetProductionFieldsHandlerTests
{
    private static ProductionField Field(string propertyName, string friendlyName, int order, bool retire = false)
    {
        var field = ProductionField
            .Create(propertyName, friendlyName, ProductionFieldDataType.Decimal, displayOrder: order)
            .Value;
        if (retire)
        {
            field.Retire();
        }

        return field;
    }

    [Fact]
    public async Task Handle_WhenNotIncludingRetired_ReturnsOnlyActive()
    {
        var repository = new FakeProductionFieldRepository();
        repository.Seed(Field("HotMix", "Hot Mix", 0));
        repository.Seed(Field("OldMix", "Old Mix", 1, retire: true));

        var result = await GetProductionFieldsHandler.Handle(
            new GetProductionFieldsQuery(IncludeRetired: false), repository, CancellationToken.None);

        result.ShouldHaveSingleItem().PropertyName.ShouldBe("HotMix");
    }

    [Fact]
    public async Task Handle_WhenIncludingRetired_ReturnsAll()
    {
        var repository = new FakeProductionFieldRepository();
        repository.Seed(Field("HotMix", "Hot Mix", 0));
        repository.Seed(Field("OldMix", "Old Mix", 1, retire: true));

        var result = await GetProductionFieldsHandler.Handle(
            new GetProductionFieldsQuery(IncludeRetired: true), repository, CancellationToken.None);

        result.Count.ShouldBe(2);
    }

    [Fact]
    public async Task Handle_OrdersByDisplayOrderThenFriendlyName()
    {
        var repository = new FakeProductionFieldRepository();
        repository.Seed(Field("C", "Cold Mix", 2));
        repository.Seed(Field("A", "Aggregate", 1));
        repository.Seed(Field("B", "Blast Furnace", 1));

        var result = await GetProductionFieldsHandler.Handle(
            new GetProductionFieldsQuery(IncludeRetired: false), repository, CancellationToken.None);

        result.Select(f => f.PropertyName).ShouldBe(["A", "B", "C"]);
    }
}
