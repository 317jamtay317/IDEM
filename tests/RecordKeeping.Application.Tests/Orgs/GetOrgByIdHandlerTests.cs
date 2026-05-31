using ErrorOr;
using RecordKeeping.Application.Orgs;
using RecordKeeping.Domain.Orgs;
using Shouldly;

namespace RecordKeeping.Application.Tests.Orgs;

public class GetOrgByIdHandlerTests
{
    [Fact]
    public async Task Handle_WhenOrgExists_ReturnsIt()
    {
        var repository = new FakeOrgRepository();
        var org = Org.Create("Rieth-Riley").Value;
        repository.Seed(org);

        var result = await GetOrgByIdHandler.Handle(
            new GetOrgByIdQuery(org.Id), repository, CancellationToken.None);

        result.IsError.ShouldBeFalse();
        result.Value.Id.ShouldBe(org.Id);
        result.Value.Name.ShouldBe("Rieth-Riley");
    }

    [Fact]
    public async Task Handle_WhenOrgMissing_ReturnsNotFound()
    {
        var repository = new FakeOrgRepository();

        var result = await GetOrgByIdHandler.Handle(
            new GetOrgByIdQuery(Guid.NewGuid()), repository, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.NotFound);
    }
}
