using ErrorOr;
using RecordKeeping.Domain.Users;
using Shouldly;

namespace RecordKeeping.Domain.Tests.Users;

public class UserTests
{
    private static Email AnEmail(string value = "user@example.com") => Email.Create(value).Value;

    [Fact]
    [Trait("Invariant", "I-D13")]
    public void CreateSiteAdmin_ReturnsSiteAdminWithNoOrgId()
    {
        var result = User.CreateSiteAdmin(AnEmail("admin@recordkeeping.local"), "Site Admin");

        result.IsError.ShouldBeFalse();
        var user = result.Value;
        user.IsSiteAdmin.ShouldBeTrue();
        user.OrgId.ShouldBeNull();
        user.Email.Value.ShouldBe("admin@recordkeeping.local");
        user.DisplayName.ShouldBe("Site Admin");
        user.Id.ShouldNotBe(Guid.Empty);
    }

    [Fact]
    [Trait("Invariant", "I-D13")]
    public void CreateOrgUser_ReturnsOrgUserWithOrgIdAndIsNotSiteAdmin()
    {
        var orgId = Guid.NewGuid();

        var result = User.CreateOrgUser(AnEmail(), "Org User", orgId);

        result.IsError.ShouldBeFalse();
        var user = result.Value;
        user.IsSiteAdmin.ShouldBeFalse();
        user.OrgId.ShouldBe(orgId);
        user.DisplayName.ShouldBe("Org User");
        user.Id.ShouldNotBe(Guid.Empty);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void CreateSiteAdmin_WithEmptyDisplayName_ReturnsValidationError(string displayName)
    {
        var result = User.CreateSiteAdmin(AnEmail(), displayName);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void CreateOrgUser_WithEmptyDisplayName_ReturnsValidationError(string displayName)
    {
        var result = User.CreateOrgUser(AnEmail(), displayName, Guid.NewGuid());

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
    }

    [Fact]
    public void CreateOrgUser_WithEmptyOrgId_ReturnsValidationError()
    {
        var result = User.CreateOrgUser(AnEmail(), "Org User", Guid.Empty);

        result.IsError.ShouldBeTrue();
        result.FirstError.Type.ShouldBe(ErrorType.Validation);
    }
}
