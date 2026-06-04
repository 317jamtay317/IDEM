using ErrorOr;
using RecordKeeping.Application.Records;
using RecordKeeping.Domain.ProductionFields;
using RecordKeeping.Domain.Records;
using Shouldly;
using DomainRecord = RecordKeeping.Domain.Records.Record;

namespace RecordKeeping.Application.Tests.Records;

public class GetRecordHandlerTests
{
    private static readonly DateOnly Day = new(2026, 5, 29);

    [Fact]
    public async Task Handle_ReturnsTheRecord()
    {
        var orgId = Guid.NewGuid();
        var facilityId = Guid.NewGuid();
        var record = DomainRecord.Create(orgId, facilityId, Day).Value;
        record.AddValue(RecordValue.Create("HotMix", ProductionFieldDataType.Decimal, 1240m).Value);
        var records = new FakeRecordRepository();
        records.Seed(record);

        var result = await GetRecordHandler.Handle(
            new GetRecordQuery(orgId, record.Id), records, CancellationToken.None);

        result.IsError.ShouldBeFalse();
        result.Value.Id.ShouldBe(record.Id);
        result.Value.FacilityId.ShouldBe(facilityId);
        result.Value.Date.ShouldBe(Day);
        result.Value.Values.ShouldContain(v => v.PropertyName == "HotMix" && v.NumericValue == 1240m);
    }

    [Fact]
    public async Task Handle_WhenMissing_ReturnsNotFound()
    {
        var result = await GetRecordHandler.Handle(
            new GetRecordQuery(Guid.NewGuid(), Guid.NewGuid()), new FakeRecordRepository(),
            CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.NotFound);
    }

    [Fact]
    [Trait("Invariant", "I-D03")]
    public async Task Handle_WhenRecordBelongsToAnotherOrg_ReturnsNotFound()
    {
        var orgA = Guid.NewGuid();
        var orgB = Guid.NewGuid();
        var orgBRecord = DomainRecord.Create(orgB, Guid.NewGuid(), Day).Value;
        var records = new FakeRecordRepository();
        records.Seed(orgBRecord);

        // I-D03: Org A asks for Org B's record by id; scoped to Org A, it is not found.
        var result = await GetRecordHandler.Handle(
            new GetRecordQuery(orgA, orgBRecord.Id), records, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.NotFound);
    }
}
