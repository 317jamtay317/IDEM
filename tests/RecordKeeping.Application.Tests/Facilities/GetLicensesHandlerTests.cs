using ErrorOr;
using RecordKeeping.Application.Facilities;
using RecordKeeping.Domain.Facilities;
using Shouldly;

namespace RecordKeeping.Application.Tests.Facilities;

public class GetLicensesHandlerTests
{
    [Fact]
    public async Task Handle_ReturnsTheFacilitysLicenses()
    {
        var facilities = new FakeFacilityRepository();
        var orgId = Guid.NewGuid();
        var facility = Facility.Create(orgId, "Goshen Plant").Value;
        facility.AddLicense(License.Create(facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(30)), "LIC-1"));
        facility.AddLicense(License.Create(facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(10)), "LIC-2"));
        facilities.Seed(facility);

        var result = await GetLicensesHandler.Handle(
            new GetLicensesQuery(orgId, facility.Id), facilities, CancellationToken.None);

        result.IsError.ShouldBeFalse();
        result.Value.Count.ShouldBe(2);
        result.Value.ShouldContain(l => l.Value == "LIC-1");
    }

    [Fact]
    [Trait("Invariant", "I-D03")]
    public async Task Handle_WhenFacilityBelongsToAnotherOrg_ReturnsNotFound()
    {
        var facilities = new FakeFacilityRepository();
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;
        facilities.Seed(facility);

        var result = await GetLicensesHandler.Handle(
            new GetLicensesQuery(Guid.NewGuid(), facility.Id), facilities, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.NotFound);
    }
}
