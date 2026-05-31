using ErrorOr;
using RecordKeeping.Application.Orgs;
using RecordKeeping.Domain.Orgs;
using Shouldly;

namespace RecordKeeping.Application.Tests.Orgs;

public class DeleteOrgHandlerTests
{
    [Fact]
    public async Task Handle_WhenOrgExists_RemovesAndSaves()
    {
        var repository = new FakeOrgRepository();
        var org = Org.Create("Rieth-Riley").Value;
        repository.Seed(org);

        var result = await DeleteOrgHandler.Handle(
            new DeleteOrgCommand(org.Id), repository, CancellationToken.None);

        result.IsError.ShouldBeFalse();
        repository.Stored.ShouldBeEmpty();
        repository.SaveChangesCount.ShouldBe(1);
    }

    [Fact]
    public async Task Handle_WhenOrgMissing_ReturnsNotFound()
    {
        var repository = new FakeOrgRepository();

        var result = await DeleteOrgHandler.Handle(
            new DeleteOrgCommand(Guid.NewGuid()), repository, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.NotFound);
        repository.SaveChangesCount.ShouldBe(0);
    }
}
