using RecordKeeping.Application.Reporting;
using RecordKeeping.Infrastructure.Reporting;
using Shouldly;

namespace RecordKeeping.Infrastructure.Tests.Reporting;

/// <summary>
/// Verifies the in-memory preview-session store keeps the latest rendered snapshot per session — so a
/// watcher that opens the live preview mid-build is sent the current state — and that sessions stay
/// isolated from one another.
/// </summary>
public class InMemoryReportPreviewSessionsTests
{
    private static ReportPreviewSnapshot Snapshot(params byte[][] pages) => new(pages);

    [Fact]
    public void GetSnapshot_UnknownSession_ReturnsNull()
    {
        var sessions = new InMemoryReportPreviewSessions();

        sessions.GetSnapshot("missing").ShouldBeNull();
    }

    [Fact]
    public void SetSnapshot_ThenGet_ReturnsTheSnapshot()
    {
        var sessions = new InMemoryReportPreviewSessions();
        var snapshot = Snapshot([1], [2]);

        sessions.SetSnapshot("s1", snapshot);

        sessions.GetSnapshot("s1").ShouldBe(snapshot);
    }

    [Fact]
    public void SetSnapshot_CalledAgain_ReturnsMostRecent()
    {
        var sessions = new InMemoryReportPreviewSessions();
        sessions.SetSnapshot("s1", Snapshot([1]));
        var latest = Snapshot([9]);

        sessions.SetSnapshot("s1", latest);

        sessions.GetSnapshot("s1").ShouldBe(latest);
    }

    [Fact]
    public void Sessions_AreIsolatedByKey()
    {
        var sessions = new InMemoryReportPreviewSessions();
        var a = Snapshot([1]);

        sessions.SetSnapshot("a", a);

        sessions.GetSnapshot("b").ShouldBeNull();
        sessions.GetSnapshot("a").ShouldBe(a);
    }
}
