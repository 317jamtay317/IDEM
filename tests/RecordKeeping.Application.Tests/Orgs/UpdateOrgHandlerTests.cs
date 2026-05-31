using ErrorOr;
using RecordKeeping.Application.Orgs;
using RecordKeeping.Domain.Orgs;
using Shouldly;

namespace RecordKeeping.Application.Tests.Orgs;

public class UpdateOrgHandlerTests
{
    [Fact]
    public async Task Handle_WhenOrgMissing_ReturnsNotFound()
    {
        var repository = new FakeOrgRepository();

        var result = await UpdateOrgHandler.Handle(
            new UpdateOrgCommand(Guid.NewGuid(), "Rieth-Riley", null),
            repository, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.NotFound);
    }

    [Fact]
    public async Task Handle_WhenNameChanges_ReturnsConflictAndDoesNotPersist()
    {
        var repository = new FakeOrgRepository();
        var org = Org.Create("Rieth-Riley").Value;
        repository.Seed(org);

        var result = await UpdateOrgHandler.Handle(
            new UpdateOrgCommand(org.Id, "Renamed Co", null),
            repository, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Conflict);
        repository.SaveChangesCount.ShouldBe(0);
    }

    [Fact]
    [Trait("Invariant", "I-D12")]
    public async Task Handle_WithSameNameAndTenantId_ConfiguresSso()
    {
        var repository = new FakeOrgRepository();
        var org = Org.Create("Rieth-Riley").Value;
        repository.Seed(org);
        var tenantId = Guid.NewGuid();

        var result = await UpdateOrgHandler.Handle(
            new UpdateOrgCommand(org.Id, "Rieth-Riley", tenantId),
            repository, CancellationToken.None);

        result.IsError.ShouldBeFalse();
        result.Value.TenantId.ShouldBe(tenantId);
        repository.SaveChangesCount.ShouldBe(1);
    }

    [Fact]
    [Trait("Invariant", "I-D12")]
    public async Task Handle_WithSameNameAndNullTenantId_DisablesSso()
    {
        var repository = new FakeOrgRepository();
        var org = Org.Create("Rieth-Riley").Value;
        org.ConfigureSso(Guid.NewGuid());
        repository.Seed(org);

        var result = await UpdateOrgHandler.Handle(
            new UpdateOrgCommand(org.Id, "Rieth-Riley", null),
            repository, CancellationToken.None);

        result.IsError.ShouldBeFalse();
        result.Value.TenantId.ShouldBeNull();
    }

    [Fact]
    [Trait("Invariant", "I-D12")]
    public async Task Handle_WithEmptyTenantId_ReturnsValidationError()
    {
        var repository = new FakeOrgRepository();
        var org = Org.Create("Rieth-Riley").Value;
        repository.Seed(org);

        var result = await UpdateOrgHandler.Handle(
            new UpdateOrgCommand(org.Id, "Rieth-Riley", Guid.Empty),
            repository, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
    }
}
