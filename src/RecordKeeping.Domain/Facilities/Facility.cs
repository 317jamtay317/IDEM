using ErrorOr;
using RecordKeeping.Domain.Common;

namespace RecordKeeping.Domain.Facilities;

/// <summary>
/// A physical location operated by an Org where regulated activity occurs — for asphalt
/// customers, an asphalt plant. An aggregate root in its own right that references its owning
/// Org by <see cref="OrgId"/> (I-D06).
/// </summary>
/// <remarks>
/// Constructed only via <see cref="Create"/>. Per I-D06, every Facility belongs to exactly
/// one Org; its <see cref="OrgId"/> is assigned at creation and never changes, and cross-Org
/// transfer is not supported.
/// </remarks>
public sealed class Facility : AggregateRoot<Guid>
{
    /// <summary>Maximum permitted length of a Facility <see cref="Name"/>.</summary>
    public const int MaxNameLength = 200;

    /// <summary>The Org that owns this Facility. Immutable (I-D06).</summary>
    public Guid OrgId { get; }

    /// <summary>Human-readable name of the Facility (e.g. the plant name).</summary>
    public string Name { get; private set; }

    /// <summary>
    /// Gets the collection of unique identifiers for users associated with the Facility.
    /// </summary>
    /// <remarks>
    /// This list contains the IDs of users who have been added to the Facility via <see cref="AddUser"/>
    /// and excludes any users removed via <see cref="RemoveUser"/>. Each user ID represents a user
    /// who can interact with or view the Facility, as determined by <see cref="UserCanView(Guid)"/>.
    /// </remarks>
    public IReadOnlyCollection<Guid> UserIds => _userIds;

    /// <summary>
    /// Represents the collection of monthly limits associated with a <see cref="Facility"/>.
    /// Each limit specifies the allowable threshold for a particular emission type.
    /// </summary>
    /// <remarks>
    /// Monthly limits are defined per facility and are immutable once set. These constraints help ensure
    /// adherence to regulatory requirements on an ongoing basis.
    /// </remarks>
    public IReadOnlyCollection<MonthlyLimit> Limits => _limits;

    /// <summary>
    /// The Facility's active license — the one with the latest <see cref="License.ExpirationDate"/> —
    /// or <see langword="null"/> when the Facility has no licenses.
    /// </summary>
    public License? ActiveLicense => _licenses.MaxBy(license => license.ExpirationDate);

    /// <summary>
    /// Collection of licenses associated with the facility, representing regulatory or operational permissions.
    /// </summary>
    /// <remarks>
    /// Each license in this collection is tied to the facility and must be managed in accordance with
    /// its <see cref="License.ExpirationDate"/> and associated <see cref="License.Value"/>. Licenses are added
    /// or removed using <see cref="AddLicense"/> and <see cref="RemoveLicense"/> respectively, ensuring compliance
    /// with domain rules.
    /// </remarks>
    public IReadOnlyCollection<License> Licenses => _licenses;

    private Facility(Guid id, Guid orgId, string name) : base(id)
    {
        OrgId = orgId;
        Name = name;
    }

    /// <summary>
    /// Adds a user to the Facility's user list, granting them access. Raises
    /// <see cref="UserAddedToFacility"/> when the user was not already present.
    /// </summary>
    /// <param name="userId">The unique identifier of the user to be added.</param>
    /// <returns>
    /// <see cref="Result.Success"/>, or <see cref="FacilityErrors.UserAlreadyInFacility"/>
    /// if the user is already in the list.
    /// </returns>
    public ErrorOr<Success> AddUser(Guid userId)
    {
        if (_userIds.Contains(userId))
            return FacilityErrors.UserAlreadyInFacility;

        _userIds.Add(userId);
        RaiseDomainEvent(new UserAddedToFacility(Id, userId));
        return Result.Success;
    }

    /// <summary>
    /// Removes a user from the Facility's user list, revoking their access. Raises
    /// <see cref="UserRemovedFromFacility"/> when the user was present.
    /// </summary>
    /// <param name="userId">The unique identifier of the user to be removed.</param>
    /// <returns>
    /// <see cref="Result.Success"/>, or <see cref="FacilityErrors.UserNotInFacility"/>
    /// if the user is not in the list.
    /// </returns>
    public ErrorOr<Success> RemoveUser(Guid userId)
    {
        if (!_userIds.Contains(userId))
            return FacilityErrors.UserNotInFacility;

        _userIds.Remove(userId);
        RaiseDomainEvent(new UserRemovedFromFacility(Id, userId));
        return Result.Success;
    }

    /// <summary>
    /// Determines whether a user has permission to view the Facility.
    /// </summary>
    /// <param name="userId">The unique identifier of the user whose access is being validated.</param>
    /// <returns>
    /// A boolean value indicating whether the specified user has view access to the Facility.
    /// </returns>
    /// <exception cref="NotImplementedException">Thrown when the method is not implemented.</exception>
    public bool UserCanView(Guid userId) => _userIds.Contains(userId);

    /// <summary>
    /// Creates a new Facility owned by <paramref name="orgId"/> (I-D06).
    /// </summary>
    /// <param name="orgId">The owning Org's id; required and immutable thereafter.</param>
    /// <param name="name">
    /// The Facility's name; required, trimmed, and at most <see cref="MaxNameLength"/> characters.
    /// </param>
    /// <returns>The new Facility, or a validation error when the org id or name is invalid.</returns>
    public static ErrorOr<Facility> Create(Guid orgId, string name)
    {
        if (orgId == Guid.Empty)
        {
            // I-D06: a Facility cannot exist without an owning Org.
            return Error.Validation("Facility.OrgId.Empty", "OrgId is required for a Facility.");
        }

        var validated = ValidateName(name);
        if (validated.IsError)
        {
            return validated.Errors;
        }

        return new Facility(Guid.NewGuid(), orgId, validated.Value);
    }

    /// <summary>
    /// Renames this Facility. Changes the name only; the owning <see cref="OrgId"/> is never
    /// touched (I-D06).
    /// </summary>
    /// <param name="name">
    /// The new name; required, trimmed, and at most <see cref="MaxNameLength"/> characters.
    /// </param>
    /// <returns>Success, or a validation error when the name is invalid.</returns>
    public ErrorOr<Success> Rename(string name)
    {
        var validated = ValidateName(name);
        if (validated.IsError)
        {
            return validated.Errors;
        }

        Name = validated.Value;
        return Result.Success;
    }

    /// <summary>
    /// Adds a license to the Facility, provided it has not already expired. Raises
    /// <see cref="LicenseAdded"/> on success.
    /// </summary>
    /// <param name="license">The license to add.</param>
    /// <returns>
    /// <see cref="Result.Success"/>, or <see cref="FacilityErrors.LicenseExpirationDateIsBeforeNow"/>
    /// if the license's <see cref="License.ExpirationDate"/> is in the past.
    /// </returns>
    public ErrorOr<Success> AddLicense(License license)
    {
        if (license.ExpirationDate < DateOnly.FromDateTime(DateTime.Today))
            return FacilityErrors.LicenseExpirationDateIsBeforeNow;

        _licenses.Add(license);
        RaiseDomainEvent(new LicenseAdded(Id, license.Id));
        return Result.Success;
    }

    /// <summary>
    /// Removes a license from the Facility. Raises <see cref="LicenseRemoved"/> on success. A Facility
    /// must retain at least one license, so the last remaining license cannot be removed.
    /// </summary>
    /// <param name="licenseId">The unique identifier of the license to be removed.</param>
    /// <returns>
    /// <see cref="Result.Success"/>; <see cref="FacilityErrors.LicenseDoesntExist"/> if no such license
    /// exists; or <see cref="FacilityErrors.MustHaveMultipleLicensesToRemove"/> if it is the only license.
    /// </returns>
    public ErrorOr<Success> RemoveLicense(Guid licenseId)
    {
        if (!Licenses.Any(l => l.Id == licenseId))
            return FacilityErrors.LicenseDoesntExist;
        if (Licenses.Count() <= 1) return FacilityErrors.MustHaveMultipleLicensesToRemove;
        _licenses.Remove(Licenses.First(l => l.Id == licenseId));
        RaiseDomainEvent(new LicenseRemoved(Id, licenseId));
        return Result.Success;
    }

    /// <summary>
    /// Gets the license in force on <paramref name="date"/> — among the licenses still valid on that
    /// date (<see cref="License.ExpirationDate"/> on or after it, inclusive), the one with the earliest
    /// expiration.
    /// </summary>
    /// <param name="date">The date to find the in-force license for.</param>
    /// <returns>
    /// The license in force on <paramref name="date"/>, or
    /// <see cref="FacilityErrors.NoValidLicenseForDate"/> if no license is valid on it.
    /// </returns>
    public ErrorOr<License> GetLicenseByDate(DateOnly date)
    {
        var license = _licenses
            .Where(l => l.ExpirationDate >= date)
            .OrderBy(l => l.ExpirationDate)
            .FirstOrDefault();

        if (license is null)
            return FacilityErrors.NoValidLicenseForDate;

        return license;
    }

    private static ErrorOr<string> ValidateName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return Error.Validation("Facility.Name.Empty", "Name cannot be empty.");
        }

        var trimmed = name.Trim();
        if (trimmed.Length > MaxNameLength)
        {
            return Error.Validation(
                "Facility.Name.TooLong",
                $"Name cannot exceed {MaxNameLength} characters.");
        }

        return trimmed;
    }
    
    private List<Guid> _userIds = [];
    private List<MonthlyLimit> _limits = [];
    private List<License> _licenses = [];
}
