using ErrorOr;
using RecordKeeping.Application.Orgs;
using Shouldly;

namespace RecordKeeping.Application.Tests.Orgs;

public class CreateOrgHandlerTests
{
    [Fact]
    public async Task Handle_WithValidName_PersistsAndReturnsOrg()
    {
        var repository = new FakeOrgRepository();

        var result = await CreateOrgHandler.Handle(
            new CreateOrgCommand("Rieth-Riley"), repository, CancellationToken.None);

        result.IsError.ShouldBeFalse();
        result.Value.Name.ShouldBe("Rieth-Riley");
        result.Value.Id.ShouldNotBe(Guid.Empty);
        result.Value.TenantId.ShouldBeNull();
        result.Value.Facilities.ShouldBeEmpty();
        repository.Stored.ShouldContain(o => o.Id == result.Value.Id);
        repository.SaveChangesCount.ShouldBe(1);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Handle_WithInvalidName_ReturnsValidationErrorAndDoesNotPersist(string name)
    {
        var repository = new FakeOrgRepository();

        var result = await CreateOrgHandler.Handle(
            new CreateOrgCommand(name), repository, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
        repository.Stored.ShouldBeEmpty();
        repository.SaveChangesCount.ShouldBe(0);
    }
}
