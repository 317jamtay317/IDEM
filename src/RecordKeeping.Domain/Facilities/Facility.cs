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
    /// The Monthly Limits the Facility holds — each a tons/month cap on one <see cref="EmissionType"/>.
    /// </summary>
    /// <remarks>
    /// A Facility holds at most one Monthly Limit per Emission Type (I-D19). Manage them through
    /// <see cref="AddLimit"/>, <see cref="UpdateLimit"/> (change the tons value), and
    /// <see cref="RemoveLimit"/>, which enforce the Monthly Limit invariants (I-D19, I-D20).
    /// </remarks>
    public IReadOnlyCollection<MonthlyLimit> Limits => _limits;

    /// <summary>
    /// The Facility's active Permit — the one with the latest <see cref="Permit.ExpirationDate"/> —
    /// or <see langword="null"/> when the Facility holds no Permits.
    /// </summary>
    public Permit? ActivePermit => _permits.MaxBy(permit => permit.ExpirationDate);

    /// <summary>
    /// Collection of Permits the Facility holds, representing its regulatory authorizations to operate.
    /// </summary>
    /// <remarks>
    /// Permits are added or removed using <see cref="AddPermit"/> and <see cref="RemovePermit"/>,
    /// which enforce the Permit invariants (I-D17, I-D18).
    /// </remarks>
    public IReadOnlyCollection<Permit> Permits => _permits;

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
    /// <param name="userId">The unique identifier of the user whose access is being checked.</param>
    /// <returns>
    /// <see langword="true"/> when the user has been added to the Facility; otherwise <see langword="false"/>.
    /// </returns>
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
    /// Adds a Permit to the Facility, provided it has not already expired. Raises
    /// <see cref="PermitAdded"/> on success.
    /// </summary>
    /// <param name="permit">The Permit to add.</param>
    /// <returns>
    /// <see cref="Result.Success"/>, or <see cref="FacilityErrors.PermitExpirationDateIsBeforeNow"/>
    /// if the Permit's <see cref="Permit.ExpirationDate"/> is in the past.
    /// </returns>
    public ErrorOr<Success> AddPermit(Permit permit)
    {
        // I-D17: a Permit cannot be added once its expiration date is in the past.
        if (permit.ExpirationDate < DateOnly.FromDateTime(DateTime.Today))
            return FacilityErrors.PermitExpirationDateIsBeforeNow;

        _permits.Add(permit);
        RaiseDomainEvent(new PermitAdded(Id, permit.Id));
        return Result.Success;
    }

    /// <summary>
    /// Removes a Permit from the Facility. Raises <see cref="PermitRemoved"/> on success. A Facility
    /// must retain at least one Permit, so the last remaining Permit cannot be removed (I-D18).
    /// </summary>
    /// <param name="permitId">The unique identifier of the Permit to remove.</param>
    /// <returns>
    /// <see cref="Result.Success"/>; <see cref="FacilityErrors.PermitDoesntExist"/> if no such Permit
    /// exists; or <see cref="FacilityErrors.MustHaveMultiplePermitsToRemove"/> if it is the only Permit.
    /// </returns>
    public ErrorOr<Success> RemovePermit(Guid permitId)
    {
        if (!_permits.Any(p => p.Id == permitId))
            return FacilityErrors.PermitDoesntExist;

        // I-D18: a Facility must retain at least one Permit; the last one cannot be removed.
        if (_permits.Count <= 1)
            return FacilityErrors.MustHaveMultiplePermitsToRemove;

        _permits.Remove(_permits.First(p => p.Id == permitId));
        RaiseDomainEvent(new PermitRemoved(Id, permitId));
        return Result.Success;
    }

    /// <summary>
    /// Gets the Permit in force on <paramref name="date"/> — among the Permits still valid on that
    /// date (<see cref="Permit.ExpirationDate"/> on or after it, inclusive), the one with the earliest
    /// expiration.
    /// </summary>
    /// <param name="date">The date to find the in-force Permit for.</param>
    /// <returns>
    /// The Permit in force on <paramref name="date"/>, or
    /// <see cref="FacilityErrors.NoValidPermitForDate"/> if no Permit is valid on it.
    /// </returns>
    public ErrorOr<Permit> GetPermitByDate(DateOnly date)
    {
        var permit = _permits
            .Where(p => p.ExpirationDate >= date)
            .OrderBy(p => p.ExpirationDate)
            .FirstOrDefault();

        if (permit is null)
            return FacilityErrors.NoValidPermitForDate;

        return permit;
    }

    /// <summary>
    /// Adds a Monthly Limit of <paramref name="tons"/> tons/month on <paramref name="emissionType"/>.
    /// Raises <see cref="MonthlyLimitAdded"/> on success.
    /// </summary>
    /// <param name="emissionType">The pollutant the limit constrains.</param>
    /// <param name="tons">The cap in tons per month; must be positive (I-D20).</param>
    /// <returns>
    /// <see cref="Result.Success"/>; <see cref="FacilityErrors.LimitAlreadyExistsForType"/> when the
    /// Facility already holds a limit for <paramref name="emissionType"/> (I-D19); or
    /// <see cref="FacilityErrors.LimitValueMustBePositive"/> when <paramref name="tons"/> is not
    /// positive (I-D20).
    /// </returns>
    public ErrorOr<Success> AddLimit(EmissionType emissionType, double tons)
    {
        // I-D19: a Facility holds at most one Monthly Limit per Emission Type.
        if (_limits.Any(limit => limit.EmissionType == emissionType))
            return FacilityErrors.LimitAlreadyExistsForType;

        var limit = MonthlyLimit.Create(Id, emissionType, tons);
        if (limit.IsError)
            return limit.Errors;

        _limits.Add(limit.Value);
        RaiseDomainEvent(new MonthlyLimitAdded(Id, emissionType));
        return Result.Success;
    }

    /// <summary>
    /// Changes the tons value of the Monthly Limit for <paramref name="emissionType"/>. Raises
    /// <see cref="MonthlyLimitUpdated"/> on success. The Emission Type itself is the limit's
    /// identity and is never changed; to change it, remove the limit and add a new one.
    /// </summary>
    /// <param name="emissionType">The Emission Type whose limit value to change.</param>
    /// <param name="tons">The new cap in tons per month; must be positive (I-D20).</param>
    /// <returns>
    /// <see cref="Result.Success"/>; <see cref="FacilityErrors.LimitDoesntExistForType"/> when the
    /// Facility holds no limit for <paramref name="emissionType"/>; or
    /// <see cref="FacilityErrors.LimitValueMustBePositive"/> when <paramref name="tons"/> is not
    /// positive (I-D20).
    /// </returns>
    public ErrorOr<Success> UpdateLimit(EmissionType emissionType, double tons)
    {
        var existing = _limits.FirstOrDefault(limit => limit.EmissionType == emissionType);
        if (existing is null)
            return FacilityErrors.LimitDoesntExistForType;

        // MonthlyLimit is an immutable value object; "edit" replaces it with a new value.
        var updated = MonthlyLimit.Create(Id, emissionType, tons);
        if (updated.IsError)
            return updated.Errors;

        _limits.Remove(existing);
        _limits.Add(updated.Value);
        RaiseDomainEvent(new MonthlyLimitUpdated(Id, emissionType));
        return Result.Success;
    }

    /// <summary>
    /// Removes the Monthly Limit for <paramref name="emissionType"/>. Raises
    /// <see cref="MonthlyLimitRemoved"/> on success.
    /// </summary>
    /// <param name="emissionType">The Emission Type whose limit to remove.</param>
    /// <returns>
    /// <see cref="Result.Success"/>, or <see cref="FacilityErrors.LimitDoesntExistForType"/> when the
    /// Facility holds no limit for <paramref name="emissionType"/>.
    /// </returns>
    public ErrorOr<Success> RemoveLimit(EmissionType emissionType)
    {
        var existing = _limits.FirstOrDefault(limit => limit.EmissionType == emissionType);
        if (existing is null)
            return FacilityErrors.LimitDoesntExistForType;

        _limits.Remove(existing);
        RaiseDomainEvent(new MonthlyLimitRemoved(Id, emissionType));
        return Result.Success;
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
    private List<Permit> _permits = [];
}
