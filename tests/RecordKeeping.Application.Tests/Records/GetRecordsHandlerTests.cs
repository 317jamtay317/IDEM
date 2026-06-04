using RecordKeeping.Application.Records;
using RecordKeeping.Application.Tests.ProductionFieldLimits;
using RecordKeeping.Domain.ProductionFieldLimits;
using RecordKeeping.Domain.ProductionFields;
using Shouldly;
using DomainRecord = RecordKeeping.Domain.Records.Record;
using RecordKeeping.Domain.Records;

namespace RecordKeeping.Application.Tests.Records;

public class GetRecordsHandlerTests
{
    private static DomainRecord RecordFor(Guid orgId, Guid facilityId, DateOnly date, decimal hotMix)
    {
        var record = DomainRecord.Create(orgId, facilityId, date).Value;
        record.AddValue(RecordValue.Create("HotMix", ProductionFieldDataType.Decimal, hotMix).Value);
        return record;
    }

    private static ProductionFieldLimit HotMixLimit(Guid orgId, decimal low, decimal high) =>
        ProductionFieldLimit.Create(orgId, "HotMix", low, high, LimitUnit.Tons).Value;

    [Fact]
    public async Task Handle_ReturnsTheOrgsRecords_NewestFirst()
    {
        var orgId = Guid.NewGuid();
        var facilityId = Guid.NewGuid();
        var records = new FakeRecordRepository();
        records.Seed(RecordFor(orgId, facilityId, new DateOnly(2026, 5, 27), 100m));
        records.Seed(RecordFor(orgId, facilityId, new DateOnly(2026, 5, 29), 300m));
        records.Seed(RecordFor(orgId, facilityId, new DateOnly(2026, 5, 28), 200m));

        var result = await GetRecordsHandler.Handle(
            new GetRecordsQuery(orgId), records, new FakeProductionFieldLimitRepository(),
            CancellationToken.None);

        result.IsError.ShouldBeFalse();
        result.Value.Select(r => r.Date).ShouldBe(new[]
        {
            new DateOnly(2026, 5, 29),
            new DateOnly(2026, 5, 28),
            new DateOnly(2026, 5, 27),
        });
        result.Value[0].Values.ShouldContain(v => v.PropertyName == "HotMix" && v.NumericValue == 300m);
    }

    [Fact]
    public async Task Handle_FiltersByFacility()
    {
        var orgId = Guid.NewGuid();
        var goshen = Guid.NewGuid();
        var fortWayne = Guid.NewGuid();
        var records = new FakeRecordRepository();
        records.Seed(RecordFor(orgId, goshen, new DateOnly(2026, 5, 29), 1m));
        records.Seed(RecordFor(orgId, fortWayne, new DateOnly(2026, 5, 29), 2m));

        var result = await GetRecordsHandler.Handle(
            new GetRecordsQuery(orgId, FacilityId: goshen), records,
            new FakeProductionFieldLimitRepository(), CancellationToken.None);

        result.IsError.ShouldBeFalse();
        result.Value.ShouldHaveSingleItem().FacilityId.ShouldBe(goshen);
    }

    [Fact]
    public async Task Handle_FiltersByDateRange_Inclusive()
    {
        var orgId = Guid.NewGuid();
        var facilityId = Guid.NewGuid();
        var records = new FakeRecordRepository();
        records.Seed(RecordFor(orgId, facilityId, new DateOnly(2026, 5, 1), 1m));
        records.Seed(RecordFor(orgId, facilityId, new DateOnly(2026, 5, 10), 2m));
        records.Seed(RecordFor(orgId, facilityId, new DateOnly(2026, 5, 20), 3m));
        records.Seed(RecordFor(orgId, facilityId, new DateOnly(2026, 5, 31), 4m));

        var result = await GetRecordsHandler.Handle(
            new GetRecordsQuery(orgId, From: new DateOnly(2026, 5, 10), To: new DateOnly(2026, 5, 20)),
            records, new FakeProductionFieldLimitRepository(), CancellationToken.None);

        result.IsError.ShouldBeFalse();
        result.Value.Select(r => r.Date).ShouldBe(new[]
        {
            new DateOnly(2026, 5, 20),
            new DateOnly(2026, 5, 10),
        });
    }

    [Fact]
    [Trait("Invariant", "I-D03")]
    public async Task Handle_OnlyReturnsCallersOwnOrgRecords()
    {
        var orgA = Guid.NewGuid();
        var orgB = Guid.NewGuid();
        var records = new FakeRecordRepository();
        records.Seed(RecordFor(orgA, Guid.NewGuid(), new DateOnly(2026, 5, 29), 1m));
        records.Seed(RecordFor(orgB, Guid.NewGuid(), new DateOnly(2026, 5, 29), 2m));

        var result = await GetRecordsHandler.Handle(
            new GetRecordsQuery(orgA), records, new FakeProductionFieldLimitRepository(),
            CancellationToken.None);

        result.IsError.ShouldBeFalse();
        result.Value.ShouldHaveSingleItem().Values
            .ShouldContain(v => v.PropertyName == "HotMix" && v.NumericValue == 1m);
    }

    [Fact]
    public async Task Handle_WhenOrgHasNoRecords_ReturnsEmpty()
    {
        var result = await GetRecordsHandler.Handle(
            new GetRecordsQuery(Guid.NewGuid()), new FakeRecordRepository(),
            new FakeProductionFieldLimitRepository(), CancellationToken.None);

        result.IsError.ShouldBeFalse();
        result.Value.ShouldBeEmpty();
    }

    [Fact]
    public async Task Handle_AnnotatesValueAboveHighLimit_AsAbove()
    {
        var orgId = Guid.NewGuid();
        var records = new FakeRecordRepository();
        records.Seed(RecordFor(orgId, Guid.NewGuid(), new DateOnly(2026, 5, 29), 300m));
        var limits = new FakeProductionFieldLimitRepository();
        limits.Seed(HotMixLimit(orgId, low: 0m, high: 200m));

        var result = await GetRecordsHandler.Handle(
            new GetRecordsQuery(orgId), records, limits, CancellationToken.None);

        result.Value[0].Values.Single(v => v.PropertyName == "HotMix")
            .Exceedance.ShouldBe(ExceedanceStatus.Above);
    }

    [Fact]
    public async Task Handle_AnnotatesValueBelowLowLimit_AsBelow()
    {
        var orgId = Guid.NewGuid();
        var records = new FakeRecordRepository();
        records.Seed(RecordFor(orgId, Guid.NewGuid(), new DateOnly(2026, 5, 29), 50m));
        var limits = new FakeProductionFieldLimitRepository();
        limits.Seed(HotMixLimit(orgId, low: 100m, high: 200m));

        var result = await GetRecordsHandler.Handle(
            new GetRecordsQuery(orgId), records, limits, CancellationToken.None);

        result.Value[0].Values.Single(v => v.PropertyName == "HotMix")
            .Exceedance.ShouldBe(ExceedanceStatus.Below);
    }

    [Fact]
    public async Task Handle_AnnotatesValueWithinLimit_AsWithin()
    {
        var orgId = Guid.NewGuid();
        var records = new FakeRecordRepository();
        records.Seed(RecordFor(orgId, Guid.NewGuid(), new DateOnly(2026, 5, 29), 300m));
        var limits = new FakeProductionFieldLimitRepository();
        limits.Seed(HotMixLimit(orgId, low: 0m, high: 500m));

        var result = await GetRecordsHandler.Handle(
            new GetRecordsQuery(orgId), records, limits, CancellationToken.None);

        result.Value[0].Values.Single(v => v.PropertyName == "HotMix")
            .Exceedance.ShouldBe(ExceedanceStatus.Within);
    }

    [Fact]
    public async Task Handle_WhenNoLimitConfiguredForField_LeavesExceedanceNull()
    {
        var orgId = Guid.NewGuid();
        var records = new FakeRecordRepository();
        records.Seed(RecordFor(orgId, Guid.NewGuid(), new DateOnly(2026, 5, 29), 300m));

        var result = await GetRecordsHandler.Handle(
            new GetRecordsQuery(orgId), records, new FakeProductionFieldLimitRepository(),
            CancellationToken.None);

        result.Value[0].Values.Single(v => v.PropertyName == "HotMix")
            .Exceedance.ShouldBeNull();
    }

    [Fact]
    [Trait("Invariant", "I-D03")]
    public async Task Handle_AppliesOnlyTheCallersOwnOrgLimits()
    {
        var orgA = Guid.NewGuid();
        var orgB = Guid.NewGuid();
        var records = new FakeRecordRepository();
        records.Seed(RecordFor(orgA, Guid.NewGuid(), new DateOnly(2026, 5, 29), 300m));
        var limits = new FakeProductionFieldLimitRepository();
        limits.Seed(HotMixLimit(orgA, low: 0m, high: 500m)); // Org A: 300 is within
        limits.Seed(HotMixLimit(orgB, low: 0m, high: 1m));   // Org B: 300 would exceed — must NOT apply

        var result = await GetRecordsHandler.Handle(
            new GetRecordsQuery(orgA), records, limits, CancellationToken.None);

        result.Value[0].Values.Single(v => v.PropertyName == "HotMix")
            .Exceedance.ShouldBe(ExceedanceStatus.Within);
    }
}
