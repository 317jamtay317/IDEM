using RecordKeeping.Application.Facilities;
using RecordKeeping.Application.Orgs;

namespace RecordKeeping.Api.Endpoints;

public partial class OrgEndpoints
{
    /// <summary>Request body for creating an Org.</summary>
    /// <param name="Name">The Org's display name.</param>
    public sealed record CreateOrgRequest(string Name);

    /// <summary>Request body for updating an Org. Orgs cannot be renamed.</summary>
    /// <param name="Name">The Org's name; must match the stored name.</param>
    /// <param name="TenantId">The Entra ID directory GUID, or <c>null</c> to disable SSO (I-D12).</param>
    public sealed record UpdateOrgRequest(string Name, Guid? TenantId);

    private static async Task<IResult> GetOrgs(
        IOrgRepository orgs, IFacilityRepository facilities, CancellationToken cancellationToken)
    {
        var result = await GetOrgsHandler.Handle(
            new GetOrgsQuery(), orgs, facilities, cancellationToken);
        return Results.Ok(result);
    }

    private static async Task<IResult> GetOrgById(
        Guid id, IOrgRepository orgs, IFacilityRepository facilities, CancellationToken cancellationToken)
    {
        var result = await GetOrgByIdHandler.Handle(
            new GetOrgByIdQuery(id), orgs, facilities, cancellationToken);
        return result.Match(Results.Ok);
    }

    private static async Task<IResult> CreateOrg(
        CreateOrgRequest request, IOrgRepository orgs, CancellationToken cancellationToken)
    {
        var result = await CreateOrgHandler.Handle(
            new CreateOrgCommand(request.Name), orgs, cancellationToken);
        return result.Match(org => Results.Created($"/orgs/{org.Id}", org));
    }

    private static async Task<IResult> UpdateOrg(
        Guid id,
        UpdateOrgRequest request,
        IOrgRepository orgs,
        IFacilityRepository facilities,
        CancellationToken cancellationToken)
    {
        var result = await UpdateOrgHandler.Handle(
            new UpdateOrgCommand(id, request.Name, request.TenantId), orgs, facilities, cancellationToken);
        return result.Match(Results.Ok);
    }

    private static async Task<IResult> DeleteOrg(
        Guid id, IOrgRepository orgs, CancellationToken cancellationToken)
    {
        var result = await DeleteOrgHandler.Handle(
            new DeleteOrgCommand(id), orgs, cancellationToken);
        return result.Match(_ => Results.NoContent());
    }
}
