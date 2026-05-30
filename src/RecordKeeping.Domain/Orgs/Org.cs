using ErrorOr;

namespace RecordKeeping.Domain.Orgs;

/// <summary>
/// The subscribed customer that owns the data within RecordKeeping — in the v1
/// target market, an asphalt company. Aggregate root and the boundary of Org
/// isolation (I-D03): every Record, Report, and <see cref="Facility"/> belongs to
/// exactly one Org.
/// </summary>
/// <remarks>
/// Constructed only via <see cref="Create"/>. The Org owns its <see cref="Facilities"/>
/// as child entities (I-D06). Org Users are a separate aggregate that reference the
/// Org by <c>OrgId</c>; they are not held here.
/// </remarks>
public sealed class Org
{
    /// <summary>Maximum permitted length of an Org <see cref="Name"/>.</summary>
    public const int MaxNameLength = 200;

    private readonly List<Facility> _facilities = [];

    /// <summary>Unique identifier.</summary>
    public Guid Id { get; }

    /// <summary>The Org's display name (e.g. "Rieth-Riley").</summary>
    public string Name { get; private set; }

    /// <summary>
    /// The Entra ID directory GUID this Org has federated for SSO, or <c>null</c>
    /// when the Org authenticates locally (I-D12).
    /// </summary>
    public Guid? TenantId { get; private set; }

    /// <summary>The Facilities operated by this Org (I-D06). An Org may have many.</summary>
    public IReadOnlyCollection<Facility> Facilities => _facilities;

    private Org(Guid id, string name)
    {
        Id = id;
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
    /// Adds a new <see cref="Facility"/> owned by this Org (I-D06).
    /// </summary>
    /// <param name="name">
    /// The Facility's name; required, trimmed, and at most
    /// <see cref="MaxNameLength"/> characters.
    /// </param>
    /// <returns>The new Facility, or a validation error when the name is invalid.</returns>
    public ErrorOr<Facility> AddFacility(string name)
    {
        var validated = ValidateName(name);
        if (validated.IsError)
        {
            return validated.Errors;
        }

        // I-D06: the Facility is created against this Org's id and cannot cross Orgs.
        var facility = new Facility(Guid.NewGuid(), Id, validated.Value);
        _facilities.Add(facility);
        return facility;
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
