using ErrorOr;
using RecordKeeping.Application.Facilities;
using RecordKeeping.Domain.Facilities;
using Shouldly;

namespace RecordKeeping.Application.Tests.Facilities;

public class UpdateLimitHandlerTests
{
    [Fact]
    public async Task Handle_WithExistingLimit_UpdatesValueAndPersists()
    {
        var facilities = new FakeFacilityRepository();
        var orgId = Guid.NewGuid();
        var facility = Facility.Create(orgId, "Goshen Plant").Value;
        facility.AddLimit(EmissionType.VOC, 5);
        facilities.Seed(facility);

        var result = await UpdateLimitHandler.Handle(
            new UpdateLimitCommand(orgId, facility.Id, EmissionType.VOC, 8.25),
            facilities, CancellationToken.None);

        result.IsError.ShouldBeFalse();
        result.Value.Value.ShouldBe(8.25);
        facility.Limits.ShouldContain(l => l.EmissionType == EmissionType.VOC && l.Value == 8.25);
        facilities.SaveChangesCount.ShouldBe(1);
    }

    [Fact]
    public async Task Handle_WhenLimitDoesNotExist_ReturnsNotFoundAndDoesNotPersist()
    {
        var facilities = new FakeFacilityRepository();
        var orgId = Guid.NewGuid();
        var facility = Facility.Create(orgId, "Goshen Plant").Value;
        facilities.Seed(facility);

        var result = await UpdateLimitHandler.Handle(
            new UpdateLimitCommand(orgId, facility.Id, EmissionType.VOC, 8),
            facilities, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.NotFound);
        facilities.SaveChangesCount.ShouldBe(0);
    }

    [Fact]
    [Trait("Invariant", "I-D03")]
    public async Task Handle_WhenFacilityBelongsToAnotherOrg_ReturnsNotFound()
    {
        var facilities = new FakeFacilityRepository();
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;
        facility.AddLimit(EmissionType.VOC, 5);
        facilities.Seed(facility);

        var result = await UpdateLimitHandler.Handle(
            new UpdateLimitCommand(Guid.NewGuid(), facility.Id, EmissionType.VOC, 8),
            facilities, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.NotFound);
        facilities.SaveChangesCount.ShouldBe(0);
    }
}
