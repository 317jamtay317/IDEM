using ErrorOr;
using RecordKeeping.Application.Orgs;
using RecordKeeping.Domain.Orgs;
using Shouldly;

namespace RecordKeeping.Application.Tests.Orgs;

public class GetFacilitiesHandlerTests
{
    [Fact]
    public async Task Handle_ReturnsTheOrgsFacilities()
    {
        var repository = new FakeOrgRepository();
        var org = Org.Create("Rieth-Riley").Value;
        var goshen = org.AddFacility("Goshen Plant").Value;
        var fortWayne = org.AddFacility("Fort Wayne Plant").Value;
        repository.Seed(org);

        var result = await GetFacilitiesHandler.Handle(
            new GetFacilitiesQuery(org.Id), repository, CancellationToken.None);

        result.IsError.ShouldBeFalse();
        result.Value.Count.ShouldBe(2);
        result.Value.ShouldContain(f => f.Id == goshen.Id && f.Name == "Goshen Plant");
        result.Value.ShouldContain(f => f.Id == fortWayne.Id);
    }

    [Fact]
    public async Task Handle_WhenOrgHasNoFacilities_ReturnsEmpty()
    {
        var repository = new FakeOrgRepository();
        var org = Org.Create("Rieth-Riley").Value;
        repository.Seed(org);

        var result = await GetFacilitiesHandler.Handle(
            new GetFacilitiesQuery(org.Id), repository, CancellationToken.None);

        result.IsError.ShouldBeFalse();
        result.Value.ShouldBeEmpty();
    }

    [Fact]
    public async Task Handle_WhenOrgMissing_ReturnsNotFound()
    {
        var repository = new FakeOrgRepository();

        var result = await GetFacilitiesHandler.Handle(
            new GetFacilitiesQuery(Guid.NewGuid()), repository, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.NotFound);
    }
}
