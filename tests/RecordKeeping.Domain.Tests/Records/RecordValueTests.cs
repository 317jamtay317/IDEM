using ErrorOr;
using RecordKeeping.Domain.ProductionFields;
using RecordKeeping.Domain.Records;
using Shouldly;

namespace RecordKeeping.Domain.Tests.Records;

public class RecordValueTests
{
    [Fact]
    public void Create_ForDecimalField_StoresNumericValue()
    {
        var result = RecordValue.Create("HotMix", ProductionFieldDataType.Decimal, numericValue: 1240.5m);

        result.IsError.ShouldBeFalse();
        var value = result.Value;
        value.PropertyName.ShouldBe("HotMix");
        value.NumericValue.ShouldBe(1240.5m);
        value.BooleanValue.ShouldBeNull();
        value.DateValue.ShouldBeNull();
    }

    [Fact]
    public void Create_ForIntegerField_WithWholeNumber_StoresNumericValue()
    {
        var result = RecordValue.Create("ColdMixTemperature", ProductionFieldDataType.Integer, numericValue: 300m);

        result.IsError.ShouldBeFalse();
        result.Value.NumericValue.ShouldBe(300m);
    }

    [Fact]
    public void Create_ForIntegerField_WithFractionalNumber_ReturnsValidationError()
    {
        var result = RecordValue.Create("ColdMixTemperature", ProductionFieldDataType.Integer, numericValue: 300.5m);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
    }

    [Fact]
    public void Create_ForBooleanField_StoresBooleanValue()
    {
        var result = RecordValue.Create("IsOperated", ProductionFieldDataType.Boolean, booleanValue: true);

        result.IsError.ShouldBeFalse();
        var value = result.Value;
        value.BooleanValue.ShouldBe(true);
        value.NumericValue.ShouldBeNull();
        value.DateValue.ShouldBeNull();
    }

    [Fact]
    public void Create_ForDateField_StoresDateValue()
    {
        var when = new DateOnly(2026, 5, 29);

        var result = RecordValue.Create("FirstShiftCycleTime", ProductionFieldDataType.Date, dateValue: when);

        result.IsError.ShouldBeFalse();
        var value = result.Value;
        value.DateValue.ShouldBe(when);
        value.NumericValue.ShouldBeNull();
        value.BooleanValue.ShouldBeNull();
    }

    [Theory]
    [InlineData(ProductionFieldDataType.Decimal)]
    [InlineData(ProductionFieldDataType.Integer)]
    public void Create_ForNumericField_WithoutNumericValue_ReturnsValidationError(ProductionFieldDataType dataType)
    {
        var result = RecordValue.Create("HotMix", dataType, numericValue: null);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
    }

    [Fact]
    public void Create_ForBooleanField_WithoutBooleanValue_ReturnsValidationError()
    {
        var result = RecordValue.Create("IsOperated", ProductionFieldDataType.Boolean, booleanValue: null);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
    }

    [Fact]
    public void Create_ForDateField_WithoutDateValue_ReturnsValidationError()
    {
        var result = RecordValue.Create("FirstShiftCycleTime", ProductionFieldDataType.Date, dateValue: null);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_WithEmptyPropertyName_ReturnsValidationError(string propertyName)
    {
        var result = RecordValue.Create(propertyName, ProductionFieldDataType.Decimal, numericValue: 1m);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
    }

    [Fact]
    public void Create_TrimsPropertyName()
    {
        var result = RecordValue.Create("  HotMix  ", ProductionFieldDataType.Decimal, numericValue: 1m);

        result.IsError.ShouldBeFalse();
        result.Value.PropertyName.ShouldBe("HotMix");
    }
}
