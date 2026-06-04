using ErrorOr;
using RecordKeeping.Application.ProductionFields;
using RecordKeeping.Domain.ProductionFields;
using Shouldly;

namespace RecordKeeping.Application.Tests.ProductionFields;

public class CreateProductionFieldHandlerTests
{
    [Fact]
    public async Task Handle_WithValidValues_PersistsAndReturnsField()
    {
        var repository = new FakeProductionFieldRepository();

        var result = await CreateProductionFieldHandler.Handle(
            new CreateProductionFieldCommand(
                "HotMix", "Hot Mix", ProductionFieldDataType.Decimal, "Tons of hot mix.", "Mixes", true, 1),
            repository,
            CancellationToken.None);

        result.IsError.ShouldBeFalse();
        var field = result.Value;
        field.Id.ShouldNotBe(Guid.Empty);
        field.PropertyName.ShouldBe("HotMix");
        field.FriendlyName.ShouldBe("Hot Mix");
        field.DataType.ShouldBe(ProductionFieldDataType.Decimal);
        field.Description.ShouldBe("Tons of hot mix.");
        field.Category.ShouldBe("Mixes");
        field.IsSummary.ShouldBeTrue();
        field.DisplayOrder.ShouldBe(1);
        field.IsActive.ShouldBeTrue();
        repository.Stored.ShouldContain(f => f.PropertyName == "HotMix");
        repository.SaveChangesCount.ShouldBe(1);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Handle_WithInvalidPropertyName_ReturnsValidationErrorAndDoesNotPersist(string propertyName)
    {
        var repository = new FakeProductionFieldRepository();

        var result = await CreateProductionFieldHandler.Handle(
            new CreateProductionFieldCommand(
                propertyName, "Hot Mix", ProductionFieldDataType.Decimal, null, null, false, 0),
            repository,
            CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
        repository.SaveChangesCount.ShouldBe(0);
    }

    [Fact]
    [Trait("Invariant", "I-D19")]
    public async Task Handle_WithDuplicatePropertyName_ReturnsConflictAndDoesNotPersist()
    {
        var repository = new FakeProductionFieldRepository();
        repository.Seed(ProductionField.Create("HotMix", "Hot Mix", ProductionFieldDataType.Decimal).Value);

        var result = await CreateProductionFieldHandler.Handle(
            new CreateProductionFieldCommand(
                "hotmix", "Hot Mix (renamed)", ProductionFieldDataType.Decimal, null, null, false, 0),
            repository,
            CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Conflict);
        repository.SaveChangesCount.ShouldBe(0);
    }

    [Fact]
    [Trait("Invariant", "I-D20")]
    public async Task Handle_WithDuplicateActiveFriendlyName_ReturnsConflictAndDoesNotPersist()
    {
        var repository = new FakeProductionFieldRepository();
        repository.Seed(ProductionField.Create("HotMix", "Hot Mix", ProductionFieldDataType.Decimal).Value);

        var result = await CreateProductionFieldHandler.Handle(
            new CreateProductionFieldCommand(
                "ColdMix", "hot mix", ProductionFieldDataType.Decimal, null, null, false, 0),
            repository,
            CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Conflict);
        repository.SaveChangesCount.ShouldBe(0);
    }

    [Fact]
    [Trait("Invariant", "I-D20")]
    public async Task Handle_WithFriendlyNameMatchingRetiredField_IsAllowed()
    {
        var repository = new FakeProductionFieldRepository();
        var retired = ProductionField.Create("OldHotMix", "Hot Mix", ProductionFieldDataType.Decimal).Value;
        retired.Retire();
        repository.Seed(retired);

        var result = await CreateProductionFieldHandler.Handle(
            new CreateProductionFieldCommand(
                "HotMix", "Hot Mix", ProductionFieldDataType.Decimal, null, null, false, 0),
            repository,
            CancellationToken.None);

        result.IsError.ShouldBeFalse();
        repository.SaveChangesCount.ShouldBe(1);
    }
}
