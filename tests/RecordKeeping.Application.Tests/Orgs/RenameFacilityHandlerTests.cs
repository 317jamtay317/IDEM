using ErrorOr;
using RecordKeeping.Application.Orgs;
using RecordKeeping.Domain.Facilities;
using Shouldly;

namespace RecordKeeping.Application.Tests.Orgs;

public class RenameFacilityHandlerTests
{
    [Fact]
    public async Task Handle_WithValidName_PersistsAndReturnsRenamedFacility()
    {
        var facilities = new FakeFacilityRepository();
        var orgId = Guid.NewGuid();
        var facility = Facility.Create(orgId, "Goshen Plant").Value;
        facilities.Seed(facility);

        var result = await RenameFacilityHandler.Handle(
            new RenameFacilityCommand(orgId, facility.Id, "Goshen Asphalt Plant"),
            facilities, CancellationToken.None);

        result.IsError.ShouldBeFalse();
        result.Value.Id.ShouldBe(facility.Id);
        result.Value.Name.ShouldBe("Goshen Asphalt Plant");
        facilities.SaveChangesCount.ShouldBe(1);
    }

    [Fact]
    public async Task Handle_WhenFacilityMissing_ReturnsNotFound()
    {
        var facilities = new FakeFacilityRepository();

        var result = await RenameFacilityHandler.Handle(
            new RenameFacilityCommand(Guid.NewGuid(), Guid.NewGuid(), "Whatever"),
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
        var otherOrgId = Guid.NewGuid();
        var facility = Facility.Create(otherOrgId, "Org B Plant").Value;
        facilities.Seed(facility);

        // I-D03: a different Org's caller scopes the lookup to its own Org and finds nothing.
        var result = await RenameFacilityHandler.Handle(
            new RenameFacilityCommand(Guid.NewGuid(), facility.Id, "Hijacked"),
            facilities, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.NotFound);
        facility.Name.ShouldBe("Org B Plant");
        facilities.SaveChangesCount.ShouldBe(0);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Handle_WithInvalidName_ReturnsValidationErrorAndDoesNotPersist(string name)
    {
        var facilities = new FakeFacilityRepository();
        var orgId = Guid.NewGuid();
        var facility = Facility.Create(orgId, "Goshen Plant").Value;
        facilities.Seed(facility);

        var result = await RenameFacilityHandler.Handle(
            new RenameFacilityCommand(orgId, facility.Id, name),
            facilities, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
        facilities.SaveChangesCount.ShouldBe(0);
    }
}
