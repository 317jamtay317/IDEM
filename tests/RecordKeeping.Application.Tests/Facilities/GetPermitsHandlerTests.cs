using ErrorOr;
using RecordKeeping.Application.Facilities;
using RecordKeeping.Domain.Facilities;
using Shouldly;

namespace RecordKeeping.Application.Tests.Facilities;

public class GetPermitsHandlerTests
{
    [Fact]
    public async Task Handle_ReturnsTheFacilitysPermits()
    {
        var facilities = new FakeFacilityRepository();
        var orgId = Guid.NewGuid();
        var facility = Facility.Create(orgId, "Goshen Plant").Value;
        facility.AddPermit(Permit.Create(facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(30)), "PERMIT-1"));
        facility.AddPermit(Permit.Create(facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(10)), "PERMIT-2"));
        facilities.Seed(facility);

        var result = await GetPermitsHandler.Handle(
            new GetPermitsQuery(orgId, facility.Id), facilities, CancellationToken.None);

        result.IsError.ShouldBeFalse();
        result.Value.Count.ShouldBe(2);
        result.Value.ShouldContain(p => p.Value == "PERMIT-1");
    }

    [Fact]
    [Trait("Invariant", "I-D03")]
    public async Task Handle_WhenFacilityBelongsToAnotherOrg_ReturnsNotFound()
    {
        var facilities = new FakeFacilityRepository();
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;
        facilities.Seed(facility);

        var result = await GetPermitsHandler.Handle(
            new GetPermitsQuery(Guid.NewGuid(), facility.Id), facilities, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.NotFound);
    }
}
