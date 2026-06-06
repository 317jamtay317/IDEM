using System.Collections.Concurrent;
using RecordKeeping.Application.Reporting;

namespace RecordKeeping.Infrastructure.Reporting;

/// <summary>
/// In-memory <see cref="IReportPreviewSessions"/> backed by a
/// <see cref="ConcurrentDictionary{TKey,TValue}"/>. Registered as a singleton so every hub connection
/// shares it. State is per-process and intentionally not persisted — a live preview session is
/// ephemeral and rebuilt the next time an editor pushes its template.
/// </summary>
public sealed class InMemoryReportPreviewSessions : IReportPreviewSessions
{
    private readonly ConcurrentDictionary<string, ReportPreviewSnapshot> _snapshots =
        new(StringComparer.Ordinal);

    /// <inheritdoc />
    public void SetSnapshot(string sessionId, ReportPreviewSnapshot snapshot) =>
        _snapshots[sessionId] = snapshot;

    /// <inheritdoc />
    public ReportPreviewSnapshot? GetSnapshot(string sessionId) =>
        _snapshots.TryGetValue(sessionId, out var snapshot) ? snapshot : null;
}
