using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage;

namespace RecordKeeping.Infrastructure.Persistence;

/// <summary>
/// Creates the domain schema for <see cref="RecordKeepingDbContext"/> at startup.
/// </summary>
/// <remarks>
/// The domain context shares its database with <c>AuthDbContext</c>. EF Core's
/// <c>EnsureCreated</c> is keyed on database existence, so once the auth context
/// has created the database the domain context's tables would never be created.
/// This initializer instead creates the domain tables directly, and only when they
/// are absent, so it is safe to run on every startup. Replace with EF Core
/// migrations when the schema stabilizes (see Architecture.md §Legacy Migration).
/// </remarks>
public static class RecordKeepingDbInitializer
{
    /// <summary>Ensures the domain tables exist, creating them if necessary.</summary>
    /// <param name="dbContext">The domain DbContext.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    public static async Task InitializeAsync(
        RecordKeepingDbContext dbContext,
        CancellationToken cancellationToken = default)
    {
        var creator = dbContext.GetService<IRelationalDatabaseCreator>();

        // Ensure the database itself exists (no-op if the auth context already made it).
        if (!await creator.ExistsAsync(cancellationToken))
        {
            await creator.CreateAsync(cancellationToken);
        }

        // Create only this context's tables, and only when the aggregate root
        // table is missing, so repeated startups are idempotent.
        if (!await OrgsTableExistsAsync(dbContext, cancellationToken))
        {
            await creator.CreateTablesAsync(cancellationToken);
        }
    }

    private static async Task<bool> OrgsTableExistsAsync(
        RecordKeepingDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var sql =
            "SELECT CASE WHEN EXISTS (SELECT 1 FROM sys.tables t " +
            "JOIN sys.schemas s ON t.schema_id = s.schema_id " +
            "WHERE t.name = 'Orgs' AND s.name = 'dbo') THEN 1 ELSE 0 END";

        await using var command = dbContext.Database.GetDbConnection().CreateCommand();
        command.CommandText = sql;

        await dbContext.Database.OpenConnectionAsync(cancellationToken);
        try
        {
            var result = await command.ExecuteScalarAsync(cancellationToken);
            return Convert.ToInt32(result) == 1;
        }
        finally
        {
            await dbContext.Database.CloseConnectionAsync();
        }
    }
}
