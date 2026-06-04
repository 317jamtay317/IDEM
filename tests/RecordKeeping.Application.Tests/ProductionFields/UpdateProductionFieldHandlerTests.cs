using ErrorOr;
using RecordKeeping.Application.ProductionFields;
using RecordKeeping.Domain.ProductionFields;
using Shouldly;

namespace RecordKeeping.Application.Tests.ProductionFields;

public class UpdateProductionFieldHandlerTests
{
    private static ProductionField Seeded(string propertyName = "HotMix", string friendlyName = "Hot Mix") =>
        ProductionField.Create(propertyName, friendlyName, ProductionFieldDataType.Decimal).Value;

    [Fact]
    public async Task Handle_WithValidChanges_UpdatesAndReturns()
    {
        var repository = new FakeProductionFieldRepository();
        var field = Seeded();
        repository.Seed(field);

        var result = await UpdateProductionFieldHandler.Handle(
            new UpdateProductionFieldCommand(
                field.Id, "Hot Mix (tons)", ProductionFieldDataType.Integer, "desc", "Mixes", true, 4),
            repository,
            CancellationToken.None);

        result.IsError.ShouldBeFalse();
        result.Value.FriendlyName.ShouldBe("Hot Mix (tons)");
        result.Value.DataType.ShouldBe(ProductionFieldDataType.Integer);
        result.Value.IsSummary.ShouldBeTrue();
        result.Value.DisplayOrder.ShouldBe(4);
        repository.SaveChangesCount.ShouldBe(1);
    }

    [Fact]
    public async Task Handle_WhenFieldNotFound_ReturnsNotFound()
    {
        var repository = new FakeProductionFieldRepository();

        var result = await UpdateProductionFieldHandler.Handle(
            new UpdateProductionFieldCommand(
                Guid.NewGuid(), "X", ProductionFieldDataType.Decimal, null, null, false, 0),
            repository,
            CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.NotFound);
        repository.SaveChangesCount.ShouldBe(0);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Handle_WithEmptyFriendlyName_ReturnsValidationError(string friendlyName)
    {
        var repository = new FakeProductionFieldRepository();
        var field = Seeded();
        repository.Seed(field);

        var result = await UpdateProductionFieldHandler.Handle(
            new UpdateProductionFieldCommand(
                field.Id, friendlyName, ProductionFieldDataType.Decimal, null, null, false, 0),
            repository,
            CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
        repository.SaveChangesCount.ShouldBe(0);
    }

    [Fact]
    [Trait("Invariant", "I-D22")]
    public async Task Handle_RenamingToAnotherActiveFieldsName_ReturnsConflict()
    {
        var repository = new FakeProductionFieldRepository();
        var hotMix = Seeded("HotMix", "Hot Mix");
        var coldMix = Seeded("ColdMix", "Cold Mix");
        repository.Seed(hotMix);
        repository.Seed(coldMix);

        var result = await UpdateProductionFieldHandler.Handle(
            new UpdateProductionFieldCommand(
                coldMix.Id, "Hot Mix", ProductionFieldDataType.Decimal, null, null, false, 0),
            repository,
            CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Conflict);
        repository.SaveChangesCount.ShouldBe(0);
    }

    [Fact]
    [Trait("Invariant", "I-D22")]
    public async Task Handle_KeepingItsOwnFriendlyName_Succeeds()
    {
        var repository = new FakeProductionFieldRepository();
        var field = Seeded("HotMix", "Hot Mix");
        repository.Seed(field);

        var result = await UpdateProductionFieldHandler.Handle(
            new UpdateProductionFieldCommand(
                field.Id, "Hot Mix", ProductionFieldDataType.Integer, null, "Mixes", false, 2),
            repository,
            CancellationToken.None);

        result.IsError.ShouldBeFalse();
        result.Value.Category.ShouldBe("Mixes");
        repository.SaveChangesCount.ShouldBe(1);
    }

    [Fact]
    [Trait("Invariant", "I-D21")]
    public async Task Handle_DoesNotChangePropertyName()
    {
        var repository = new FakeProductionFieldRepository();
        var field = Seeded("HotMix", "Hot Mix");
        repository.Seed(field);

        var result = await UpdateProductionFieldHandler.Handle(
            new UpdateProductionFieldCommand(
                field.Id, "Renamed", ProductionFieldDataType.Decimal, null, null, false, 0),
            repository,
            CancellationToken.None);

        result.IsError.ShouldBeFalse();
        result.Value.PropertyName.ShouldBe("HotMix");
    }
}
