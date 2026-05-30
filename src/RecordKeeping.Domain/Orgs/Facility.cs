namespace RecordKeeping.Domain.Orgs;

/// <summary>
/// A physical location operated by an <see cref="Org"/> where regulated activity
/// occurs — for asphalt customers, an asphalt plant. A child entity of the
/// <see cref="Org"/> aggregate; created only via <see cref="Org.AddFacility"/>.
/// </summary>
/// <remarks>
/// Per I-D06, every Facility belongs to exactly one Org. Its <see cref="OrgId"/>
/// is assigned at creation and never changes; cross-Org transfer is not supported.
/// </remarks>
public sealed class Facility
{
    /// <summary>Unique identifier.</summary>
    public Guid Id { get; }

    /// <summary>The Org that owns this Facility. Immutable (I-D06).</summary>
    public Guid OrgId { get; }

    /// <summary>Human-readable name of the Facility (e.g. the plant name).</summary>
    public string Name { get; }

    // Created only through Org.AddFacility so the aggregate root owns the invariant.
    internal Facility(Guid id, Guid orgId, string name)
    {
        Id = id;
        OrgId = orgId;
        Name = name;
    }
}
