using ErrorOr;

namespace RecordKeeping.Domain.Facilities;

/// <summary>
/// Domain errors the <see cref="Facility"/> aggregate returns when an operation would violate one
/// of its invariants.
/// </summary>
public static class FacilityErrors
{
    /// <summary>
    /// Represents an error indicating that the specified user is already associated with the facility.
    /// </summary>
    /// <remarks>
    /// This error is returned when attempting to add a user to a facility they are already part of.
    /// It is used for validation purposes to prevent duplicate user entries in the facility.
    /// </remarks>
    public static readonly Error UserAlreadyInFacility =
        Error.Validation("Facility.UserAlreadyInFacility", "User is already in facility");

    /// <summary>
    /// Represents an error indicating that the specified user is not associated with the facility.
    /// </summary>
    /// <remarks>
    /// This error is returned when attempting to perform operations on a user that does not exist
    /// within the specified facility. It is used to validate and enforce correct user management workflows.
    /// </remarks>
    public static readonly Error UserNotInFacility =
        Error.Validation("Facility.UserNotInFacility", "User is not in facility");

    /// <summary>
    /// I-D17: a Permit cannot be added to a Facility once its expiration date is in the past.
    /// </summary>
    public static readonly Error PermitExpirationDateIsBeforeNow =
        Error.Validation("I-D17", "A Permit's expiration date is in the past.");

    /// <summary>
    /// I-D18: a Facility must retain at least one Permit, so its last remaining Permit cannot be removed.
    /// </summary>
    public static readonly Error MustHaveMultiplePermitsToRemove =
        Error.Validation("I-D18", "A Facility must retain at least one Permit.");

    /// <summary>
    /// Represents an error indicating that the specified permit does not exist on the facility.
    /// </summary>
    /// <remarks>
    /// This error is returned when an operation is performed on a permit that cannot be found on the facility.
    /// </remarks>
    public static readonly Error PermitDoesntExist =
        Error.NotFound("Facility.PermitDoesntExist", "The specified permit does not exist in the facility");

    /// <summary>
    /// Represents an error indicating that no valid (unexpired) permit exists for a requested date.
    /// </summary>
    /// <remarks>
    /// Returned by <see cref="Facility.GetPermitByDate"/> when the Facility holds no permit whose
    /// expiration is on or after the requested date.
    /// </remarks>
    public static readonly Error NoValidPermitForDate =
        Error.NotFound("Facility.NoValidPermitForDate", "No valid permit exists for the specified date.");

    /// <summary>
    /// I-D20: a Monthly Limit's value must be a positive number of tons; a zero or negative value
    /// is rejected.
    /// </summary>
    public static readonly Error LimitValueMustBePositive =
        Error.Validation("I-D20", "A Monthly Limit's value must be greater than zero.");

    /// <summary>
    /// I-D19: a Facility holds at most one Monthly Limit per Emission Type, so a limit cannot be
    /// added for an Emission Type that already has one.
    /// </summary>
    public static readonly Error LimitAlreadyExistsForType =
        Error.Validation("I-D19", "A Monthly Limit already exists for this Emission Type.");

    /// <summary>
    /// Represents an error indicating that no Monthly Limit exists for the requested Emission Type.
    /// </summary>
    /// <remarks>
    /// Returned by <see cref="Facility.UpdateLimit"/> and <see cref="Facility.RemoveLimit"/> when the
    /// Facility holds no Monthly Limit for the specified Emission Type.
    /// </remarks>
    public static readonly Error LimitDoesntExistForType =
        Error.NotFound("Facility.LimitDoesntExistForType", "No Monthly Limit exists for the specified Emission Type.");
}
