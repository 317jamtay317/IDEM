using ErrorOr;
using RecordKeeping.Domain.Orgs;
using Shouldly;

namespace RecordKeeping.Domain.Tests.Orgs;

public class OrgTests
{
    [Fact]
    public void Create_WithValidName_ReturnsOrg()
    {
        var result = Org.Create("Rieth-Riley");

        result.IsError.ShouldBeFalse();
        var org = result.Value;
        org.Id.ShouldNotBe(Guid.Empty);
        org.Name.ShouldBe("Rieth-Riley");
        org.TenantId.ShouldBeNull();
        org.Facilities.ShouldBeEmpty();
    }

    [Fact]
    public void Create_TrimsName()
    {
        var result = Org.Create("  Rieth-Riley  ");

        result.IsError.ShouldBeFalse();
        result.Value.Name.ShouldBe("Rieth-Riley");
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_WithEmptyOrWhitespaceName_ReturnsValidationError(string name)
    {
        var result = Org.Create(name);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
    }

    [Fact]
    public void Create_WithNameExceedingMaxLength_ReturnsValidationError()
    {
        var tooLong = new string('a', Org.MaxNameLength + 1);

        var result = Org.Create(tooLong);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
    }

    [Fact]
    public void Create_WithNameAtMaxLength_ReturnsOrg()
    {
        var atLimit = new string('a', Org.MaxNameLength);

        var result = Org.Create(atLimit);

        result.IsError.ShouldBeFalse();
        result.Value.Name.ShouldBe(atLimit);
    }

    [Fact]
    [Trait("Invariant", "I-D06")]
    public void AddFacility_AddsFacilityOwnedByThisOrg()
    {
        var org = Org.Create("Rieth-Riley").Value;

        var result = org.AddFacility("Goshen Plant");

        result.IsError.ShouldBeFalse();
        var facility = result.Value;
        facility.Id.ShouldNotBe(Guid.Empty);
        facility.OrgId.ShouldBe(org.Id);
        facility.Name.ShouldBe("Goshen Plant");
        org.Facilities.ShouldContain(facility);
    }

    [Fact]
    [Trait("Invariant", "I-D06")]
    public void AddFacility_TrimsName()
    {
        var org = Org.Create("Rieth-Riley").Value;

        var result = org.AddFacility("  Goshen Plant  ");

        result.IsError.ShouldBeFalse();
        result.Value.Name.ShouldBe("Goshen Plant");
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void AddFacility_WithEmptyOrWhitespaceName_ReturnsValidationError(string name)
    {
        var org = Org.Create("Rieth-Riley").Value;

        var result = org.AddFacility(name);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
    }

    [Fact]
    [Trait("Invariant", "I-D06")]
    public void AddFacility_AllowsManyFacilitiesPerOrg()
    {
        var org = Org.Create("Rieth-Riley").Value;

        org.AddFacility("Goshen Plant");
        org.AddFacility("Fort Wayne Plant");

        org.Facilities.Count.ShouldBe(2);
    }

    [Fact]
    [Trait("Invariant", "I-D12")]
    public void ConfigureSso_SetsTenantId()
    {
        var org = Org.Create("Rieth-Riley").Value;
        var tenantId = Guid.NewGuid();

        var result = org.ConfigureSso(tenantId);

        result.IsError.ShouldBeFalse();
        org.TenantId.ShouldBe(tenantId);
    }

    [Fact]
    [Trait("Invariant", "I-D12")]
    public void ConfigureSso_WithEmptyTenantId_ReturnsValidationError()
    {
        var org = Org.Create("Rieth-Riley").Value;

        var result = org.ConfigureSso(Guid.Empty);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
    }

    [Fact]
    [Trait("Invariant", "I-D12")]
    public void DisableSso_ClearsTenantId()
    {
        var org = Org.Create("Rieth-Riley").Value;
        org.ConfigureSso(Guid.NewGuid());

        org.DisableSso();

        org.TenantId.ShouldBeNull();
    }
}
