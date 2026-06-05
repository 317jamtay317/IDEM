using ErrorOr;
using RecordKeeping.Application.Facilities;
using RecordKeeping.Domain.Facilities;
using Shouldly;

namespace RecordKeeping.Application.Tests.Facilities;

public class RemoveLimitHandlerTests
{
    [Fact]
    public async Task Handle_WithExistingLimit_RemovesAndPersists()
    {
        var facilities = new FakeFacilityRepository();
        var orgId = Guid.NewGuid();
        var facility = Facility.Create(orgId, "Goshen Plant").Value;
        facility.AddLimit(EmissionType.VOC, 5);
        facilities.Seed(facility);

        var result = await RemoveLimitHandler.Handle(
            new RemoveLimitCommand(orgId, facility.Id, EmissionType.VOC),
            facilities, CancellationToken.None);

        result.IsError.ShouldBeFalse();
        facility.Limits.ShouldNotContain(l => l.EmissionType == EmissionType.VOC);
        facilities.SaveChangesCount.ShouldBe(1);
    }

    [Fact]
    public async Task Handle_WhenLimitDoesNotExist_ReturnsNotFoundAndDoesNotPersist()
    {
        var facilities = new FakeFacilityRepository();
        var orgId = Guid.NewGuid();
        var facility = Facility.Create(orgId, "Goshen Plant").Value;
        facilities.Seed(facility);

        var result = await RemoveLimitHandler.Handle(
            new RemoveLimitCommand(orgId, facility.Id, EmissionType.VOC),
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

        var result = await RemoveLimitHandler.Handle(
            new RemoveLimitCommand(Guid.NewGuid(), facility.Id, EmissionType.VOC),
            facilities, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.NotFound);
        facilities.SaveChangesCount.ShouldBe(0);
    }
}
