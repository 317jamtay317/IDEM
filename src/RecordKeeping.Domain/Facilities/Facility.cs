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

    private Facility(Guid id, Guid orgId, string name) : base(id)
    {
        OrgId = orgId;
        Name = name;
    }

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
}
