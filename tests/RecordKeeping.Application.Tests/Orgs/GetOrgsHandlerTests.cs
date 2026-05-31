using RecordKeeping.Application.Orgs;
using RecordKeeping.Domain.Orgs;
using Shouldly;

namespace RecordKeeping.Application.Tests.Orgs;

public class GetOrgsHandlerTests
{
    [Fact]
    public async Task Handle_ReturnsAllOrgsAsResponses()
    {
        var repository = new FakeOrgRepository();
        repository.Seed(Org.Create("Rieth-Riley").Value);
        repository.Seed(Org.Create("Acme Asphalt").Value);

        var result = await GetOrgsHandler.Handle(
            new GetOrgsQuery(), repository, CancellationToken.None);

        result.Count.ShouldBe(2);
        result.ShouldContain(o => o.Name == "Rieth-Riley");
        result.ShouldContain(o => o.Name == "Acme Asphalt");
    }

    [Fact]
    public async Task Handle_WithNoOrgs_ReturnsEmpty()
    {
        var repository = new FakeOrgRepository();

        var result = await GetOrgsHandler.Handle(
            new GetOrgsQuery(), repository, CancellationToken.None);

        result.ShouldBeEmpty();
    }
}
