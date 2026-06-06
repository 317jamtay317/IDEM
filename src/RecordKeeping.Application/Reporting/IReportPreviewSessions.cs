namespace RecordKeeping.Application.Reporting;

/// <summary>
/// Stores the latest rendered <see cref="ReportPreviewSnapshot"/> for each live Report Template
/// preview session, keyed by the session id (the Report Template's id). Ephemeral and in-memory: it
/// lets a watcher who joins an in-progress session catch up to the current state. The editing source
/// of truth remains the editor client — this only relays the most recent rendered frame.
/// </summary>
public interface IReportPreviewSessions
{
    /// <summary>
    /// Stores <paramref name="snapshot"/> as the current state of the session, replacing any earlier one.
    /// </summary>
    /// <param name="sessionId">The preview session id (the Report Template's id).</param>
    /// <param name="snapshot">The most recent rendered snapshot.</param>
    void SetSnapshot(string sessionId, ReportPreviewSnapshot snapshot);

    /// <summary>
    /// Returns the current snapshot for the session, or <c>null</c> when none has been produced yet.
    /// </summary>
    /// <param name="sessionId">The preview session id (the Report Template's id).</param>
    /// <returns>The latest snapshot, or <c>null</c> when the session has produced none.</returns>
    ReportPreviewSnapshot? GetSnapshot(string sessionId);
}
