using RecordKeeping.Application.ProductionFieldLimits;
using RecordKeeping.Domain.ProductionFieldLimits;

namespace RecordKeeping.Application.Records;

/// <summary>Shared helper for annotating Records with Exceedance against an Org's configured limits.</summary>
internal static class RecordExceedance
{
    /// <summary>
    /// Loads the Org's Production Field Limits keyed by <c>PropertyName</c> (case-insensitive, matching
    /// the catalog key). The Org scope is applied by the repository, so a Record's values are only ever
    /// classified against their own Org's limits (I-D03).
    /// </summary>
    public static async Task<IReadOnlyDictionary<string, ProductionFieldLimit>> LoadOrgLimitsAsync(
        Guid orgId, IProductionFieldLimitRepository limits, CancellationToken cancellationToken)
    {
        var orgLimits = await limits.GetByOrgAsync(orgId, cancellationToken);
        return orgLimits.ToDictionary(limit => limit.PropertyName, StringComparer.OrdinalIgnoreCase);
    }
}
