using ErrorOr;
using RecordKeeping.Application.Orgs;
using RecordKeeping.Application.Tests.Facilities;
using RecordKeeping.Domain.Orgs;
using Shouldly;

namespace RecordKeeping.Application.Tests.Orgs;

public class UpdateOrgHandlerTests
{
    [Fact]
    public async Task Handle_WhenOrgMissing_ReturnsNotFound()
    {
        var orgs = new FakeOrgRepository();
        var facilities = new FakeFacilityRepository();

        var result = await UpdateOrgHandler.Handle(
            new UpdateOrgCommand(Guid.NewGuid(), "Rieth-Riley", null),
            orgs, facilities, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.NotFound);
    }

    [Fact]
    public async Task Handle_WhenNameChanges_ReturnsConflictAndDoesNotPersist()
    {
        var orgs = new FakeOrgRepository();
        var facilities = new FakeFacilityRepository();
        var org = Org.Create("Rieth-Riley").Value;
        orgs.Seed(org);

        var result = await UpdateOrgHandler.Handle(
            new UpdateOrgCommand(org.Id, "Renamed Co", null),
            orgs, facilities, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Conflict);
        orgs.SaveChangesCount.ShouldBe(0);
    }

    [Fact]
    [Trait("Invariant", "I-D12")]
    public async Task Handle_WithSameNameAndTenantId_ConfiguresSso()
    {
        var orgs = new FakeOrgRepository();
        var facilities = new FakeFacilityRepository();
        var org = Org.Create("Rieth-Riley").Value;
        orgs.Seed(org);
        var tenantId = Guid.NewGuid();

        var result = await UpdateOrgHandler.Handle(
            new UpdateOrgCommand(org.Id, "Rieth-Riley", tenantId),
            orgs, facilities, CancellationToken.None);

        result.IsError.ShouldBeFalse();
        result.Value.TenantId.ShouldBe(tenantId);
        orgs.SaveChangesCount.ShouldBe(1);
    }

    [Fact]
    [Trait("Invariant", "I-D12")]
    public async Task Handle_WithSameNameAndNullTenantId_DisablesSso()
    {
        var orgs = new FakeOrgRepository();
        var facilities = new FakeFacilityRepository();
        var org = Org.Create("Rieth-Riley").Value;
        org.ConfigureSso(Guid.NewGuid());
        orgs.Seed(org);

        var result = await UpdateOrgHandler.Handle(
            new UpdateOrgCommand(org.Id, "Rieth-Riley", null),
            orgs, facilities, CancellationToken.None);

        result.IsError.ShouldBeFalse();
        result.Value.TenantId.ShouldBeNull();
    }

    [Fact]
    [Trait("Invariant", "I-D12")]
    public async Task Handle_WithEmptyTenantId_ReturnsValidationError()
    {
        var orgs = new FakeOrgRepository();
        var facilities = new FakeFacilityRepository();
        var org = Org.Create("Rieth-Riley").Value;
        orgs.Seed(org);

        var result = await UpdateOrgHandler.Handle(
            new UpdateOrgCommand(org.Id, "Rieth-Riley", Guid.Empty),
            orgs, facilities, CancellationToken.None);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
    }
}
