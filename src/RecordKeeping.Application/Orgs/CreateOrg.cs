using ErrorOr;
using RecordKeeping.Domain.Orgs;

namespace RecordKeeping.Application.Orgs;

/// <summary>Command to create a new Org with the given <paramref name="Name"/>.</summary>
/// <param name="Name">The Org's display name; required, trimmed, length-capped.</param>
public sealed record CreateOrgCommand(string Name);

/// <summary>Handles <see cref="CreateOrgCommand"/>.</summary>
public static class CreateOrgHandler
{
    /// <summary>Validates and persists a new Org.</summary>
    /// <param name="command">The create command.</param>
    /// <param name="repository">The Org repository.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>The created Org as an <see cref="OrgResponse"/>, or a validation error.</returns>
    public static async Task<ErrorOr<OrgResponse>> Handle(
        CreateOrgCommand command,
        IOrgRepository repository,
        CancellationToken cancellationToken)
    {
        var result = Org.Create(command.Name);
        if (result.IsError)
        {
            return result.Errors;
        }

        var org = result.Value;
        await repository.AddAsync(org, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        // A newly created Org has no Facilities yet.
        return OrgResponse.FromOrg(org, []);
    }
}
