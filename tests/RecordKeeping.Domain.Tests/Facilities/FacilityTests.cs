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
    [Trait("Invariant", "I-D17")]
    public void AddPermit_ShouldAddPermit_WhenExpirationDateIsAfterNow()
    {
        //arrange
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;
        var permit = Permit.Create(facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(1)), "123456789");

        //act
        var result = facility.AddPermit(permit);

        //assert
        result.IsError.ShouldBeFalse();
        facility.Permits.ShouldContain(permit);
    }

    [Fact]
    [Trait("Invariant", "I-D17")]
    public void AddPermit_ShouldReturnError_WhenExpirationDateIsBeforeNow()
    {
        //arrange
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;
        var permit = Permit.Create(facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(-1)), "123456789");

        //act
        var result = facility.AddPermit(permit);

        //assert
        result.IsError.ShouldBeTrue();
        result.FirstError.ShouldBeEquivalentTo(FacilityErrors.PermitExpirationDateIsBeforeNow);
    }

    [Fact]
    public void ActivePermit_ShouldReturnThePermitWithLatestExpirationDate_WhenMultiplePermitsExist()
    {
        //arrange
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;
        var permit1 = Permit.Create(facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(30)), "123456789");
        var permit2 = Permit.Create(facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(10)), "987654321");
        facility.AddPermit(permit1);
        facility.AddPermit(permit2);

        //act

        //assert
        facility.ActivePermit.ShouldBe(permit1);
    }

    [Fact]
    public void RemovePermit_ShouldRemovePermitFromList_WhenMultiplePermitsExist()
    {
        //arrange
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;
        var permit1 = Permit.Create(facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(30)), "123456789");
        var permit2 = Permit.Create(facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(10)), "987654321");
        facility.AddPermit(permit1);
        facility.AddPermit(permit2);

        //act
        var result = facility.RemovePermit(permit2.Id);

        //assert
        result.IsError.ShouldBeFalse();
        facility.Permits.ShouldContain(permit1);
        facility.Permits.ShouldNotContain(permit2);
    }

    [Fact]
    [Trait("Invariant", "I-D18")]
    public void RemovePermit_ShouldReturnError_WhenOnlyOnePermitExists()
    {
        //arrange
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;
        var permit1 = Permit.Create(facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(30)), "123456789");
        facility.AddPermit(permit1);

        //act
        var result = facility.RemovePermit(permit1.Id);

        //assert
        result.IsError.ShouldBeTrue();
        result.FirstError.ShouldBeEquivalentTo(FacilityErrors.MustHaveMultiplePermitsToRemove);
        facility.Permits.ShouldContain(permit1);
    }

    [Fact]
    public void RemovePermit_ShouldReturnError_WhenNoPermitsExist()
    {
        //arrange
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;
        var permit1 = Permit.Create(facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(30)), "123456789");

        //act
        var result = facility.RemovePermit(permit1.Id);

        //assert
        result.IsError.ShouldBeTrue();
        result.FirstError.ShouldBe(FacilityErrors.PermitDoesntExist);
    }

    [Fact]
    public void ActivePermit_WhenNoPermitsExist_ReturnsNull()
    {
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;

        facility.ActivePermit.ShouldBeNull();
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
    public void AddPermit_WhenPermitAdded_RaisesPermitAddedEvent()
    {
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;
        var permit = Permit.Create(facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(1)), "123456789");

        facility.AddPermit(permit);

        var raised = facility.DomainEvents.ShouldHaveSingleItem().ShouldBeOfType<PermitAdded>();
        raised.FacilityId.ShouldBe(facility.Id);
        raised.PermitId.ShouldBe(permit.Id);
    }

    [Fact]
    [Trait("Invariant", "I-D17")]
    public void AddPermit_WhenExpirationDateIsBeforeNow_DoesNotRaiseEvent()
    {
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;
        var expired = Permit.Create(facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(-1)), "123456789");

        facility.AddPermit(expired);

        facility.DomainEvents.ShouldBeEmpty();
    }

    [Fact]
    public void RemovePermit_WhenPermitRemoved_RaisesPermitRemovedEvent()
    {
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;
        var permit1 = Permit.Create(facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(30)), "123456789");
        var permit2 = Permit.Create(facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(10)), "987654321");
        facility.AddPermit(permit1);
        facility.AddPermit(permit2);
        facility.ClearDomainEvents();

        facility.RemovePermit(permit2.Id);

        var raised = facility.DomainEvents.ShouldHaveSingleItem().ShouldBeOfType<PermitRemoved>();
        raised.FacilityId.ShouldBe(facility.Id);
        raised.PermitId.ShouldBe(permit2.Id);
    }

    [Fact]
    public void RemovePermit_WhenPermitDoesNotExist_DoesNotRaiseEvent()
    {
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;
        var permit1 = Permit.Create(facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(30)), "123456789");
        var permit2 = Permit.Create(facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(10)), "987654321");
        facility.AddPermit(permit1);
        facility.AddPermit(permit2);
        facility.ClearDomainEvents();

        facility.RemovePermit(Guid.NewGuid());

        facility.DomainEvents.ShouldBeEmpty();
    }

    [Fact]
    public void GetPermitByDate_WhenMultiplePermitsValid_ReturnsTheEarliestExpiringStillValidPermit()
    {
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;
        var current = Permit.Create(facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(30)), "CURRENT");
        var renewal = Permit.Create(facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(395)), "RENEWAL");
        facility.AddPermit(current);
        facility.AddPermit(renewal);

        var result = facility.GetPermitByDate(DateOnly.FromDateTime(DateTime.Today.AddDays(10)));

        result.IsError.ShouldBeFalse();
        result.Value.ShouldBe(current);
    }

    [Fact]
    public void GetPermitByDate_WhenEarliestPermitHasExpired_ReturnsTheNextValidPermit()
    {
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;
        var current = Permit.Create(facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(30)), "CURRENT");
        var renewal = Permit.Create(facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(395)), "RENEWAL");
        facility.AddPermit(current);
        facility.AddPermit(renewal);

        var result = facility.GetPermitByDate(DateOnly.FromDateTime(DateTime.Today.AddDays(100)));

        result.IsError.ShouldBeFalse();
        result.Value.ShouldBe(renewal);
    }

    [Fact]
    public void GetPermitByDate_WhenPermitExpiresExactlyOnThatDate_IsStillValid()
    {
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;
        var expiresOnDate = DateOnly.FromDateTime(DateTime.Today.AddDays(30));
        var permit = Permit.Create(facility.Id, expiresOnDate, "123456789");
        facility.AddPermit(permit);

        var result = facility.GetPermitByDate(expiresOnDate);

        result.IsError.ShouldBeFalse();
        result.Value.ShouldBe(permit);
    }

    [Fact]
    public void GetPermitByDate_WhenNoPermitValidForDate_ReturnsNoValidPermitForDateError()
    {
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;
        var permit = Permit.Create(facility.Id, DateOnly.FromDateTime(DateTime.Today.AddDays(30)), "123456789");
        facility.AddPermit(permit);

        var result = facility.GetPermitByDate(DateOnly.FromDateTime(DateTime.Today.AddDays(60)));

        result.IsError.ShouldBeTrue();
        result.FirstError.ShouldBe(FacilityErrors.NoValidPermitForDate);
    }

    [Fact]
    public void AddLimit_WhenNoLimitForType_AddsLimit()
    {
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;

        var result = facility.AddLimit(EmissionType.VOC, 12.5);

        result.IsError.ShouldBeFalse();
        facility.Limits.ShouldContain(l => l.EmissionType == EmissionType.VOC && l.Value == 12.5);
    }

    [Fact]
    public void AddLimit_AllowsMultipleLimitsForDifferentTypes()
    {
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;

        facility.AddLimit(EmissionType.VOC, 5);
        var result = facility.AddLimit(EmissionType.NOx, 7);

        result.IsError.ShouldBeFalse();
        facility.Limits.Count.ShouldBe(2);
    }

    [Fact]
    [Trait("Invariant", "I-D19")]
    public void AddLimit_WhenLimitForTypeAlreadyExists_ReturnsError()
    {
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;
        facility.AddLimit(EmissionType.VOC, 5);

        var result = facility.AddLimit(EmissionType.VOC, 9);

        result.IsError.ShouldBeTrue();
        result.FirstError.ShouldBe(FacilityErrors.LimitAlreadyExistsForType);
        // I-D19: the original limit is unchanged; no second VOC limit is added.
        facility.Limits.Count.ShouldBe(1);
        facility.Limits.ShouldContain(l => l.EmissionType == EmissionType.VOC && l.Value == 5);
    }

    [Fact]
    [Trait("Invariant", "I-D20")]
    public void AddLimit_WithNonPositiveValue_ReturnsError()
    {
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;

        var result = facility.AddLimit(EmissionType.SO2, 0);

        result.IsError.ShouldBeTrue();
        result.FirstError.ShouldBe(FacilityErrors.LimitValueMustBePositive);
        facility.Limits.ShouldBeEmpty();
    }

    [Fact]
    public void AddLimit_WhenAdded_RaisesMonthlyLimitAddedEvent()
    {
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;

        facility.AddLimit(EmissionType.VOC, 5);

        var raised = facility.DomainEvents.ShouldHaveSingleItem().ShouldBeOfType<MonthlyLimitAdded>();
        raised.FacilityId.ShouldBe(facility.Id);
        raised.EmissionType.ShouldBe(EmissionType.VOC);
    }

    [Fact]
    [Trait("Invariant", "I-D19")]
    public void AddLimit_WhenDuplicateType_DoesNotRaiseEvent()
    {
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;
        facility.AddLimit(EmissionType.VOC, 5);
        facility.ClearDomainEvents();

        facility.AddLimit(EmissionType.VOC, 9);

        facility.DomainEvents.ShouldBeEmpty();
    }

    [Fact]
    public void UpdateLimit_WhenLimitExists_ChangesValue()
    {
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;
        facility.AddLimit(EmissionType.VOC, 5);

        var result = facility.UpdateLimit(EmissionType.VOC, 8.25);

        result.IsError.ShouldBeFalse();
        facility.Limits.Count.ShouldBe(1);
        facility.Limits.ShouldContain(l => l.EmissionType == EmissionType.VOC && l.Value == 8.25);
    }

    [Fact]
    public void UpdateLimit_WhenNoLimitForType_ReturnsError()
    {
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;

        var result = facility.UpdateLimit(EmissionType.VOC, 8);

        result.IsError.ShouldBeTrue();
        result.FirstError.ShouldBe(FacilityErrors.LimitDoesntExistForType);
    }

    [Fact]
    [Trait("Invariant", "I-D20")]
    public void UpdateLimit_WithNonPositiveValue_ReturnsError()
    {
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;
        facility.AddLimit(EmissionType.VOC, 5);

        var result = facility.UpdateLimit(EmissionType.VOC, -3);

        result.IsError.ShouldBeTrue();
        result.FirstError.ShouldBe(FacilityErrors.LimitValueMustBePositive);
        // The original limit is left intact when the new value is invalid.
        facility.Limits.ShouldContain(l => l.EmissionType == EmissionType.VOC && l.Value == 5);
    }

    [Fact]
    public void UpdateLimit_WhenUpdated_RaisesMonthlyLimitUpdatedEvent()
    {
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;
        facility.AddLimit(EmissionType.VOC, 5);
        facility.ClearDomainEvents();

        facility.UpdateLimit(EmissionType.VOC, 8);

        var raised = facility.DomainEvents.ShouldHaveSingleItem().ShouldBeOfType<MonthlyLimitUpdated>();
        raised.FacilityId.ShouldBe(facility.Id);
        raised.EmissionType.ShouldBe(EmissionType.VOC);
    }

    [Fact]
    public void RemoveLimit_WhenLimitExists_RemovesIt()
    {
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;
        facility.AddLimit(EmissionType.VOC, 5);
        facility.AddLimit(EmissionType.NOx, 7);

        var result = facility.RemoveLimit(EmissionType.VOC);

        result.IsError.ShouldBeFalse();
        facility.Limits.ShouldNotContain(l => l.EmissionType == EmissionType.VOC);
        facility.Limits.ShouldContain(l => l.EmissionType == EmissionType.NOx);
    }

    [Fact]
    public void RemoveLimit_WhenNoLimitForType_ReturnsError()
    {
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;

        var result = facility.RemoveLimit(EmissionType.VOC);

        result.IsError.ShouldBeTrue();
        result.FirstError.ShouldBe(FacilityErrors.LimitDoesntExistForType);
    }

    [Fact]
    public void RemoveLimit_WhenRemoved_RaisesMonthlyLimitRemovedEvent()
    {
        var facility = Facility.Create(Guid.NewGuid(), "Goshen Plant").Value;
        facility.AddLimit(EmissionType.VOC, 5);
        facility.ClearDomainEvents();

        facility.RemoveLimit(EmissionType.VOC);

        var raised = facility.DomainEvents.ShouldHaveSingleItem().ShouldBeOfType<MonthlyLimitRemoved>();
        raised.FacilityId.ShouldBe(facility.Id);
        raised.EmissionType.ShouldBe(EmissionType.VOC);
    }
}
