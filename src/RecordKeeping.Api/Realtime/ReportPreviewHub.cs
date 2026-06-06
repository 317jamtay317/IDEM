using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using RecordKeeping.Application.Reporting;

namespace RecordKeeping.Api.Realtime;

/// <summary>
/// SignalR hub powering the live Report Template preview. As a SiteAdmin builds a template, the editor
/// pushes the template's RDL; the hub renders it to one image per page and fans the images out to
/// everyone watching that template's session, so the preview updates as the report is built. It also
/// carries multi-user collaboration: who is present in a session, what each participant has selected, and
/// advisory soft-locks that surface "being edited by …".
/// </summary>
/// <remarks>
/// SiteAdmin only (I-D13). Report Templates are platform-global artifacts, not Org data, and the preview
/// binds to fixed sample data — so Org isolation (I-D03) does not apply here. The editing source of truth is
/// the editor client; the hub relays the latest rendered frame and replays it to late joiners via
/// <see cref="IReportPreviewSessions"/>. Presence and advisory locks are tracked by
/// <see cref="IReportPreviewPresence"/> and live only as long as the owning connection: a disconnect
/// (<see cref="OnDisconnectedAsync"/>) removes the participant and releases its locks. Participant identity is
/// derived from the connection's claims (never from client arguments), and the collaboration mutation methods
/// take no session id — the session is resolved from the connection — so a caller cannot act on a session it
/// never joined.
/// </remarks>
[Authorize(ReportPreviewHub.Policy)]
public sealed class ReportPreviewHub(
    IReportRenderer renderer,
    IReportPreviewSessions sessions,
    IReportPreviewPresence presence) : Hub
{
    /// <summary>The route the hub is mapped to.</summary>
    public const string Path = "/hubs/report-preview";

    /// <summary>The authorization policy gating the hub: SiteAdmin only.</summary>
    public const string Policy = "SiteAdmin";

    /// <summary>The client method invoked with the rendered page images for a session.</summary>
    public const string ReceiveFramesMethod = "ReceiveFrames";

    /// <summary>The client method invoked when a pushed template could not be rendered.</summary>
    public const string ReceiveErrorMethod = "ReceiveError";

    /// <summary>The client method invoked with a session's full participant roster whenever it changes.</summary>
    public const string ParticipantsChangedMethod = "ParticipantsChanged";

    /// <summary>The client method invoked with a session's full advisory soft-lock list whenever it changes.</summary>
    public const string LocksChangedMethod = "LocksChanged";

    /// <summary>
    /// Joins the caller to a template's preview session. Replays the latest render and the current presence
    /// and locks to the caller — so a watcher who opens the preview mid-build catches up at once — then
    /// announces the updated participant roster to everyone in the session.
    /// </summary>
    /// <param name="sessionId">The preview session id (the Report Template's id).</param>
    public async Task JoinSession(string sessionId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, sessionId);

        var snapshot = sessions.GetSnapshot(sessionId);
        if (snapshot is not null)
        {
            await Clients.Caller.SendAsync(ReceiveFramesMethod, sessionId, snapshot.Pages);
        }

        var participant = PreviewParticipantFactory.From(Context.User!, Context.ConnectionId);
        var roster = presence.Join(sessionId, Context.ConnectionId, participant);

        // Replay the current locks to the late joiner (the roster reaches it via the group broadcast below).
        await Clients.Caller.SendAsync(LocksChangedMethod, sessionId, presence.GetLocks(sessionId));
        await Clients.Group(sessionId).SendAsync(ParticipantsChangedMethod, sessionId, roster);
    }

    /// <summary>
    /// Renders the supplied RDL against the sample data, stores it as the session's latest snapshot, and
    /// broadcasts the page images to everyone watching the session. RDL that cannot be parsed is reported
    /// back to the caller via <see cref="ReceiveErrorMethod"/> rather than throwing.
    /// </summary>
    /// <param name="sessionId">The preview session id (the Report Template's id).</param>
    /// <param name="rdl">The Report Template's RDL/RDLC XML.</param>
    public async Task PushRdl(string sessionId, string rdl)
    {
        var rendered = renderer.RenderPreviewImages(rdl, SampleReportData.CreateContext());
        if (rendered.IsError)
        {
            await Clients.Caller.SendAsync(ReceiveErrorMethod, sessionId, rendered.FirstError.Description);
            return;
        }

        sessions.SetSnapshot(sessionId, new ReportPreviewSnapshot(rendered.Value));
        await Clients.Group(sessionId).SendAsync(ReceiveFramesMethod, sessionId, rendered.Value);
    }

    /// <summary>
    /// Updates the caller's current element selection and broadcasts the refreshed roster to the session, so
    /// other participants see what this one has selected. The session is resolved from the connection.
    /// </summary>
    /// <param name="elementIds">The element ids the caller now has selected.</param>
    public async Task UpdateSelection(string[] elementIds)
    {
        var roster = presence.UpdateSelection(Context.ConnectionId, elementIds);
        var sessionId = presence.SessionOf(Context.ConnectionId);
        if (sessionId is not null)
        {
            await Clients.Group(sessionId).SendAsync(ParticipantsChangedMethod, sessionId, roster);
        }
    }

    /// <summary>
    /// Places an advisory soft-lock on an element for the caller and broadcasts the session's lock list. The
    /// lock is advisory: it signals "being edited by …" but never blocks editing, and never steals a lock
    /// another participant holds.
    /// </summary>
    /// <param name="elementId">The element to claim.</param>
    /// <returns>
    /// The resulting lock — the caller's on a grant, the existing holder's on contention — or <c>null</c> when
    /// the caller has not joined a session.
    /// </returns>
    public async Task<PreviewLock?> ClaimElement(string elementId)
    {
        // Claim first, then resolve the session for the broadcast — so a claim raced by a disconnect (which
        // makes the claim a no-op returning null) does not still broadcast a stale lock list to the group.
        var holder = presence.ClaimElement(Context.ConnectionId, elementId);
        if (holder is null)
        {
            return null;
        }

        var sessionId = presence.SessionOf(Context.ConnectionId);
        if (sessionId is not null)
        {
            await Clients.Group(sessionId).SendAsync(LocksChangedMethod, sessionId, presence.GetLocks(sessionId));
        }

        return holder;
    }

    /// <summary>
    /// Releases the caller's advisory soft-lock on an element and broadcasts the session's lock list. A no-op
    /// (no broadcast) when the caller is not the current holder.
    /// </summary>
    /// <param name="elementId">The element to release.</param>
    public async Task ReleaseElement(string elementId)
    {
        // Release first; only broadcast when a lock the caller held was actually removed, resolving the
        // session afterwards so a release raced by a disconnect cannot broadcast to a session it just left.
        if (!presence.ReleaseElement(Context.ConnectionId, elementId))
        {
            return;
        }

        var sessionId = presence.SessionOf(Context.ConnectionId);
        if (sessionId is not null)
        {
            await Clients.Group(sessionId).SendAsync(LocksChangedMethod, sessionId, presence.GetLocks(sessionId));
        }
    }

    /// <summary>
    /// On disconnect, removes the connection from its session and releases every lock it held, then announces
    /// the updated roster (and, when locks changed, the updated lock list) to the session.
    /// </summary>
    /// <param name="exception">The error that caused the disconnect, if any.</param>
    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var result = presence.Leave(Context.ConnectionId);
        if (result.SessionId is string sessionId)
        {
            await Clients.Group(sessionId).SendAsync(ParticipantsChangedMethod, sessionId, result.Participants);
            if (result.ReleasedElementIds.Count > 0)
            {
                await Clients.Group(sessionId).SendAsync(LocksChangedMethod, sessionId, presence.GetLocks(sessionId));
            }
        }

        await base.OnDisconnectedAsync(exception);
    }
}
