namespace RecordKeeping.Application.Reporting;

/// <summary>
/// The outcome of a participant leaving a live preview session (a SignalR disconnect): which session was
/// affected, who remains, and which element locks were auto-released — so the hub can broadcast the updated
/// presence and, only when locks actually changed, the updated lock list.
/// </summary>
/// <param name="SessionId">The session the connection had joined, or <c>null</c> when it had joined none.</param>
/// <param name="Participants">The participants remaining in the session after the departure.</param>
/// <param name="ReleasedElementIds">The element ids whose locks the departure released (possibly empty).</param>
public sealed record PreviewLeaveResult(
    string? SessionId,
    IReadOnlyList<PreviewParticipant> Participants,
    IReadOnlyList<string> ReleasedElementIds);
