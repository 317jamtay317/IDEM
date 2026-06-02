using ErrorOr;
using RecordKeeping.Application.Orgs;
using RecordKeeping.Domain.Orgs;
using Shouldly;

namespace RecordKeeping.Application.Tests.Orgs;

public class RenameFacilityHandlerTests
{
    [Fact]
    public async Task Handle_WithValidName_PersistsAndReturnsRenamedFacility()
    {
        var repository = new FakeOrgRepository();
        var org = Org.Create("Rieth-Riley").Value;
        var facility = org.AddFacility("Goshen Plant").Value;
        repository.Seed(org);

        var result = await RenameFacilityHandler.Handle(
            new RenameFacilityCommand(org.Id, facility.Id, "Goshen Asphalt Plant"),
            repository, CancellationToken.None);

        result.IsError.ShouldBeFalse();
        result.Value.Id.ShouldBe(facility.Id);
        result.Value.Name.ShouldBe("Goshen Asphalt Plant");
        repository.SaveChangesCount.ShouldBe(1);
    }

    [Fact]
    public async Task Handle_WhenOrgMissing_ReturnsNotFound()
    {
        var repository = new FakeOrgRepository();

        var result = await RenameFacilityHandler.Handle(
            new RenameFacilityCommand(Guid.NewGuid(), Guid.NewGuid(), "Whatever"),
            repository, CancellationToken.None);

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

        var result = await RenameFacilityHandler.Handle(
            new RenameFacilityCommand(org.Id, Guid.NewGuid(), "Whatever"),
            repository, CancellationToken.None);

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
        var facility = org.AddFacility("Goshen Plant").Value;
        repository.Seed(org);

        var result = await RenameFacilityHandler.Handle(
            new RenameFacilityCommand(org.Id, facility.Id, name),
            repository, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
        repository.SaveChangesCount.ShouldBe(0);
    }
}
