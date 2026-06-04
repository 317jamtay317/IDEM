using ErrorOr;
using RecordKeeping.Domain.ProductionFields;
using RecordKeeping.Domain.Records;
using Shouldly;
using DomainRecord = RecordKeeping.Domain.Records.Record;

namespace RecordKeeping.Domain.Tests.Records;

public class RecordTests
{
    private static readonly DateOnly Day = new(2026, 5, 29);

    [Fact]
    [Trait("Invariant", "I-D01")]
    [Trait("Invariant", "I-D07")]
    public void Create_WithValidOrgFacilityAndDate_ReturnsRecord()
    {
        var orgId = Guid.NewGuid();
        var facilityId = Guid.NewGuid();

        var result = DomainRecord.Create(orgId, facilityId, Day);

        result.IsError.ShouldBeFalse();
        var record = result.Value;
        record.Id.ShouldNotBe(Guid.Empty);
        record.OrgId.ShouldBe(orgId);
        record.FacilityId.ShouldBe(facilityId);
        record.Date.ShouldBe(Day);
        record.Values.ShouldBeEmpty();
    }

    [Fact]
    [Trait("Invariant", "I-D01")]
    public void Create_WithEmptyOrgId_ReturnsValidationError()
    {
        var result = DomainRecord.Create(Guid.Empty, Guid.NewGuid(), Day);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
    }

    [Fact]
    [Trait("Invariant", "I-D07")]
    public void Create_WithEmptyFacilityId_ReturnsValidationError()
    {
        var result = DomainRecord.Create(Guid.NewGuid(), Guid.Empty, Day);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
    }

    [Fact]
    public void AddValue_WithNewPropertyName_AddsToValues()
    {
        var record = DomainRecord.Create(Guid.NewGuid(), Guid.NewGuid(), Day).Value;
        var value = RecordValue.Create("HotMix", ProductionFieldDataType.Decimal, numericValue: 1240m).Value;

        var result = record.AddValue(value);

        result.IsError.ShouldBeFalse();
        record.Values.ShouldContain(value);
    }

    [Fact]
    public void AddValue_WithDuplicatePropertyName_ReturnsError()
    {
        var record = DomainRecord.Create(Guid.NewGuid(), Guid.NewGuid(), Day).Value;
        record.AddValue(RecordValue.Create("HotMix", ProductionFieldDataType.Decimal, numericValue: 1m).Value);

        var result = record.AddValue(
            RecordValue.Create("HotMix", ProductionFieldDataType.Decimal, numericValue: 2m).Value);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Conflict);
        record.Values.Count.ShouldBe(1);
    }

    [Fact]
    public void AddValue_WithDuplicatePropertyNameDifferingOnlyInCase_ReturnsError()
    {
        var record = DomainRecord.Create(Guid.NewGuid(), Guid.NewGuid(), Day).Value;
        record.AddValue(RecordValue.Create("HotMix", ProductionFieldDataType.Decimal, numericValue: 1m).Value);

        var result = record.AddValue(
            RecordValue.Create("hotmix", ProductionFieldDataType.Decimal, numericValue: 2m).Value);

        result.IsError.ShouldBeTrue();
        record.Values.Count.ShouldBe(1);
    }
}
