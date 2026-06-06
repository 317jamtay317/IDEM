namespace RecordKeeping.Application.Reporting;

/// <summary>
/// An advisory soft-lock on a single Report Template element while a participant has it open in a live
/// preview session. Advisory only: it surfaces "being edited by …" to others to discourage two editors
/// clobbering the same element, but never hard-blocks editing — the most recent pushed render still wins.
/// </summary>
/// <param name="ElementId">The claimed element's id.</param>
/// <param name="ConnectionId">The holding connection's id; the lock is released automatically when it disconnects.</param>
/// <param name="UserId">The holder's user id.</param>
/// <param name="DisplayName">The holder's display name, shown to others as "being edited by …".</param>
public sealed record PreviewLock(
    string ElementId,
    string ConnectionId,
    string UserId,
    string DisplayName);
