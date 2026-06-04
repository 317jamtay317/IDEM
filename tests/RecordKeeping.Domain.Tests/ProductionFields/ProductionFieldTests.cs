using ErrorOr;
using RecordKeeping.Domain.ProductionFields;
using Shouldly;

namespace RecordKeeping.Domain.Tests.ProductionFields;

public class ProductionFieldTests
{
    [Fact]
    [Trait("Invariant", "I-D19")]
    public void Create_WithValidValues_ReturnsProductionField()
    {
        var result = ProductionField.Create("HotMix", "Hot Mix", ProductionFieldDataType.Decimal);

        result.IsError.ShouldBeFalse();
        var field = result.Value;
        field.Id.ShouldNotBe(Guid.Empty);
        field.PropertyName.ShouldBe("HotMix");
        field.FriendlyName.ShouldBe("Hot Mix");
        field.DataType.ShouldBe(ProductionFieldDataType.Decimal);
        field.IsActive.ShouldBeTrue();
    }

    [Fact]
    public void Create_WithoutOptionalMetadata_DefaultsAreEmpty()
    {
        var field = ProductionField.Create("HotMix", "Hot Mix", ProductionFieldDataType.Decimal).Value;

        field.Description.ShouldBeNull();
        field.Category.ShouldBeNull();
        field.IsSummary.ShouldBeFalse();
        field.DisplayOrder.ShouldBe(0);
    }

    [Fact]
    public void Create_WithOptionalMetadata_SetsThem()
    {
        var result = ProductionField.Create(
            "HotMix",
            "Hot Mix",
            ProductionFieldDataType.Decimal,
            description: "Hot mix asphalt produced, in tons.",
            category: "Mixes",
            isSummary: true,
            displayOrder: 5);

        result.IsError.ShouldBeFalse();
        var field = result.Value;
        field.Description.ShouldBe("Hot mix asphalt produced, in tons.");
        field.Category.ShouldBe("Mixes");
        field.IsSummary.ShouldBeTrue();
        field.DisplayOrder.ShouldBe(5);
    }

    [Fact]
    public void Create_TrimsPropertyNameAndFriendlyName()
    {
        var result = ProductionField.Create("  HotMix  ", "  Hot Mix  ", ProductionFieldDataType.Decimal);

        result.IsError.ShouldBeFalse();
        result.Value.PropertyName.ShouldBe("HotMix");
        result.Value.FriendlyName.ShouldBe("Hot Mix");
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [Trait("Invariant", "I-D19")]
    public void Create_WithEmptyOrWhitespacePropertyName_ReturnsValidationError(string propertyName)
    {
        var result = ProductionField.Create(propertyName, "Hot Mix", ProductionFieldDataType.Decimal);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_WithEmptyOrWhitespaceFriendlyName_ReturnsValidationError(string friendlyName)
    {
        var result = ProductionField.Create("HotMix", friendlyName, ProductionFieldDataType.Decimal);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
    }

    [Fact]
    [Trait("Invariant", "I-D19")]
    public void Create_WithPropertyNameExceedingMaxLength_ReturnsValidationError()
    {
        var tooLong = new string('a', ProductionField.MaxPropertyNameLength + 1);

        var result = ProductionField.Create(tooLong, "Hot Mix", ProductionFieldDataType.Decimal);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
    }

    [Fact]
    public void Create_WithFriendlyNameExceedingMaxLength_ReturnsValidationError()
    {
        var tooLong = new string('a', ProductionField.MaxFriendlyNameLength + 1);

        var result = ProductionField.Create("HotMix", tooLong, ProductionFieldDataType.Decimal);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
    }

    [Fact]
    public void Update_ChangesEditableAttributes()
    {
        var field = ProductionField.Create("HotMix", "Hot Mix", ProductionFieldDataType.Decimal).Value;

        var result = field.Update(
            "Hot Mix (tons)",
            ProductionFieldDataType.Integer,
            description: "Updated description.",
            category: "Production",
            isSummary: true,
            displayOrder: 3);

        result.IsError.ShouldBeFalse();
        field.FriendlyName.ShouldBe("Hot Mix (tons)");
        field.DataType.ShouldBe(ProductionFieldDataType.Integer);
        field.Description.ShouldBe("Updated description.");
        field.Category.ShouldBe("Production");
        field.IsSummary.ShouldBeTrue();
        field.DisplayOrder.ShouldBe(3);
    }

    [Fact]
    public void Update_TrimsFriendlyName()
    {
        var field = ProductionField.Create("HotMix", "Hot Mix", ProductionFieldDataType.Decimal).Value;

        field.Update("  Warm Mix  ", ProductionFieldDataType.Decimal, null, null, false, 0);

        field.FriendlyName.ShouldBe("Warm Mix");
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Update_WithEmptyOrWhitespaceFriendlyName_ReturnsValidationError(string friendlyName)
    {
        var field = ProductionField.Create("HotMix", "Hot Mix", ProductionFieldDataType.Decimal).Value;

        var result = field.Update(friendlyName, ProductionFieldDataType.Decimal, null, null, false, 0);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
    }

    [Fact]
    public void Update_NormalizesBlankDescriptionAndCategoryToNull()
    {
        var field = ProductionField
            .Create("HotMix", "Hot Mix", ProductionFieldDataType.Decimal, description: "x", category: "y")
            .Value;

        field.Update("Hot Mix", ProductionFieldDataType.Decimal, "   ", "   ", false, 0);

        field.Description.ShouldBeNull();
        field.Category.ShouldBeNull();
    }

    [Fact]
    [Trait("Invariant", "I-D19")]
    public void Update_DoesNotChangePropertyName()
    {
        var field = ProductionField.Create("HotMix", "Hot Mix", ProductionFieldDataType.Decimal).Value;

        field.Update("Renamed", ProductionFieldDataType.Integer, null, null, true, 9);

        // I-D19: PropertyName is the immutable key; editing the field never touches it.
        field.PropertyName.ShouldBe("HotMix");
    }

    [Fact]
    public void Retire_SetsFieldInactive()
    {
        var field = ProductionField.Create("HotMix", "Hot Mix", ProductionFieldDataType.Decimal).Value;

        field.Retire();

        field.IsActive.ShouldBeFalse();
    }

    [Fact]
    public void Reactivate_SetsFieldActive()
    {
        var field = ProductionField.Create("HotMix", "Hot Mix", ProductionFieldDataType.Decimal).Value;
        field.Retire();

        field.Reactivate();

        field.IsActive.ShouldBeTrue();
    }
}
