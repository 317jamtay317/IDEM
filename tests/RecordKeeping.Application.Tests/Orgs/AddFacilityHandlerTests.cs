using ErrorOr;
using RecordKeeping.Application.Orgs;
using RecordKeeping.Domain.Orgs;
using Shouldly;

namespace RecordKeeping.Application.Tests.Orgs;

public class AddFacilityHandlerTests
{
    [Fact]
    [Trait("Invariant", "I-D06")]
    public async Task Handle_WithValidName_PersistsAndReturnsFacility()
    {
        var repository = new FakeOrgRepository();
        var org = Org.Create("Rieth-Riley").Value;
        repository.Seed(org);

        var result = await AddFacilityHandler.Handle(
            new AddFacilityCommand(org.Id, "Goshen Plant"), repository, CancellationToken.None);

        result.IsError.ShouldBeFalse();
        result.Value.Id.ShouldNotBe(Guid.Empty);
        result.Value.Name.ShouldBe("Goshen Plant");
        org.Facilities.ShouldContain(f => f.Id == result.Value.Id);
        repository.SaveChangesCount.ShouldBe(1);
    }

    [Fact]
    public async Task Handle_WhenOrgMissing_ReturnsNotFound()
    {
        var repository = new FakeOrgRepository();

        var result = await AddFacilityHandler.Handle(
            new AddFacilityCommand(Guid.NewGuid(), "Goshen Plant"), repository, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.NotFound);
        repository.SaveChangesCount.ShouldBe(0);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Handle_WithInvalidName_ReturnsValidationErrorAndDoesNotPersist(string name)
    {
        var repository = new FakeOrgRepository();
        var org = Org.Create("Rieth-Riley").Value;
        repository.Seed(org);

        var result = await AddFacilityHandler.Handle(
            new AddFacilityCommand(org.Id, name), repository, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
        repository.SaveChangesCount.ShouldBe(0);
    }
}
