using System.Security.Claims;
using OpenIddict.Abstractions;
using RecordKeeping.Application.Reporting;

namespace RecordKeeping.Api.Realtime;

/// <summary>
/// Builds a <see cref="PreviewParticipant"/> from a hub connection's authenticated identity. Identity is read
/// only from the validated claims — never from client-supplied arguments — so a participant cannot impersonate
/// another (the hub is SiteAdmin-only, I-D13).
/// </summary>
public static class PreviewParticipantFactory
{
    // A small fixed palette. A participant's colour is a deterministic index into it, so the same user is the
    // same colour on every client and across reconnects, without trusting the client for it.
    private static readonly string[] Palette =
    [
        "#2563eb", "#db2777", "#16a34a", "#d97706",
        "#7c3aed", "#0891b2", "#dc2626", "#4f46e5",
    ];

    /// <summary>
    /// Creates a <see cref="PreviewParticipant"/> for a connection from its claims: the user id from the
    /// <c>sub</c> claim, the display name from the <c>name</c> claim (falling back to the email local-part, then
    /// <c>"Unknown"</c>), and a colour derived deterministically from the user id. The initial selection is empty.
    /// </summary>
    /// <param name="user">The connection's authenticated principal (<c>Context.User</c>).</param>
    /// <param name="connectionId">The SignalR connection id.</param>
    /// <returns>The participant for this connection.</returns>
    public static PreviewParticipant From(ClaimsPrincipal user, string connectionId)
    {
        var userId = user.FindFirst(OpenIddictConstants.Claims.Subject)?.Value ?? string.Empty;
        var email = user.FindFirst(OpenIddictConstants.Claims.Email)?.Value ?? string.Empty;
        var name = user.FindFirst(OpenIddictConstants.Claims.Name)?.Value;
        var displayName = FirstNonBlank(name, EmailLocalPart(email)) ?? "Unknown";

        return new PreviewParticipant(connectionId, userId, displayName, ColorFor(userId), []);
    }

    private static string ColorFor(string key) => Palette[StableIndex(key, Palette.Length)];

    // A deterministic, non-cryptographic FNV-1a hash → palette index. string.GetHashCode is randomized per
    // process, so it cannot produce a value stable across processes/clients; this can.
    private static int StableIndex(string key, int modulus)
    {
        uint hash = 2166136261;
        foreach (var c in key)
        {
            hash = (hash ^ c) * 16777619;
        }

        return (int)(hash % (uint)modulus);
    }

    private static string? EmailLocalPart(string email)
    {
        var at = email.IndexOf('@');
        return at > 0 ? email[..at] : null;
    }

    private static string? FirstNonBlank(string? first, string? second) =>
        !string.IsNullOrWhiteSpace(first) ? first : !string.IsNullOrWhiteSpace(second) ? second : null;
}
