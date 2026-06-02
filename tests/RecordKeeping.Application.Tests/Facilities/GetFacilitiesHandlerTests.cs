using RecordKeeping.Application.Facilities;
using RecordKeeping.Domain.Facilities;
using Shouldly;

namespace RecordKeeping.Application.Tests.Facilities;

public class GetFacilitiesHandlerTests
{
    [Fact]
    public async Task Handle_ReturnsTheOrgsFacilities()
    {
        var facilities = new FakeFacilityRepository();
        var orgId = Guid.NewGuid();
        var goshen = Facility.Create(orgId, "Goshen Plant").Value;
        var fortWayne = Facility.Create(orgId, "Fort Wayne Plant").Value;
        facilities.Seed(goshen);
        facilities.Seed(fortWayne);

        var result = await GetFacilitiesHandler.Handle(
            new GetFacilitiesQuery(orgId), facilities, CancellationToken.None);

        result.IsError.ShouldBeFalse();
        result.Value.Count.ShouldBe(2);
        result.Value.ShouldContain(f => f.Id == goshen.Id && f.Name == "Goshen Plant");
        result.Value.ShouldContain(f => f.Id == fortWayne.Id);
    }

    [Fact]
    public async Task Handle_WhenOrgHasNoFacilities_ReturnsEmpty()
    {
        var facilities = new FakeFacilityRepository();

        var result = await GetFacilitiesHandler.Handle(
            new GetFacilitiesQuery(Guid.NewGuid()), facilities, CancellationToken.None);

        result.IsError.ShouldBeFalse();
        result.Value.ShouldBeEmpty();
    }

    [Fact]
    [Trait("Invariant", "I-D03")]
    public async Task Handle_OnlyReturnsCallersOwnOrgFacilities()
    {
        var facilities = new FakeFacilityRepository();
        var orgA = Guid.NewGuid();
        var orgB = Guid.NewGuid();
        var ownFacility = Facility.Create(orgA, "Org A Plant").Value;
        var otherFacility = Facility.Create(orgB, "Org B Plant").Value;
        facilities.Seed(ownFacility);
        facilities.Seed(otherFacility);

        var result = await GetFacilitiesHandler.Handle(
            new GetFacilitiesQuery(orgA), facilities, CancellationToken.None);

        result.IsError.ShouldBeFalse();
        result.Value.ShouldHaveSingleItem().Id.ShouldBe(ownFacility.Id);
    }
}
