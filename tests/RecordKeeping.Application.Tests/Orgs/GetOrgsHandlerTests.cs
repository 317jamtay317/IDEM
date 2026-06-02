using RecordKeeping.Application.Orgs;
using RecordKeeping.Domain.Facilities;
using RecordKeeping.Domain.Orgs;
using Shouldly;

namespace RecordKeeping.Application.Tests.Orgs;

public class GetOrgsHandlerTests
{
    [Fact]
    public async Task Handle_ReturnsAllOrgsWithTheirFacilities()
    {
        var orgs = new FakeOrgRepository();
        var facilities = new FakeFacilityRepository();
        var riethRiley = Org.Create("Rieth-Riley").Value;
        var acme = Org.Create("Acme Asphalt").Value;
        orgs.Seed(riethRiley);
        orgs.Seed(acme);
        facilities.Seed(Facility.Create(riethRiley.Id, "Goshen Plant").Value);

        var result = await GetOrgsHandler.Handle(
            new GetOrgsQuery(), orgs, facilities, CancellationToken.None);

        result.Count.ShouldBe(2);
        result.ShouldContain(o => o.Name == "Rieth-Riley" && o.Facilities.Count == 1);
        result.ShouldContain(o => o.Name == "Acme Asphalt" && o.Facilities.Count == 0);
    }

    [Fact]
    public async Task Handle_WithNoOrgs_ReturnsEmpty()
    {
        var orgs = new FakeOrgRepository();
        var facilities = new FakeFacilityRepository();

        var result = await GetOrgsHandler.Handle(
            new GetOrgsQuery(), orgs, facilities, CancellationToken.None);

        result.ShouldBeEmpty();
    }
}
