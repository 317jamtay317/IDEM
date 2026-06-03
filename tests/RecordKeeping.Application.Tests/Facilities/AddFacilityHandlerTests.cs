using ErrorOr;
using RecordKeeping.Application.Facilities;
using RecordKeeping.Application.Tests.Orgs;
using RecordKeeping.Domain.Orgs;
using Shouldly;

namespace RecordKeeping.Application.Tests.Facilities;

public class AddFacilityHandlerTests
{
    [Fact]
    [Trait("Invariant", "I-D06")]
    public async Task Handle_WithValidName_PersistsAndReturnsFacility()
    {
        var orgs = new FakeOrgRepository();
        var facilities = new FakeFacilityRepository();
        var org = Org.Create("Rieth-Riley").Value;
        orgs.Seed(org);

        var result = await AddFacilityHandler.Handle(
            new AddFacilityCommand(org.Id, "Goshen Plant"), orgs, facilities, CancellationToken.None);

        result.IsError.ShouldBeFalse();
        result.Value.Id.ShouldNotBe(Guid.Empty);
        result.Value.Name.ShouldBe("Goshen Plant");
        facilities.Stored.ShouldContain(f => f.Id == result.Value.Id && f.OrgId == org.Id);
        facilities.SaveChangesCount.ShouldBe(1);
    }

    [Fact]
    public async Task Handle_WhenOrgMissing_ReturnsNotFound()
    {
        var orgs = new FakeOrgRepository();
        var facilities = new FakeFacilityRepository();

        var result = await AddFacilityHandler.Handle(
            new AddFacilityCommand(Guid.NewGuid(), "Goshen Plant"), orgs, facilities, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.NotFound);
        facilities.SaveChangesCount.ShouldBe(0);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Handle_WithInvalidName_ReturnsValidationErrorAndDoesNotPersist(string name)
    {
        var orgs = new FakeOrgRepository();
        var facilities = new FakeFacilityRepository();
        var org = Org.Create("Rieth-Riley").Value;
        orgs.Seed(org);

        var result = await AddFacilityHandler.Handle(
            new AddFacilityCommand(org.Id, name), orgs, facilities, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
        facilities.SaveChangesCount.ShouldBe(0);
    }
}
