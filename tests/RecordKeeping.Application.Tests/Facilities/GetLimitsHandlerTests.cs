using ErrorOr;
using RecordKeeping.Application.Facilities;
using RecordKeeping.Domain.Facilities;
using Shouldly;

namespace RecordKeeping.Application.Tests.Facilities;

public class GetLimitsHandlerTests
{
    [Fact]
    public async Task Handle_ReturnsFacilityLimits()
    {
        var facilities = new FakeFacilityRepository();
        var orgId = Guid.NewGuid();
        var facility = Facility.Create(orgId, "Goshen Plant").Value;
        facility.AddLimit(EmissionType.VOC, 5);
        facility.AddLimit(EmissionType.NOx, 7);
        facilities.Seed(facility);

        var result = await GetLimitsHandler.Handle(
            new GetLimitsQuery(orgId, facility.Id), facilities, CancellationToken.None);

        result.IsError.ShouldBeFalse();
        result.Value.Count.ShouldBe(2);
        result.Value.ShouldContain(l => l.EmissionType == "VOC" && l.Value == 5);
        result.Value.ShouldContain(l => l.EmissionType == "NOx" && l.Value == 7);
    }

    [Fact]
    [Trait("Invariant", "I-D03")]
    public async Task Handle_WhenFacilityBelongsToAnotherOrg_ReturnsNotFound()
    {
        var facilities = new FakeFacilityRepository();
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;
        facility.AddLimit(EmissionType.VOC, 5);
        facilities.Seed(facility);

        var result = await GetLimitsHandler.Handle(
            new GetLimitsQuery(Guid.NewGuid(), facility.Id), facilities, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.NotFound);
    }
}
