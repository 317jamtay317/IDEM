using ErrorOr;

namespace RecordKeeping.Domain.Facilities;

public class FacilityErrors
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
    /// Represents an error indicating that the license expiration date is in the past.
    /// </summary>
    /// <remarks>
    /// This error is returned when attempting to add or associate a license with a facility
    /// and the expiration date of the license is earlier than the current date.
    /// It is used to ensure licenses are valid and not expired.
    /// </remarks>
    public static readonly Error LicenseExpirationDateIsBeforeNow =
        Error.Validation("Facility.LicenseExpirationDateIsBeforeNow", "License expiration date is before now");

    /// <summary>
    /// Represents an error indicating that a facility must have multiple active licenses
    /// before a license can be removed.
    /// </summary>
    /// <remarks>
    /// This error is raised when attempting to remove a license from a facility that has only
    /// one license remaining. It ensures that a facility retains at least one active license
    /// at all times for compliance and operational purposes.
    /// </remarks>
    public static readonly Error MustHaveMultipleLicensesToRemove =
        Error.Validation("Facility.MustHaveMultipleLicensesToRemove", "Must have multiple licenses to remove");

    /// <summary>
    /// Represents an error indicating that the specified license does not exist in the facility.
    /// </summary>
    /// <remarks>
    /// This error is returned when an operation is performed on a license that cannot be found in the facility.
    /// It is used to ensure that the requested license is valid and present within the facility's records.
    /// </remarks>
    public static readonly Error LicenseDoesntExist =
        Error.NotFound("Facility.LicenseDoesntExist", "The specified license does not exist in the facility");

    /// <summary>
    /// Represents an error indicating that no valid (unexpired) license exists for a requested date.
    /// </summary>
    /// <remarks>
    /// Returned by <see cref="Facility.GetLicenseByDate"/> when the Facility holds no license whose
    /// expiration is on or after the requested date.
    /// </remarks>
    public static readonly Error NoValidLicenseForDate =
        Error.NotFound("Facility.NoValidLicenseForDate", "No valid license exists for the specified date.");
}