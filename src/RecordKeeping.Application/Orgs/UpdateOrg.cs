using ErrorOr;

namespace RecordKeeping.Application.Orgs;

/// <summary>
/// Command to update an existing Org. An Org cannot be renamed (the supplied
/// <paramref name="Name"/> must match the stored name); the mutable state is the
/// Entra ID SSO configuration (I-D12).
/// </summary>
/// <param name="Id">The Org to update.</param>
/// <param name="Name">The Org's name; must equal the current name (rename is rejected).</param>
/// <param name="TenantId">
/// The Entra ID directory GUID to federate, or <c>null</c> to disable SSO (I-D12).
/// </param>
public sealed record UpdateOrgCommand(Guid Id, string Name, Guid? TenantId);

/// <summary>Handles <see cref="UpdateOrgCommand"/>.</summary>
public static class UpdateOrgHandler
{
    /// <summary>Applies the update, rejecting rename attempts.</summary>
    /// <param name="command">The update command.</param>
    /// <param name="orgs">The Org repository.</param>
    /// <param name="facilities">The Facility repository, used to compose the response.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>
    /// The updated Org; <see cref="OrgErrors.NotFound"/> when it does not exist;
    /// <see cref="OrgErrors.NameImmutable"/> when a rename is attempted; or a
    /// validation error when the SSO tenant id is invalid.
    /// </returns>
    public static async Task<ErrorOr<OrgResponse>> Handle(
        UpdateOrgCommand command,
        IOrgRepository orgs,
        IFacilityRepository facilities,
        CancellationToken cancellationToken)
    {
        var org = await orgs.GetByIdAsync(command.Id, cancellationToken);
        if (org is null)
        {
            return OrgErrors.NotFound(command.Id);
        }

        // An Org cannot be renamed; Org.Name is immutable by design.
        if (!string.Equals(command.Name, org.Name, StringComparison.Ordinal))
        {
            return OrgErrors.NameImmutable;
        }

        // PUT is a full replacement of the SSO configuration: a value configures
        // federation (I-D12), absence disables it.
        if (command.TenantId is Guid tenantId)
        {
            var configured = org.ConfigureSso(tenantId);
            if (configured.IsError)
            {
                return configured.Errors;
            }
        }
        else
        {
            org.DisableSso();
        }

        await orgs.SaveChangesAsync(cancellationToken);

        var owned = await facilities.GetByOrgAsync(org.Id, cancellationToken);
        return OrgResponse.FromOrg(org, owned);
    }
}
