using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using RecordKeeping.Application.Reporting;

namespace RecordKeeping.Api.Realtime;

/// <summary>
/// SignalR hub powering the live Report Template preview. As a SiteAdmin builds a template, the editor
/// pushes the template's RDL; the hub renders it to one image per page and fans the images out to
/// everyone watching that template's session, so the preview updates as the report is built.
/// </summary>
/// <remarks>
/// SiteAdmin only (I-D13). Report Templates are platform-global artifacts, not Org data, and the
/// preview binds to fixed sample data — so Org isolation (I-D03) does not apply here. The editing
/// source of truth is the editor client; the hub relays the latest rendered frame and replays it to
/// late joiners via <see cref="IReportPreviewSessions"/>.
/// </remarks>
[Authorize(ReportPreviewHub.Policy)]
public sealed class ReportPreviewHub(IReportRenderer renderer, IReportPreviewSessions sessions) : Hub
{
    /// <summary>The route the hub is mapped to.</summary>
    public const string Path = "/hubs/report-preview";

    /// <summary>The authorization policy gating the hub: SiteAdmin only.</summary>
    public const string Policy = "SiteAdmin";

    /// <summary>The client method invoked with the rendered page images for a session.</summary>
    public const string ReceiveFramesMethod = "ReceiveFrames";

    /// <summary>The client method invoked when a pushed template could not be rendered.</summary>
    public const string ReceiveErrorMethod = "ReceiveError";

    /// <summary>
    /// Joins the caller to a template's preview session and, if a render already exists, immediately
    /// sends its frames — so a watcher who opens the preview mid-build catches up at once.
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
    }

    /// <summary>
    /// Renders the supplied RDL against the sample data, stores it as the session's latest snapshot,
    /// and broadcasts the page images to everyone watching the session. RDL that cannot be parsed is
    /// reported back to the caller via <see cref="ReceiveErrorMethod"/> rather than throwing.
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
}
