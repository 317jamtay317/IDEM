namespace RecordKeeping.Application.Reporting;

/// <summary>
/// A SiteAdmin taking part in a live Report Template preview session — either editing the template in the
/// Report Builder or watching it on the Preview Screen. Identity is derived from the connection's
/// authenticated claims, never from client input, so one participant cannot impersonate another.
/// </summary>
/// <param name="ConnectionId">
/// The SignalR connection id; the participant's identity within a session. A single user with two tabs is
/// two participants (two connections) sharing one <paramref name="UserId"/> and <paramref name="Color"/>.
/// </param>
/// <param name="UserId">The participant's stable user id (the <c>sub</c> claim), shared across their tabs.</param>
/// <param name="DisplayName">The participant's display name, shown to others on selection labels and avatars.</param>
/// <param name="Color">
/// A stable display colour derived deterministically from <paramref name="UserId"/> on the server, so it is
/// identical on every client and survives reconnects.
/// </param>
/// <param name="SelectedElementIds">The element ids the participant currently has selected; empty on join.</param>
public sealed record PreviewParticipant(
    string ConnectionId,
    string UserId,
    string DisplayName,
    string Color,
    IReadOnlyList<string> SelectedElementIds);
