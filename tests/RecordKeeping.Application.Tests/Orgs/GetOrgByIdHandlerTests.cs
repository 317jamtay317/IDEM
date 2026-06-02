using ErrorOr;
using RecordKeeping.Application.Orgs;
using RecordKeeping.Domain.Facilities;
using RecordKeeping.Domain.Orgs;
using Shouldly;

namespace RecordKeeping.Application.Tests.Orgs;

public class GetOrgByIdHandlerTests
{
    [Fact]
    public async Task Handle_WhenOrgExists_ReturnsItWithFacilities()
    {
        var orgs = new FakeOrgRepository();
        var facilities = new FakeFacilityRepository();
        var org = Org.Create("Rieth-Riley").Value;
        orgs.Seed(org);
        facilities.Seed(Facility.Create(org.Id, "Goshen Plant").Value);

        var result = await GetOrgByIdHandler.Handle(
            new GetOrgByIdQuery(org.Id), orgs, facilities, CancellationToken.None);

        result.IsError.ShouldBeFalse();
        result.Value.Id.ShouldBe(org.Id);
        result.Value.Name.ShouldBe("Rieth-Riley");
        result.Value.Facilities.ShouldHaveSingleItem().Name.ShouldBe("Goshen Plant");
    }

    [Fact]
    public async Task Handle_WhenOrgMissing_ReturnsNotFound()
    {
        var orgs = new FakeOrgRepository();
        var facilities = new FakeFacilityRepository();

        var result = await GetOrgByIdHandler.Handle(
            new GetOrgByIdQuery(Guid.NewGuid()), orgs, facilities, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.NotFound);
    }
}
