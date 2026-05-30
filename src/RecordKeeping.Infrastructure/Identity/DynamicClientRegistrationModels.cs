namespace RecordKeeping.Infrastructure.Identity;

/// <summary>
/// The subset of OAuth 2.0 Dynamic Client Registration (RFC 7591) request metadata that
/// RecordKeeping honors. Other members are accepted but normalized to the hardened defaults.
/// </summary>
/// <param name="RedirectUris">The client's redirect URIs. At least one is required.</param>
/// <param name="ClientName">A human-readable client name shown in logs and admin tooling.</param>
/// <param name="Scope">Space-delimited scopes the client intends to request.</param>
public sealed record DynamicClientRegistrationRequest(
    IReadOnlyList<string> RedirectUris,
    string? ClientName = null,
    string? Scope = null);

/// <summary>
/// The outcome of a <see cref="DynamicClientRegistration.RegisterAsync"/> call: either a
/// created client or an RFC 7591 error. Failure is a business outcome, not an exception.
/// </summary>
public sealed record DynamicClientRegistrationResult
{
    private DynamicClientRegistrationResult() { }

    /// <summary>Gets a value indicating whether registration succeeded.</summary>
    public bool Succeeded { get; private init; }

    /// <summary>Gets the issued client identifier when <see cref="Succeeded"/> is true.</summary>
    public string? ClientId { get; private init; }

    /// <summary>Gets the registered (validated) redirect URIs when <see cref="Succeeded"/> is true.</summary>
    public IReadOnlyList<string> RedirectUris { get; private init; } = [];

    /// <summary>Gets the granted scope string when <see cref="Succeeded"/> is true.</summary>
    public string? Scope { get; private init; }

    /// <summary>Gets the RFC 7591 error code (e.g. <c>invalid_redirect_uri</c>) on failure.</summary>
    public string? Error { get; private init; }

    /// <summary>Gets the human-readable error description on failure.</summary>
    public string? ErrorDescription { get; private init; }

    /// <summary>Creates a success result for a newly registered client.</summary>
    /// <param name="clientId">The issued client identifier.</param>
    /// <param name="redirectUris">The validated redirect URIs.</param>
    /// <param name="scope">The granted scope string.</param>
    /// <returns>A success result.</returns>
    public static DynamicClientRegistrationResult Success(
        string clientId, IReadOnlyList<string> redirectUris, string scope) => new()
        {
            Succeeded = true,
            ClientId = clientId,
            RedirectUris = redirectUris,
            Scope = scope,
        };

    /// <summary>Creates a failure result carrying an RFC 7591 error.</summary>
    /// <param name="error">The RFC 7591 error code.</param>
    /// <param name="description">A human-readable description.</param>
    /// <returns>A failure result.</returns>
    public static DynamicClientRegistrationResult Failure(string error, string description) => new()
    {
        Succeeded = false,
        Error = error,
        ErrorDescription = description,
    };
}
