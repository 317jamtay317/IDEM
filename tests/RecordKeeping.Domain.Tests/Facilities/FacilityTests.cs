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

    [Fact]
    public void AddUser_ShouldAddUserToList_WhenAlreadyNotInList()
    {
        //arrange
        var orgId = Guid.NewGuid();
        var facility = Facility.Create(orgId, "Goshen Plant").Value;
        
        var userId = Guid.NewGuid();
        
        //act
        var result = facility.AddUser(userId);
        
        //assert
        result.IsError.ShouldBeFalse();
        facility.UserIds.ShouldContain(userId);
    }

    [Fact]
    public void AddUser_ShouldNotAddUserToList_WhenAlreadyInList()
    {
        //arrange
        var orgId = Guid.NewGuid();
        var facility = Facility.Create(orgId, "Goshen Plant").Value;
        
        var userId = Guid.NewGuid();
        facility.AddUser(userId);
        
        //act
        var result = facility.AddUser(userId);
        
        //assert
        result.IsError.ShouldBeTrue();
        result.FirstError.ShouldBeEquivalentTo(FacilityErrors.UserAlreadyInFacility);
        facility.UserIds.ShouldContain(userId);
    }

    [Fact]
    public void UserCanViewFacility_ShouldReturnTrue_WhenUserIsInFacility()
    {
        //arrange
        var orgId = Guid.NewGuid();
        var facility = Facility.Create(orgId, "Goshen Plant").Value;
        var userId = Guid.NewGuid();
        facility.AddUser(userId);
        
        //act
        var canView = facility.UserCanView(userId);
        
        //assert
        canView.ShouldBeTrue();
    }

    [Fact]
    public void RemoveUser_ShouldRemoveUser_WhenInList()
    {
        //arrange
        var orgId = Guid.NewGuid();
        var facility = Facility.Create(orgId, "Goshen Plant").Value;
        var userId = Guid.NewGuid();
        facility.AddUser(userId);
        
        //act
        var result = facility.RemoveUser(userId);
        
        //assert
        result.IsError.ShouldBeFalse();
        facility.UserIds.ShouldNotContain(userId);
    }

    [Fact]
    public void RemoveUser_ShouldReturnError_WhenUserNotInList()
    {
        //arrange
        var orgId = Guid.NewGuid();
        var facility = Facility.Create(orgId, "Goshen Plant").Value;
        var userId = Guid.NewGuid();
        
        //act
        var result = facility.RemoveUser(userId);
        
        //assert
        result.IsError.ShouldBeTrue();
        result.FirstError.ShouldBeEquivalentTo(FacilityErrors.UserNotInFacility);
    }

    [Fact]
    public void AddLicense_ShouldAddALicenseToLicense_WhenExpirationDateIsAfterNow()
    {
        //arrange
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;
        var license = License.Create(facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(1)), "123456789");
        
        //act
        var result = facility.AddLicense(license);
        
        //assert
        result.IsError.ShouldBeFalse();
        facility.Licenses.ShouldContain(license);
    }

    [Fact]
    public void AddLicense_ShouldReturnError_WhenExpirationDateIsBeforeNow()
    {
        //arrange
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;
        var license = License.Create(facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(-1)), "123456789");
        
        //act
        var result = facility.AddLicense(license);
        
        //assert
        result.IsError.ShouldBeTrue();
        result.FirstError.ShouldBeEquivalentTo(FacilityErrors.LicenseExpirationDateIsBeforeNow);
    }

    [Fact]
    public void ActiveLicense_ShouldReturnTheLicenseWithLatestExpirationDate_WhenMultipleLicensesExist()
    {
        //arrange
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;
        var license1 = License.Create(facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(30)), "123456789");
        var license2 = License.Create(facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(10)), "987654321");
        facility.AddLicense(license1);
        facility.AddLicense(license2);
        
        //act
        
        //assert
        facility.ActiveLicense.ShouldBe(license1);
    }

    [Fact]
    public void RemoveLicense_ShouldRemoveLicenseFromList_WhenMultipleLicensesExist()
    {
        //arrange
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;
        var license1 = License.Create(facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(30)), "123456789");
        var license2 = License.Create(facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(10)), "987654321");
        facility.AddLicense(license1);
        facility.AddLicense(license2);
        
        //act
        var result = facility.RemoveLicense(license2.Id);
        
        //assert
        result.IsError.ShouldBeFalse();
        facility.Licenses.ShouldContain(license1);
        facility.Licenses.ShouldNotContain(license2);
    }

    [Fact]
    public void RemoveLicense_ShouldReturnError_WhenOnlyOneLicenseExists()
    {
        //arrange
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;
        var license1 = License.Create(facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(30)), "123456789");
        facility.AddLicense(license1);
        
        //act
        var result = facility.RemoveLicense(license1.Id);
        
        //assert
        result.IsError.ShouldBeTrue();
        result.FirstError.ShouldBeEquivalentTo(FacilityErrors.MustHaveMultipleLicensesToRemove);
        facility.Licenses.ShouldContain(license1);
    }

    [Fact]
    public void RemoveLicense_ShouldReturnError_WhenNoLicensesExist()
    {
        //arrange
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;
        var license1 = License.Create(facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(30)), "123456789");

        //act
        var result = facility.RemoveLicense(license1.Id);
        
        //assert
        result.IsError.ShouldBeTrue();
        result.FirstError.ShouldBe(FacilityErrors.LicenseDoesntExist);
    }

    [Fact]
    public void ActiveLicense_WhenNoLicensesExist_ReturnsNull()
    {
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;

        facility.ActiveLicense.ShouldBeNull();
    }

    [Fact]
    public void AddUser_WhenUserAdded_RaisesUserAddedToFacilityEvent()
    {
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;
        var userId = Guid.NewGuid();

        facility.AddUser(userId);

        var raised = facility.DomainEvents.ShouldHaveSingleItem().ShouldBeOfType<UserAddedToFacility>();
        raised.FacilityId.ShouldBe(facility.Id);
        raised.UserId.ShouldBe(userId);
    }

    [Fact]
    public void AddUser_WhenUserAlreadyInList_DoesNotRaiseEvent()
    {
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;
        var userId = Guid.NewGuid();
        facility.AddUser(userId);
        facility.ClearDomainEvents();

        facility.AddUser(userId);

        facility.DomainEvents.ShouldBeEmpty();
    }

    [Fact]
    public void RemoveUser_WhenUserRemoved_RaisesUserRemovedFromFacilityEvent()
    {
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;
        var userId = Guid.NewGuid();
        facility.AddUser(userId);
        facility.ClearDomainEvents();

        facility.RemoveUser(userId);

        var raised = facility.DomainEvents.ShouldHaveSingleItem().ShouldBeOfType<UserRemovedFromFacility>();
        raised.FacilityId.ShouldBe(facility.Id);
        raised.UserId.ShouldBe(userId);
    }

    [Fact]
    public void RemoveUser_WhenUserNotInList_DoesNotRaiseEvent()
    {
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;

        facility.RemoveUser(Guid.NewGuid());

        facility.DomainEvents.ShouldBeEmpty();
    }

    [Fact]
    public void AddLicense_WhenLicenseAdded_RaisesLicenseAddedEvent()
    {
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;
        var license = License.Create(facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(1)), "123456789");

        facility.AddLicense(license);

        var raised = facility.DomainEvents.ShouldHaveSingleItem().ShouldBeOfType<LicenseAdded>();
        raised.FacilityId.ShouldBe(facility.Id);
        raised.LicenseId.ShouldBe(license.Id);
    }

    [Fact]
    public void AddLicense_WhenExpirationDateIsBeforeNow_DoesNotRaiseEvent()
    {
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;
        var expired = License.Create(facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(-1)), "123456789");

        facility.AddLicense(expired);

        facility.DomainEvents.ShouldBeEmpty();
    }

    [Fact]
    public void RemoveLicense_WhenLicenseRemoved_RaisesLicenseRemovedEvent()
    {
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;
        var license1 = License.Create(facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(30)), "123456789");
        var license2 = License.Create(facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(10)), "987654321");
        facility.AddLicense(license1);
        facility.AddLicense(license2);
        facility.ClearDomainEvents();

        facility.RemoveLicense(license2.Id);

        var raised = facility.DomainEvents.ShouldHaveSingleItem().ShouldBeOfType<LicenseRemoved>();
        raised.FacilityId.ShouldBe(facility.Id);
        raised.LicenseId.ShouldBe(license2.Id);
    }

    [Fact]
    public void RemoveLicense_WhenLicenseDoesNotExist_DoesNotRaiseEvent()
    {
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;
        var license1 = License.Create(facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(30)), "123456789");
        var license2 = License.Create(facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(10)), "987654321");
        facility.AddLicense(license1);
        facility.AddLicense(license2);
        facility.ClearDomainEvents();

        facility.RemoveLicense(Guid.NewGuid());

        facility.DomainEvents.ShouldBeEmpty();
    }

    [Fact]
    public void GetLicenseByDate_WhenMultipleLicensesValid_ReturnsTheEarliestExpiringStillValidLicense()
    {
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;
        var current = License.Create(facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(30)), "CURRENT");
        var renewal = License.Create(facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(395)), "RENEWAL");
        facility.AddLicense(current);
        facility.AddLicense(renewal);

        var result = facility.GetLicenseByDate(DateOnly.FromDateTime(DateTime.Today.AddDays(10)));

        result.IsError.ShouldBeFalse();
        result.Value.ShouldBe(current);
    }

    [Fact]
    public void GetLicenseByDate_WhenEarliestLicenseHasExpired_ReturnsTheNextValidLicense()
    {
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;
        var current = License.Create(facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(30)), "CURRENT");
        var renewal = License.Create(facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(395)), "RENEWAL");
        facility.AddLicense(current);
        facility.AddLicense(renewal);

        var result = facility.GetLicenseByDate(DateOnly.FromDateTime(DateTime.Today.AddDays(100)));

        result.IsError.ShouldBeFalse();
        result.Value.ShouldBe(renewal);
    }

    [Fact]
    public void GetLicenseByDate_WhenLicenseExpiresExactlyOnThatDate_IsStillValid()
    {
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;
        var expiresOnDate = DateOnly.FromDateTime(DateTime.Today.AddDays(30));
        var license = License.Create(facility.Id, expiresOnDate, "123456789");
        facility.AddLicense(license);

        var result = facility.GetLicenseByDate(expiresOnDate);

        result.IsError.ShouldBeFalse();
        result.Value.ShouldBe(license);
    }

    [Fact]
    public void GetLicenseByDate_WhenNoLicenseValidForDate_ReturnsNoValidLicenseForDateError()
    {
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;
        var license = License.Create(facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(30)), "123456789");
        facility.AddLicense(license);

        var result = facility.GetLicenseByDate(DateOnly.FromDateTime(DateTime.Today.AddDays(60)));

        result.IsError.ShouldBeTrue();
        result.FirstError.ShouldBe(FacilityErrors.NoValidLicenseForDate);
    }
}
