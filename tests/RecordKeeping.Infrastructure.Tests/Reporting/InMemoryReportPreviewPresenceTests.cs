using RecordKeeping.Application.Reporting;
using RecordKeeping.Infrastructure.Reporting;
using Shouldly;

namespace RecordKeeping.Infrastructure.Tests.Reporting;

/// <summary>
/// Verifies the in-memory presence + advisory soft-lock registry: participants are tracked per session and
/// keyed by connection; selections update; advisory claims never steal another connection's lock; releases
/// are holder-checked; a disconnect (<see cref="IReportPreviewPresence.Leave"/>) removes the participant and
/// every lock it held and garbage-collects an emptied session; and sessions stay isolated.
/// </summary>
public class InMemoryReportPreviewPresenceTests
{
    private const string Session = "tpl-1";

    private static PreviewParticipant Participant(
        string connectionId,
        string userId = "user-1",
        string displayName = "Ada",
        string color = "#114488") =>
        new(connectionId, userId, displayName, color, []);

    [Fact]
    public void Join_ReturnsTheJoinedParticipant()
    {
        var presence = new InMemoryReportPreviewPresence();

        var roster = presence.Join(Session, "c1", Participant("c1"));

        roster.ShouldHaveSingleItem().ConnectionId.ShouldBe("c1");
    }

    [Fact]
    public void Join_SecondConnection_ReturnsBothParticipants()
    {
        var presence = new InMemoryReportPreviewPresence();
        presence.Join(Session, "c1", Participant("c1"));

        var roster = presence.Join(Session, "c2", Participant("c2", userId: "user-2"));

        roster.Select(p => p.ConnectionId).ShouldBe(["c1", "c2"], ignoreOrder: true);
    }

    [Fact]
    public void Join_SameConnectionTwice_Upserts_NoDuplicates()
    {
        var presence = new InMemoryReportPreviewPresence();
        presence.Join(Session, "c1", Participant("c1", displayName: "Ada"));

        var roster = presence.Join(Session, "c1", Participant("c1", displayName: "Ada Renamed"));

        roster.ShouldHaveSingleItem().DisplayName.ShouldBe("Ada Renamed");
    }

    [Fact]
    public void UpdateSelection_ReplacesSelection_AndReturnsRoster()
    {
        var presence = new InMemoryReportPreviewPresence();
        presence.Join(Session, "c1", Participant("c1"));

        var roster = presence.UpdateSelection("c1", ["el-a", "el-b"]);

        roster.ShouldHaveSingleItem().SelectedElementIds.ShouldBe(["el-a", "el-b"]);
    }

    [Fact]
    public void UpdateSelection_UnknownConnection_ReturnsEmpty()
    {
        var presence = new InMemoryReportPreviewPresence();

        presence.UpdateSelection("ghost", ["el-a"]).ShouldBeEmpty();
    }

    [Fact]
    public void ClaimElement_FreeElement_GrantsToCaller()
    {
        var presence = new InMemoryReportPreviewPresence();
        presence.Join(Session, "c1", Participant("c1", userId: "user-1", displayName: "Ada"));

        var lockResult = presence.ClaimElement("c1", "el-a");

        lockResult.ShouldNotBeNull();
        lockResult.ConnectionId.ShouldBe("c1");
        lockResult.UserId.ShouldBe("user-1");
        lockResult.DisplayName.ShouldBe("Ada");
        presence.GetLocks(Session).ShouldHaveSingleItem().ElementId.ShouldBe("el-a");
    }

    [Fact]
    public void ClaimElement_HeldByAnotherConnection_ReturnsExistingHolder_NoSteal()
    {
        var presence = new InMemoryReportPreviewPresence();
        presence.Join(Session, "c1", Participant("c1", userId: "user-1", displayName: "Ada"));
        presence.Join(Session, "c2", Participant("c2", userId: "user-2", displayName: "Grace"));
        presence.ClaimElement("c1", "el-a");

        var contended = presence.ClaimElement("c2", "el-a");

        contended.ShouldNotBeNull();
        contended.ConnectionId.ShouldBe("c1");
        contended.DisplayName.ShouldBe("Ada");
        presence.GetLocks(Session).ShouldHaveSingleItem().ConnectionId.ShouldBe("c1");
    }

    [Fact]
    public void ClaimElement_SameConnectionAgain_IsIdempotent()
    {
        var presence = new InMemoryReportPreviewPresence();
        presence.Join(Session, "c1", Participant("c1"));
        presence.ClaimElement("c1", "el-a");

        var again = presence.ClaimElement("c1", "el-a");

        again!.ConnectionId.ShouldBe("c1");
        presence.GetLocks(Session).Count.ShouldBe(1);
    }

    [Fact]
    public void ClaimElement_UntrackedConnection_ReturnsNull()
    {
        var presence = new InMemoryReportPreviewPresence();

        presence.ClaimElement("ghost", "el-a").ShouldBeNull();
    }

    [Fact]
    public void ReleaseElement_ByHolder_FreesTheLock()
    {
        var presence = new InMemoryReportPreviewPresence();
        presence.Join(Session, "c1", Participant("c1"));
        presence.ClaimElement("c1", "el-a");

        var released = presence.ReleaseElement("c1", "el-a");

        released.ShouldBeTrue();
        presence.GetLocks(Session).ShouldBeEmpty();
    }

    [Fact]
    public void ReleaseElement_ByNonHolder_IsNoOp()
    {
        var presence = new InMemoryReportPreviewPresence();
        presence.Join(Session, "c1", Participant("c1"));
        presence.Join(Session, "c2", Participant("c2", userId: "user-2"));
        presence.ClaimElement("c1", "el-a");

        var released = presence.ReleaseElement("c2", "el-a");

        released.ShouldBeFalse();
        presence.GetLocks(Session).ShouldHaveSingleItem().ConnectionId.ShouldBe("c1");
    }

    [Fact]
    public void Leave_RemovesParticipant_AndReleasesItsLocks_ReturningSurvivorsAndReleasedIds()
    {
        var presence = new InMemoryReportPreviewPresence();
        presence.Join(Session, "c1", Participant("c1"));
        presence.Join(Session, "c2", Participant("c2", userId: "user-2"));
        presence.ClaimElement("c1", "el-a");
        presence.ClaimElement("c1", "el-b");

        var result = presence.Leave("c1");

        result.SessionId.ShouldBe(Session);
        result.Participants.ShouldHaveSingleItem().ConnectionId.ShouldBe("c2");
        result.ReleasedElementIds.ShouldBe(["el-a", "el-b"], ignoreOrder: true);
        presence.GetLocks(Session).ShouldBeEmpty();
    }

    [Fact]
    public void Leave_UntrackedConnection_ReturnsNullSession()
    {
        var presence = new InMemoryReportPreviewPresence();

        var result = presence.Leave("ghost");

        result.SessionId.ShouldBeNull();
        result.Participants.ShouldBeEmpty();
        result.ReleasedElementIds.ShouldBeEmpty();
    }

    [Fact]
    public void SessionOf_ReturnsSessionWhileJoined_AndNullAfterLeave()
    {
        var presence = new InMemoryReportPreviewPresence();
        presence.Join(Session, "c1", Participant("c1"));

        presence.SessionOf("c1").ShouldBe(Session);

        presence.Leave("c1");

        presence.SessionOf("c1").ShouldBeNull();
    }

    [Fact]
    public void Leave_OfLastParticipant_GarbageCollectsTheSession()
    {
        var presence = new InMemoryReportPreviewPresence();
        presence.Join(Session, "c1", Participant("c1"));

        presence.Leave("c1");

        presence.GetParticipants(Session).ShouldBeEmpty();
        presence.GetLocks(Session).ShouldBeEmpty();
    }

    [Fact]
    public void Sessions_AreIsolatedByKey()
    {
        var presence = new InMemoryReportPreviewPresence();
        presence.Join("a", "c1", Participant("c1"));

        presence.GetParticipants("b").ShouldBeEmpty();
        presence.GetParticipants("a").ShouldHaveSingleItem().ConnectionId.ShouldBe("c1");
    }

    [Fact]
    public void ClaimElement_TwoConnectionsSameUser_HoldLocksOnDifferentElements()
    {
        // Two tabs of one SiteAdmin are distinct connections sharing a user id; each can hold its own lock.
        var presence = new InMemoryReportPreviewPresence();
        presence.Join(Session, "c1", Participant("c1", userId: "user-1"));
        presence.Join(Session, "c2", Participant("c2", userId: "user-1"));

        presence.ClaimElement("c1", "el-a").ShouldNotBeNull();
        presence.ClaimElement("c2", "el-b").ShouldNotBeNull();

        var locks = presence.GetLocks(Session);
        locks.Select(l => l.ElementId).ShouldBe(["el-a", "el-b"], ignoreOrder: true);
        locks.ShouldAllBe(l => l.UserId == "user-1");
    }

    [Fact]
    public void ClaimElement_AfterHolderLeaves_GrantsToTheWaitingConnection()
    {
        var presence = new InMemoryReportPreviewPresence();
        presence.Join(Session, "c1", Participant("c1", userId: "user-1"));
        presence.Join(Session, "c2", Participant("c2", userId: "user-2"));
        presence.ClaimElement("c1", "el-a");
        presence.ClaimElement("c2", "el-a")!.ConnectionId.ShouldBe("c1"); // contended — no steal

        presence.Leave("c1"); // the holder leaves, releasing el-a

        presence.ClaimElement("c2", "el-a")!.ConnectionId.ShouldBe("c2"); // now c2 may take it
    }

    [Fact]
    public async Task ClaimElement_ConcurrentWithHolderLeaving_NeverLeavesTheLockWithTheDeparted()
    {
        var presence = new InMemoryReportPreviewPresence();
        presence.Join(Session, "c1", Participant("c1", userId: "user-1"));
        presence.Join(Session, "c2", Participant("c2", userId: "user-2"));
        presence.ClaimElement("c1", "el-a");

        // Race the holder leaving against another connection claiming the same element; the per-session
        // gate serializes them, so the outcome is always consistent.
        var leave = Task.Run(() => presence.Leave("c1"));
        var claim = Task.Run(() => presence.ClaimElement("c2", "el-a"));
        await Task.WhenAll(leave, claim);

        // Either c2 ended up holding el-a, or it is free — but it is never still held by the departed c1.
        var locks = presence.GetLocks(Session);
        locks.ShouldAllBe(l => l.ConnectionId == "c2");
        locks.Count.ShouldBeLessThanOrEqualTo(1);
    }

    [Fact]
    public async Task ClaimElement_ConcurrentClaimsOnSameElement_YieldExactlyOneHolder()
    {
        var presence = new InMemoryReportPreviewPresence();
        const int contenders = 32;
        for (var i = 0; i < contenders; i++)
        {
            presence.Join(Session, $"c{i}", Participant($"c{i}", userId: $"user-{i}"));
        }

        var claims = Enumerable.Range(0, contenders)
            .Select(i => Task.Run(() => presence.ClaimElement($"c{i}", "el-a")))
            .ToArray();
        var holders = await Task.WhenAll(claims);

        // Every claim resolves to the same single winner, and the registry holds exactly one lock.
        holders.Select(h => h!.ConnectionId).Distinct().Count().ShouldBe(1);
        presence.GetLocks(Session).ShouldHaveSingleItem();
    }
}
