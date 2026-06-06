using System.Collections.Concurrent;
using RecordKeeping.Application.Reporting;

namespace RecordKeeping.Infrastructure.Reporting;

/// <summary>
/// In-memory <see cref="IReportPreviewPresence"/> backed by <see cref="ConcurrentDictionary{TKey,TValue}"/>s
/// and a per-session monitor lock. Registered as a singleton so every hub connection shares it. State is
/// per-process and intentionally not persisted: presence and advisory soft-locks are ephemeral and live only
/// as long as the SignalR connections that own them.
/// </summary>
/// <remarks>
/// Each session's participants and locks are guarded by a single per-session lock so the compound operations
/// ("claim only if free", "leaving releases every lock I hold") are atomic; a <see cref="ConcurrentDictionary{TKey,TValue}"/>
/// alone cannot make those check-then-act steps safe. A session is a tiny, low-contention set (a handful of
/// SiteAdmin tabs), so the lock costs nothing in practice. A reverse index (<c>connectionId → sessionId</c>)
/// lets a disconnect — which carries only the connection id — resolve its session in O(1).
/// </remarks>
public sealed class InMemoryReportPreviewPresence : IReportPreviewPresence
{
    private sealed class SessionState
    {
        public object Gate { get; } = new();

        public Dictionary<string, PreviewParticipant> Participants { get; } = new(StringComparer.Ordinal);

        public Dictionary<string, PreviewLock> Locks { get; } = new(StringComparer.Ordinal);
    }

    private readonly ConcurrentDictionary<string, SessionState> _sessions = new(StringComparer.Ordinal);
    private readonly ConcurrentDictionary<string, string> _connectionSession = new(StringComparer.Ordinal);

    /// <inheritdoc />
    public IReadOnlyList<PreviewParticipant> Join(string sessionId, string connectionId, PreviewParticipant participant)
    {
        while (true)
        {
            var session = _sessions.GetOrAdd(sessionId, _ => new SessionState());
            lock (session.Gate)
            {
                // A concurrent Leave may have garbage-collected this instance from _sessions while we waited
                // for the gate. If so, retry so we never write into an orphaned SessionState.
                if (!_sessions.TryGetValue(sessionId, out var current) || !ReferenceEquals(current, session))
                {
                    continue;
                }

                session.Participants[connectionId] = participant;
                _connectionSession[connectionId] = sessionId;
                return session.Participants.Values.ToArray();
            }
        }
    }

    /// <inheritdoc />
    public IReadOnlyList<PreviewParticipant> UpdateSelection(string connectionId, IReadOnlyList<string> elementIds)
    {
        if (!TryGetSession(connectionId, out var session))
        {
            return [];
        }

        lock (session.Gate)
        {
            if (session.Participants.TryGetValue(connectionId, out var participant))
            {
                session.Participants[connectionId] = participant with { SelectedElementIds = elementIds.ToArray() };
            }

            return session.Participants.Values.ToArray();
        }
    }

    /// <inheritdoc />
    public PreviewLock? ClaimElement(string connectionId, string elementId)
    {
        if (!TryGetSession(connectionId, out var session))
        {
            return null;
        }

        lock (session.Gate)
        {
            if (!session.Participants.TryGetValue(connectionId, out var participant))
            {
                return null;
            }

            // Advisory: never steal a lock another connection holds — report the current holder instead.
            if (session.Locks.TryGetValue(elementId, out var existing) && existing.ConnectionId != connectionId)
            {
                return existing;
            }

            var held = new PreviewLock(elementId, connectionId, participant.UserId, participant.DisplayName);
            session.Locks[elementId] = held;
            return held;
        }
    }

    /// <inheritdoc />
    public bool ReleaseElement(string connectionId, string elementId)
    {
        if (!TryGetSession(connectionId, out var session))
        {
            return false;
        }

        lock (session.Gate)
        {
            if (session.Locks.TryGetValue(elementId, out var existing) && existing.ConnectionId == connectionId)
            {
                session.Locks.Remove(elementId);
                return true;
            }

            return false;
        }
    }

    /// <inheritdoc />
    public PreviewLeaveResult Leave(string connectionId)
    {
        if (!_connectionSession.TryGetValue(connectionId, out var sessionId) ||
            !_sessions.TryGetValue(sessionId, out var session))
        {
            return new PreviewLeaveResult(null, [], []);
        }

        lock (session.Gate)
        {
            // Remove the participant and its reverse-index entry together under the gate, mirroring Join,
            // so a concurrent mutation never sees the connection in one map but not the other.
            _connectionSession.TryRemove(connectionId, out _);
            session.Participants.Remove(connectionId);

            var released = session.Locks
                .Where(entry => entry.Value.ConnectionId == connectionId)
                .Select(entry => entry.Key)
                .ToArray();
            foreach (var elementId in released)
            {
                session.Locks.Remove(elementId);
            }

            var survivors = session.Participants.Values.ToArray();

            // Garbage-collect the now-empty session. Re-checking emptiness under the gate (we hold it) plus
            // the value-matched TryRemove means a concurrent Join either added a participant first (so we
            // don't remove) or will retry against a fresh SessionState (see Join).
            if (session.Participants.Count == 0)
            {
                _sessions.TryRemove(new KeyValuePair<string, SessionState>(sessionId, session));
            }

            return new PreviewLeaveResult(sessionId, survivors, released);
        }
    }

    /// <inheritdoc />
    public string? SessionOf(string connectionId) =>
        _connectionSession.TryGetValue(connectionId, out var sessionId) ? sessionId : null;

    /// <inheritdoc />
    public IReadOnlyList<PreviewParticipant> GetParticipants(string sessionId)
    {
        if (!_sessions.TryGetValue(sessionId, out var session))
        {
            return [];
        }

        lock (session.Gate)
        {
            return session.Participants.Values.ToArray();
        }
    }

    /// <inheritdoc />
    public IReadOnlyList<PreviewLock> GetLocks(string sessionId)
    {
        if (!_sessions.TryGetValue(sessionId, out var session))
        {
            return [];
        }

        lock (session.Gate)
        {
            return session.Locks.Values.ToArray();
        }
    }

    // Resolves the session a live connection belongs to via the reverse index.
    private bool TryGetSession(string connectionId, out SessionState session)
    {
        if (_connectionSession.TryGetValue(connectionId, out var sessionId) &&
            _sessions.TryGetValue(sessionId, out var found))
        {
            session = found;
            return true;
        }

        session = null!;
        return false;
    }
}
