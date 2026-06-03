using ErrorOr;
using RecordKeeping.Application.Facilities;
using RecordKeeping.Domain.Facilities;
using Shouldly;

namespace RecordKeeping.Application.Tests.Facilities;

public class RemoveFacilityHandlerTests
{
    [Fact]
    public async Task Handle_WhenFacilityExists_RemovesAndPersists()
    {
        var facilities = new FakeFacilityRepository();
        var orgId = Guid.NewGuid();
        var facility = Facility.Create(orgId, "Goshen Plant").Value;
        facilities.Seed(facility);

        var result = await RemoveFacilityHandler.Handle(
            new RemoveFacilityCommand(orgId, facility.Id), facilities, CancellationToken.None);

        result.IsError.ShouldBeFalse();
        facilities.Stored.ShouldNotContain(f => f.Id == facility.Id);
        facilities.SaveChangesCount.ShouldBe(1);
    }

    [Fact]
    public async Task Handle_WhenFacilityMissing_ReturnsNotFound()
    {
        var facilities = new FakeFacilityRepository();

        var result = await RemoveFacilityHandler.Handle(
            new RemoveFacilityCommand(Guid.NewGuid(), Guid.NewGuid()), facilities, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.NotFound);
        facilities.SaveChangesCount.ShouldBe(0);
    }

    [Fact]
    [Trait("Invariant", "I-D03")]
    public async Task Handle_WhenFacilityBelongsToAnotherOrg_ReturnsNotFound()
    {
        var facilities = new FakeFacilityRepository();
        var otherOrgId = Guid.NewGuid();
        var facility = Facility.Create(otherOrgId, "Org B Plant").Value;
        facilities.Seed(facility);

        // I-D03: scoped to the caller's Org, another Org's facility is not found and untouched.
        var result = await RemoveFacilityHandler.Handle(
            new RemoveFacilityCommand(Guid.NewGuid(), facility.Id), facilities, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.NotFound);
        facilities.Stored.ShouldContain(f => f.Id == facility.Id);
        facilities.SaveChangesCount.ShouldBe(0);
    }
}
