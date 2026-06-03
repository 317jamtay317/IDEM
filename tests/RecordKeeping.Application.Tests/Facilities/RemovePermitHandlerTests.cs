using ErrorOr;
using RecordKeeping.Application.Facilities;
using RecordKeeping.Domain.Facilities;
using Shouldly;

namespace RecordKeeping.Application.Tests.Facilities;

public class RemovePermitHandlerTests
{
    [Fact]
    public async Task Handle_WhenPermitExists_RemovesAndPersists()
    {
        var facilities = new FakeFacilityRepository();
        var orgId = Guid.NewGuid();
        var facility = Facility.Create(orgId, "Goshen Plant").Value;
        var keep = Permit.Create(facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(30)), "KEEP");
        var remove = Permit.Create(facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(10)), "REMOVE");
        facility.AddPermit(keep);
        facility.AddPermit(remove);
        facilities.Seed(facility);

        var result = await RemovePermitHandler.Handle(
            new RemovePermitCommand(orgId, facility.Id, remove.Id), facilities, CancellationToken.None);

        result.IsError.ShouldBeFalse();
        facility.Permits.ShouldNotContain(p => p.Id == remove.Id);
        facilities.SaveChangesCount.ShouldBe(1);
    }

    [Fact]
    [Trait("Invariant", "I-D03")]
    public async Task Handle_WhenFacilityBelongsToAnotherOrg_ReturnsNotFound()
    {
        var facilities = new FakeFacilityRepository();
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;
        facilities.Seed(facility);

        var result = await RemovePermitHandler.Handle(
            new RemovePermitCommand(Guid.NewGuid(), facility.Id, Guid.NewGuid()), facilities, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.NotFound);
        facilities.SaveChangesCount.ShouldBe(0);
    }

    [Fact]
    public async Task Handle_WhenPermitMissing_ReturnsNotFoundAndDoesNotPersist()
    {
        var facilities = new FakeFacilityRepository();
        var orgId = Guid.NewGuid();
        var facility = Facility.Create(orgId, "Goshen Plant").Value;
        facility.AddPermit(Permit.Create(facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(30)), "ONLY"));
        facilities.Seed(facility);

        var result = await RemovePermitHandler.Handle(
            new RemovePermitCommand(orgId, facility.Id, Guid.NewGuid()), facilities, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.NotFound);
        facilities.SaveChangesCount.ShouldBe(0);
    }
}
