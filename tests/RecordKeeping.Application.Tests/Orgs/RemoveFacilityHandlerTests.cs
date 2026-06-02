using ErrorOr;
using RecordKeeping.Application.Orgs;
using RecordKeeping.Domain.Orgs;
using Shouldly;

namespace RecordKeeping.Application.Tests.Orgs;

public class RemoveFacilityHandlerTests
{
    [Fact]
    public async Task Handle_WhenFacilityExists_RemovesAndPersists()
    {
        var repository = new FakeOrgRepository();
        var org = Org.Create("Rieth-Riley").Value;
        var facility = org.AddFacility("Goshen Plant").Value;
        repository.Seed(org);

        var result = await RemoveFacilityHandler.Handle(
            new RemoveFacilityCommand(org.Id, facility.Id), repository, CancellationToken.None);

        result.IsError.ShouldBeFalse();
        org.Facilities.ShouldNotContain(f => f.Id == facility.Id);
        repository.SaveChangesCount.ShouldBe(1);
    }

    [Fact]
    public async Task Handle_WhenOrgMissing_ReturnsNotFound()
    {
        var repository = new FakeOrgRepository();

        var result = await RemoveFacilityHandler.Handle(
            new RemoveFacilityCommand(Guid.NewGuid(), Guid.NewGuid()), repository, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.NotFound);
        repository.SaveChangesCount.ShouldBe(0);
    }

    [Fact]
    public async Task Handle_WhenFacilityMissing_ReturnsNotFound()
    {
        var repository = new FakeOrgRepository();
        var org = Org.Create("Rieth-Riley").Value;
        repository.Seed(org);

        var result = await RemoveFacilityHandler.Handle(
            new RemoveFacilityCommand(org.Id, Guid.NewGuid()), repository, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.NotFound);
        repository.SaveChangesCount.ShouldBe(0);
    }
}
