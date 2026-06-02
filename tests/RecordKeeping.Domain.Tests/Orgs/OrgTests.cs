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
    public void RenameFacility_WithValidName_RenamesFacility()
    {
        var org = Org.Create("Rieth-Riley").Value;
        var facility = org.AddFacility("Goshen Plant").Value;

        var result = org.RenameFacility(facility.Id, "Goshen Asphalt Plant");

        result.IsError.ShouldBeFalse();
        result.Value.Id.ShouldBe(facility.Id);
        result.Value.Name.ShouldBe("Goshen Asphalt Plant");
        org.Facilities.Single(f => f.Id == facility.Id).Name.ShouldBe("Goshen Asphalt Plant");
    }

    [Fact]
    [Trait("Invariant", "I-D06")]
    public void RenameFacility_DoesNotChangeOwningOrg()
    {
        var org = Org.Create("Rieth-Riley").Value;
        var facility = org.AddFacility("Goshen Plant").Value;

        var result = org.RenameFacility(facility.Id, "Renamed Plant");

        // I-D06: a Facility's OrgId is immutable; renaming touches only the name.
        result.Value.OrgId.ShouldBe(org.Id);
    }

    [Fact]
    public void RenameFacility_TrimsName()
    {
        var org = Org.Create("Rieth-Riley").Value;
        var facility = org.AddFacility("Goshen Plant").Value;

        var result = org.RenameFacility(facility.Id, "  Goshen Asphalt Plant  ");

        result.IsError.ShouldBeFalse();
        result.Value.Name.ShouldBe("Goshen Asphalt Plant");
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void RenameFacility_WithEmptyOrWhitespaceName_ReturnsValidationError(string name)
    {
        var org = Org.Create("Rieth-Riley").Value;
        var facility = org.AddFacility("Goshen Plant").Value;

        var result = org.RenameFacility(facility.Id, name);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
    }

    [Fact]
    public void RenameFacility_WithNameExceedingMaxLength_ReturnsValidationError()
    {
        var org = Org.Create("Rieth-Riley").Value;
        var facility = org.AddFacility("Goshen Plant").Value;
        var tooLong = new string('a', Org.MaxNameLength + 1);

        var result = org.RenameFacility(facility.Id, tooLong);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
    }

    [Fact]
    public void RenameFacility_WhenFacilityNotFound_ReturnsNotFound()
    {
        var org = Org.Create("Rieth-Riley").Value;
        org.AddFacility("Goshen Plant");

        var result = org.RenameFacility(Guid.NewGuid(), "Whatever");

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.NotFound);
    }

    [Fact]
    public void RemoveFacility_RemovesFacility()
    {
        var org = Org.Create("Rieth-Riley").Value;
        var facility = org.AddFacility("Goshen Plant").Value;

        var result = org.RemoveFacility(facility.Id);

        result.IsError.ShouldBeFalse();
        org.Facilities.ShouldNotContain(f => f.Id == facility.Id);
    }

    [Fact]
    public void RemoveFacility_OnlyRemovesTargetFacility()
    {
        var org = Org.Create("Rieth-Riley").Value;
        var goshen = org.AddFacility("Goshen Plant").Value;
        var fortWayne = org.AddFacility("Fort Wayne Plant").Value;

        org.RemoveFacility(goshen.Id);

        org.Facilities.Count.ShouldBe(1);
        org.Facilities.ShouldContain(f => f.Id == fortWayne.Id);
    }

    [Fact]
    public void RemoveFacility_WhenFacilityNotFound_ReturnsNotFound()
    {
        var org = Org.Create("Rieth-Riley").Value;
        org.AddFacility("Goshen Plant");

        var result = org.RemoveFacility(Guid.NewGuid());

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.NotFound);
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
