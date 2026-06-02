using ErrorOr;
using RecordKeeping.Domain.Facilities;
using Shouldly;

namespace RecordKeeping.Domain.Tests.Facilities;

public class FacilityTests
{
    [Fact]
    [Trait("Invariant", "I-D06")]
    public void Create_WithValidNameAndOrg_ReturnsFacility()
    {
        var orgId = Guid.NewGuid();

        var result = Facility.Create(orgId, "Goshen Plant");

        result.IsError.ShouldBeFalse();
        var facility = result.Value;
        facility.Id.ShouldNotBe(Guid.Empty);
        facility.OrgId.ShouldBe(orgId);
        facility.Name.ShouldBe("Goshen Plant");
    }

    [Fact]
    public void Create_TrimsName()
    {
        var result = Facility.Create(Guid.NewGuid(), "  Goshen Plant  ");

        result.IsError.ShouldBeFalse();
        result.Value.Name.ShouldBe("Goshen Plant");
    }

    [Fact]
    [Trait("Invariant", "I-D06")]
    public void Create_WithEmptyOrgId_ReturnsValidationError()
    {
        var result = Facility.Create(Guid.Empty, "Goshen Plant");

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_WithEmptyOrWhitespaceName_ReturnsValidationError(string name)
    {
        var result = Facility.Create(Guid.NewGuid(), name);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
    }

    [Fact]
    public void Create_WithNameExceedingMaxLength_ReturnsValidationError()
    {
        var tooLong = new string('a', Facility.MaxNameLength + 1);

        var result = Facility.Create(Guid.NewGuid(), tooLong);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
    }

    [Fact]
    public void Rename_WithValidName_ChangesName()
    {
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;

        var result = facility.Rename("Goshen Asphalt Plant");

        result.IsError.ShouldBeFalse();
        facility.Name.ShouldBe("Goshen Asphalt Plant");
    }

    [Fact]
    public void Rename_TrimsName()
    {
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;

        facility.Rename("  Goshen Asphalt Plant  ");

        facility.Name.ShouldBe("Goshen Asphalt Plant");
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Rename_WithEmptyOrWhitespaceName_ReturnsValidationError(string name)
    {
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;

        var result = facility.Rename(name);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
    }

    [Fact]
    [Trait("Invariant", "I-D06")]
    public void Rename_DoesNotChangeOwningOrg()
    {
        var orgId = Guid.NewGuid();
        var facility = Facility.Create(orgId, "Goshen Plant").Value;

        facility.Rename("Renamed Plant");

        // I-D06: a Facility's OrgId is immutable; renaming touches only the name.
        facility.OrgId.ShouldBe(orgId);
    }
}
