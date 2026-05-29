namespace RecordKeeping.Api.IntegrationTests;

/// <summary>
/// xUnit collection that shares a single <see cref="RecordKeepingApiFactory"/>
/// across every integration test class in this assembly.
/// </summary>
/// <remarks>
/// Required because <see cref="RecordKeepingApiFactory"/> injects its SQL Server
/// connection string via a process-wide environment variable; two factory
/// instances running in parallel would race and read each other's value. Sharing
/// one fixture across all tests also amortizes the container startup cost.
/// </remarks>
[CollectionDefinition(nameof(IntegrationTestCollection))]
public sealed class IntegrationTestCollection : ICollectionFixture<RecordKeepingApiFactory>;
