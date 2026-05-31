using ErrorOr;

namespace RecordKeeping.Application.Orgs;

/// <summary>Command to permanently delete an Org.</summary>
/// <param name="Id">The Org to delete.</param>
public sealed record DeleteOrgCommand(Guid Id);

/// <summary>Handles <see cref="DeleteOrgCommand"/>.</summary>
public static class DeleteOrgHandler
{
    /// <summary>Deletes the Org, or returns a not-found error.</summary>
    /// <param name="command">The delete command.</param>
    /// <param name="repository">The Org repository.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns><see cref="Result.Deleted"/> on success, or <see cref="OrgErrors.NotFound"/>.</returns>
    public static async Task<ErrorOr<Deleted>> Handle(
        DeleteOrgCommand command,
        IOrgRepository repository,
        CancellationToken cancellationToken)
    {
        var org = await repository.GetByIdAsync(command.Id, cancellationToken);
        if (org is null)
        {
            return OrgErrors.NotFound(command.Id);
        }

        await repository.RemoveAsync(org, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);
        return Result.Deleted;
    }
}
