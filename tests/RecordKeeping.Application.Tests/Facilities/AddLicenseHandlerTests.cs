using ErrorOr;
using RecordKeeping.Application.Facilities;
using RecordKeeping.Domain.Facilities;
using Shouldly;

namespace RecordKeeping.Application.Tests.Facilities;

public class AddLicenseHandlerTests
{
    [Fact]
    public async Task Handle_WithFutureExpiration_AddsLicenseAndPersists()
    {
        var facilities = new FakeFacilityRepository();
        var orgId = Guid.NewGuid();
        var facility = Facility.Create(orgId, "Goshen Plant").Value;
        facilities.Seed(facility);

        var result = await AddLicenseHandler.Handle(
            new AddLicenseCommand(orgId, facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(30)), "LIC-1"),
            facilities, CancellationToken.None);

        result.IsError.ShouldBeFalse();
        result.Value.Value.ShouldBe("LIC-1");
        facility.Licenses.ShouldContain(l => l.Id == result.Value.Id);
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
        var result = await AddLicenseHandler.Handle(
            new AddLicenseCommand(Guid.NewGuid(), facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(30)), "LIC-1"),
            facilities, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.NotFound);
        facilities.SaveChangesCount.ShouldBe(0);
    }

    [Fact]
    public async Task Handle_WhenExpirationInPast_ReturnsValidationErrorAndDoesNotPersist()
    {
        var facilities = new FakeFacilityRepository();
        var orgId = Guid.NewGuid();
        var facility = Facility.Create(orgId, "Goshen Plant").Value;
        facilities.Seed(facility);

        var result = await AddLicenseHandler.Handle(
            new AddLicenseCommand(orgId, facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(-1)), "LIC-1"),
            facilities, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
        facilities.SaveChangesCount.ShouldBe(0);
    }
}
