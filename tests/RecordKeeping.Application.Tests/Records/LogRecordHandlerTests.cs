using ErrorOr;
using RecordKeeping.Application.Records;
using RecordKeeping.Application.Tests.Facilities;
using RecordKeeping.Application.Tests.ProductionFields;
using RecordKeeping.Domain.Facilities;
using RecordKeeping.Domain.ProductionFields;
using Shouldly;
using DomainRecord = RecordKeeping.Domain.Records.Record;

namespace RecordKeeping.Application.Tests.Records;

public class LogRecordHandlerTests
{
    private static readonly DateOnly Day = new(2026, 5, 29);

    private sealed record Context(
        Guid OrgId,
        Guid FacilityId,
        FakeRecordRepository Records,
        FakeFacilityRepository Facilities,
        FakeProductionFieldRepository Fields);

    private static Context Arrange()
    {
        var orgId = Guid.NewGuid();
        var facilities = new FakeFacilityRepository();
        var facility = Facility.Create(orgId, "Goshen Plant").Value;
        facilities.Seed(facility);

        var fields = new FakeProductionFieldRepository();
        fields.Seed(ProductionField.Create("HotMix", "Hot Mix", ProductionFieldDataType.Decimal).Value);
        fields.Seed(ProductionField.Create("IsOperated", "Operated", ProductionFieldDataType.Boolean).Value);
        fields.Seed(ProductionField.Create(
            "ColdMixTemperature", "Cold Mix Temp", ProductionFieldDataType.Integer).Value);

        return new Context(orgId, facility.Id, new FakeRecordRepository(), facilities, fields);
    }

    [Fact]
    [Trait("Invariant", "I-D23")]
    public async Task Handle_WithValidValues_PersistsAndReturnsRecord()
    {
        var ctx = Arrange();
        var command = new LogRecordCommand(ctx.OrgId, ctx.FacilityId, Day, new[]
        {
            new RecordValueInput("HotMix", NumericValue: 1240m),
            new RecordValueInput("IsOperated", BooleanValue: true),
        });

        var result = await LogRecordHandler.Handle(
            command, ctx.Records, ctx.Facilities, ctx.Fields, CancellationToken.None);

        result.IsError.ShouldBeFalse();
        result.Value.Id.ShouldNotBe(Guid.Empty);
        result.Value.FacilityId.ShouldBe(ctx.FacilityId);
        result.Value.Date.ShouldBe(Day);
        result.Value.Values.Count.ShouldBe(2);
        result.Value.Values.ShouldContain(v => v.PropertyName == "HotMix" && v.NumericValue == 1240m);
        result.Value.Values.ShouldContain(v => v.PropertyName == "IsOperated" && v.BooleanValue == true);
        ctx.Records.Stored.ShouldContain(r => r.Id == result.Value.Id && r.OrgId == ctx.OrgId);
        ctx.Records.SaveChangesCount.ShouldBe(1);
    }

    [Fact]
    public async Task Handle_WithNoValues_PersistsEmptyRecord()
    {
        var ctx = Arrange();
        var command = new LogRecordCommand(ctx.OrgId, ctx.FacilityId, Day, Array.Empty<RecordValueInput>());

        var result = await LogRecordHandler.Handle(
            command, ctx.Records, ctx.Facilities, ctx.Fields, CancellationToken.None);

        result.IsError.ShouldBeFalse();
        result.Value.Values.ShouldBeEmpty();
        ctx.Records.SaveChangesCount.ShouldBe(1);
    }

    [Fact]
    public void Handle_NormalizesValuePropertyNameToCatalogCasing()
    {
        var ctx = Arrange();
        var command = new LogRecordCommand(ctx.OrgId, ctx.FacilityId, Day, new[]
        {
            new RecordValueInput("hotmix", NumericValue: 1m),
        });

        var result = LogRecordHandler.Handle(
            command, ctx.Records, ctx.Facilities, ctx.Fields, CancellationToken.None).Result;

        result.IsError.ShouldBeFalse();
        result.Value.Values.ShouldContain(v => v.PropertyName == "HotMix");
    }

    [Fact]
    [Trait("Invariant", "I-D03")]
    public async Task Handle_WhenFacilityBelongsToAnotherOrg_ReturnsNotFoundAndDoesNotPersist()
    {
        var ctx = Arrange();
        // A different Org's user attempts to log against this Facility.
        var command = new LogRecordCommand(Guid.NewGuid(), ctx.FacilityId, Day, new[]
        {
            new RecordValueInput("HotMix", NumericValue: 1m),
        });

        var result = await LogRecordHandler.Handle(
            command, ctx.Records, ctx.Facilities, ctx.Fields, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.NotFound);
        ctx.Records.SaveChangesCount.ShouldBe(0);
    }

    [Fact]
    [Trait("Invariant", "I-D23")]
    public async Task Handle_WhenRecordAlreadyExistsForFacilityAndDate_ReturnsConflict()
    {
        var ctx = Arrange();
        ctx.Records.Seed(DomainRecord.Create(ctx.OrgId, ctx.FacilityId, Day).Value);
        var command = new LogRecordCommand(ctx.OrgId, ctx.FacilityId, Day, new[]
        {
            new RecordValueInput("HotMix", NumericValue: 1m),
        });

        var result = await LogRecordHandler.Handle(
            command, ctx.Records, ctx.Facilities, ctx.Fields, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Conflict);
        result.FirstError.Code.ShouldBe("I-D23");
        ctx.Records.SaveChangesCount.ShouldBe(0);
    }

    [Fact]
    public async Task Handle_WithUnknownField_ReturnsValidationErrorAndDoesNotPersist()
    {
        var ctx = Arrange();
        var command = new LogRecordCommand(ctx.OrgId, ctx.FacilityId, Day, new[]
        {
            new RecordValueInput("NotARealField", NumericValue: 1m),
        });

        var result = await LogRecordHandler.Handle(
            command, ctx.Records, ctx.Facilities, ctx.Fields, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
        ctx.Records.SaveChangesCount.ShouldBe(0);
    }

    [Fact]
    public async Task Handle_WithRetiredField_ReturnsValidationErrorAndDoesNotPersist()
    {
        var ctx = Arrange();
        var retired = ProductionField.Create("OldField", "Old Field", ProductionFieldDataType.Decimal).Value;
        retired.Retire();
        ctx.Fields.Seed(retired);
        var command = new LogRecordCommand(ctx.OrgId, ctx.FacilityId, Day, new[]
        {
            new RecordValueInput("OldField", NumericValue: 1m),
        });

        var result = await LogRecordHandler.Handle(
            command, ctx.Records, ctx.Facilities, ctx.Fields, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
        ctx.Records.SaveChangesCount.ShouldBe(0);
    }

    [Fact]
    public async Task Handle_WhenValueTypeDoesNotMatchFieldDataType_ReturnsValidationError()
    {
        var ctx = Arrange();
        // HotMix is a Decimal field, but only a boolean value is supplied.
        var command = new LogRecordCommand(ctx.OrgId, ctx.FacilityId, Day, new[]
        {
            new RecordValueInput("HotMix", BooleanValue: true),
        });

        var result = await LogRecordHandler.Handle(
            command, ctx.Records, ctx.Facilities, ctx.Fields, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
        ctx.Records.SaveChangesCount.ShouldBe(0);
    }
}
