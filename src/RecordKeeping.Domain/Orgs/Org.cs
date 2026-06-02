using ErrorOr;
using RecordKeeping.Domain.Common;
using RecordKeeping.Domain.Facilities;

namespace RecordKeeping.Domain.Orgs;

/// <summary>
/// The subscribed customer that owns the data within RecordKeeping — in the v1
/// target market, an asphalt company. Aggregate root and the boundary of Org
/// isolation (I-D03): every Record, Report, and <see cref="Facility"/> belongs to
/// exactly one Org.
/// </summary>
/// <remarks>
/// Constructed only via <see cref="Create"/>. <see cref="Facility"/> is a separate aggregate
/// that references its Org by <c>OrgId</c> (I-D06); likewise Org Users reference the Org by
/// <c>OrgId</c>. Neither is held on the Org aggregate — they are loaded through their own
/// repositories and composed into read models on the query side.
/// </remarks>
public sealed class Org : AggregateRoot<Guid>
{
    /// <summary>Maximum permitted length of an Org <see cref="Name"/>.</summary>
    public const int MaxNameLength = 200;

    /// <summary>The Org's display name (e.g. "Rieth-Riley").</summary>
    public string Name { get; private set; }

    /// <summary>
    /// The Entra ID directory GUID this Org has federated for SSO, or <c>null</c>
    /// when the Org authenticates locally (I-D12).
    /// </summary>
    public Guid? TenantId { get; private set; }

    private Org(Guid id, string name) : base(id)
    {
        Name = name;
    }

    /// <summary>
    /// Creates a new Org with the given <paramref name="name"/>.
    /// </summary>
    /// <param name="name">
    /// The Org's display name; required, trimmed, and at most
    /// <see cref="MaxNameLength"/> characters.
    /// </param>
    /// <returns>The new Org, or a validation error when the name is invalid.</returns>
    public static ErrorOr<Org> Create(string name)
    {
        var validated = ValidateName(name);
        if (validated.IsError)
        {
            return validated.Errors;
        }

        return new Org(Guid.NewGuid(), validated.Value);
    }

    /// <summary>
    /// Configures Entra ID SSO federation for this Org by recording its directory
    /// <paramref name="tenantId"/> (I-D12).
    /// </summary>
    /// <param name="tenantId">The Entra ID directory GUID; must be non-empty.</param>
    /// <returns>Success, or a validation error when the tenant id is empty.</returns>
    public ErrorOr<Success> ConfigureSso(Guid tenantId)
    {
        if (tenantId == Guid.Empty)
        {
            // I-D12: TenantId is set only to a real Entra directory GUID.
            return Error.Validation("Org.TenantId.Empty", "TenantId cannot be empty.");
        }

        TenantId = tenantId;
        return Result.Success;
    }

    /// <summary>
    /// Disables Entra ID SSO federation for this Org, clearing its
    /// <see cref="TenantId"/> so the Org authenticates locally (I-D12).
    /// </summary>
    public void DisableSso() => TenantId = null;

    private static ErrorOr<string> ValidateName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return Error.Validation("Org.Name.Empty", "Name cannot be empty.");
        }

        var trimmed = name.Trim();
        if (trimmed.Length > MaxNameLength)
        {
            return Error.Validation(
                "Org.Name.TooLong",
                $"Name cannot exceed {MaxNameLength} characters.");
        }

        return trimmed;
    }
}
