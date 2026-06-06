namespace RecordKeeping.Application.Reporting;

/// <summary>
/// Tracks who is taking part in each live Report Template preview session and which elements they hold
/// advisory soft-locks on, keyed by the session id (the Report Template's id). Ephemeral and in-memory,
/// like <see cref="IReportPreviewSessions"/>: presence and locks live only as long as the SignalR
/// connections that own them, so <see cref="Leave"/> (driven by a disconnect) is the single source of
/// truth for a participant being gone. Implementations must be safe for concurrent use.
/// </summary>
/// <remarks>
/// The mutation methods take a <c>connectionId</c>, never a <c>sessionId</c>: the session a connection
/// belongs to is resolved internally, so a caller cannot publish presence or locks into a session it
/// never joined.
/// </remarks>
public interface IReportPreviewPresence
{
    /// <summary>
    /// Adds or replaces the participant in the session, keyed by <paramref name="connectionId"/> so a
    /// reconnect replay is idempotent. Creates the session on first join.
    /// </summary>
    /// <param name="sessionId">The preview session id (the Report Template's id).</param>
    /// <param name="connectionId">The participant's SignalR connection id.</param>
    /// <param name="participant">The participant, with identity already derived from the connection's claims.</param>
    /// <returns>The session's full participant roster after the join.</returns>
    IReadOnlyList<PreviewParticipant> Join(string sessionId, string connectionId, PreviewParticipant participant);

    /// <summary>
    /// Replaces the connection's current element selection. The session is resolved from the connection, so
    /// a caller cannot publish into a session it never joined.
    /// </summary>
    /// <param name="connectionId">The participant's SignalR connection id.</param>
    /// <param name="elementIds">The element ids the participant now has selected.</param>
    /// <returns>
    /// The roster of the session the connection belongs to, or an empty list when the connection is untracked.
    /// </returns>
    IReadOnlyList<PreviewParticipant> UpdateSelection(string connectionId, IReadOnlyList<string> elementIds);

    /// <summary>
    /// Places an advisory soft-lock on an element for the connection. Granted when the element is unlocked or
    /// already held by this connection (an idempotent re-claim); it never steals a lock another connection
    /// holds. Advisory: it does not prevent editing, only signals "being edited by …".
    /// </summary>
    /// <param name="connectionId">The claiming connection's id.</param>
    /// <param name="elementId">The element to claim.</param>
    /// <returns>
    /// The resulting lock — the caller's on a grant, the existing holder's on contention — or <c>null</c>
    /// when the connection is untracked.
    /// </returns>
    PreviewLock? ClaimElement(string connectionId, string elementId);

    /// <summary>
    /// Releases the connection's advisory soft-lock on an element. A no-op when the connection is not the
    /// current holder.
    /// </summary>
    /// <param name="connectionId">The releasing connection's id.</param>
    /// <param name="elementId">The element to release.</param>
    /// <returns><c>true</c> when a lock the connection held was released; otherwise <c>false</c>.</returns>
    bool ReleaseElement(string connectionId, string elementId);

    /// <summary>
    /// Removes the connection from whatever session it had joined, releasing every lock it held, and drops
    /// the session once it becomes empty. Called when the SignalR connection disconnects.
    /// </summary>
    /// <param name="connectionId">The departing connection's id.</param>
    /// <returns>
    /// The affected session id (or <c>null</c> when the connection was untracked), the surviving participants,
    /// and the element ids whose locks were released.
    /// </returns>
    PreviewLeaveResult Leave(string connectionId);

    /// <summary>
    /// Resolves the session a connection had joined, so a mutation can be broadcast to the right group.
    /// </summary>
    /// <param name="connectionId">The connection's id.</param>
    /// <returns>The session id the connection joined, or <c>null</c> when it is untracked.</returns>
    string? SessionOf(string connectionId);

    /// <summary>Returns the current participant roster for the session (empty when unknown).</summary>
    /// <param name="sessionId">The preview session id (the Report Template's id).</param>
    /// <returns>The session's participants, in no particular order.</returns>
    IReadOnlyList<PreviewParticipant> GetParticipants(string sessionId);

    /// <summary>Returns the current advisory soft-locks for the session (empty when unknown).</summary>
    /// <param name="sessionId">The preview session id (the Report Template's id).</param>
    /// <returns>The session's locks, in no particular order.</returns>
    IReadOnlyList<PreviewLock> GetLocks(string sessionId);
}
