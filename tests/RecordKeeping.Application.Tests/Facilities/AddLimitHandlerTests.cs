using ErrorOr;
using RecordKeeping.Application.Facilities;
using RecordKeeping.Domain.Facilities;
using Shouldly;

namespace RecordKeeping.Application.Tests.Facilities;

public class AddLimitHandlerTests
{
    [Fact]
    public async Task Handle_WithValidLimit_AddsLimitAndPersists()
    {
        var facilities = new FakeFacilityRepository();
        var orgId = Guid.NewGuid();
        var facility = Facility.Create(orgId, "Goshen Plant").Value;
        facilities.Seed(facility);

        var result = await AddLimitHandler.Handle(
            new AddLimitCommand(orgId, facility.Id, EmissionType.VOC, 12.5),
            facilities, CancellationToken.None);

        result.IsError.ShouldBeFalse();
        result.Value.EmissionType.ShouldBe("VOC");
        result.Value.Value.ShouldBe(12.5);
        facility.Limits.ShouldContain(l => l.EmissionType == EmissionType.VOC && l.Value == 12.5);
        facilities.SaveChangesCount.ShouldBe(1);
    }

    [Fact]
    [Trait("Invariant", "I-D03")]
    public async Task Handle_WhenFacilityBelongsToAnotherOrg_ReturnsNotFound()
    {
        var facilities = new FakeFacilityRepository();
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;
        facilities.Seed(facility);

        // I-D03: a different Org's caller scopes the lookup to its own Org and finds nothing.
        var result = await AddLimitHandler.Handle(
            new AddLimitCommand(Guid.NewGuid(), facility.Id, EmissionType.VOC, 12.5),
            facilities, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.NotFound);
        facilities.SaveChangesCount.ShouldBe(0);
    }

    [Fact]
    [Trait("Invariant", "I-D19")]
    public async Task Handle_WhenLimitForTypeAlreadyExists_ReturnsValidationErrorAndDoesNotPersist()
    {
        var facilities = new FakeFacilityRepository();
        var orgId = Guid.NewGuid();
        var facility = Facility.Create(orgId, "Goshen Plant").Value;
        facility.AddLimit(EmissionType.VOC, 5);
        facilities.Seed(facility);

        var result = await AddLimitHandler.Handle(
            new AddLimitCommand(orgId, facility.Id, EmissionType.VOC, 9),
            facilities, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
        facilities.SaveChangesCount.ShouldBe(0);
    }
}
