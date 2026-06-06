using System.Security.Claims;
using RecordKeeping.Api.Realtime;
using Shouldly;

namespace RecordKeeping.Api.IntegrationTests.Realtime;

/// <summary>
/// Verifies that a live-preview participant's identity is built solely from the connection's authenticated
/// claims — the <c>sub</c>, <c>name</c> and <c>email</c> claims — never from client input (anti-spoofing,
/// I-D13), and that the display colour is a deterministic, stable function of the user id.
/// </summary>
public class PreviewParticipantFactoryTests
{
    private static ClaimsPrincipal PrincipalWith(params (string Type, string Value)[] claims) =>
        new(new ClaimsIdentity(claims.Select(c => new Claim(c.Type, c.Value)), authenticationType: "test"));

    [Fact]
    public void From_MapsSubjectNameAndEmail_WithEmptyInitialSelection()
    {
        var principal = PrincipalWith(("sub", "user-1"), ("name", "Ada Lovelace"), ("email", "ada@site.local"));

        var participant = PreviewParticipantFactory.From(principal, "conn-1");

        participant.ConnectionId.ShouldBe("conn-1");
        participant.UserId.ShouldBe("user-1");
        participant.DisplayName.ShouldBe("Ada Lovelace");
        participant.SelectedElementIds.ShouldBeEmpty();
        participant.Color.ShouldNotBeNullOrWhiteSpace();
    }

    [Fact]
    public void From_FallsBackToEmailLocalPart_WhenNameClaimAbsent()
    {
        var principal = PrincipalWith(("sub", "user-1"), ("email", "grace@site.local"));

        PreviewParticipantFactory.From(principal, "conn-1").DisplayName.ShouldBe("grace");
    }

    [Fact]
    public void From_FallsBackToUnknown_WhenNoNameOrEmail()
    {
        var principal = PrincipalWith(("sub", "user-1"));

        PreviewParticipantFactory.From(principal, "conn-1").DisplayName.ShouldBe("Unknown");
    }

    [Fact]
    public void From_ColorIsDeterministicForTheSameUser_AcrossConnections()
    {
        var first = PreviewParticipantFactory.From(PrincipalWith(("sub", "user-1"), ("name", "Ada")), "conn-1");
        var second = PreviewParticipantFactory.From(PrincipalWith(("sub", "user-1"), ("name", "Ada")), "conn-2");

        second.Color.ShouldBe(first.Color);
    }
}
