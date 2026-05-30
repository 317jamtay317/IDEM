using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using ModelContextProtocol.AspNetCore.Authentication;
using ModelContextProtocol.Authentication;
using RecordKeeping.Mcp.Tools;

namespace RecordKeeping.Mcp;

/// <summary>
/// Composition-root helpers that mount the RecordKeeping MCP server inside an ASP.NET Core
/// host. The MCP endpoint is an OAuth 2.1 resource server; it trusts access tokens issued by
/// the host's own authorization server (OpenIddict) and advertises that server to AI agents
/// via RFC 9728 Protected Resource Metadata.
/// </summary>
public static class McpEndpointExtensions
{
    /// <summary>The route the MCP Streamable HTTP endpoint is mounted at.</summary>
    public const string McpEndpointPath = "/mcp";

    /// <summary>The authorization policy name that guards the MCP endpoint.</summary>
    public const string McpAuthorizationPolicy = "McpUser";

    /// <summary>The OAuth scope an access token must carry to call MCP tools.</summary>
    public const string McpScope = "mcp";

    /// <summary>
    /// Registers the MCP server, its tools, and the <see cref="IHttpContextAccessor"/> the tools
    /// use to read the authenticated caller.
    /// </summary>
    /// <param name="services">The service collection.</param>
    /// <returns>The same <paramref name="services"/> instance, for chaining.</returns>
    public static IServiceCollection AddRecordKeepingMcp(this IServiceCollection services)
    {
        services.AddHttpContextAccessor();
        services.AddMcpServer()
            // Stateless: no server-to-client requests, so the endpoint scales without session affinity.
            .WithHttpTransport(options => options.Stateless = true)
            .WithTools<HelloWorldTool>();
        return services;
    }

    /// <summary>
    /// Adds the MCP authentication scheme, which publishes Protected Resource Metadata and emits
    /// the <c>WWW-Authenticate</c> discovery challenge on 401. Token validation itself is forwarded
    /// to the supplied scheme (the host's OpenIddict validation handler).
    /// </summary>
    /// <param name="builder">The authentication builder.</param>
    /// <param name="tokenValidationScheme">The scheme that validates bearer access tokens.</param>
    /// <returns>The same <paramref name="builder"/> instance, for chaining.</returns>
    public static AuthenticationBuilder AddRecordKeepingMcpAuthentication(
        this AuthenticationBuilder builder, string tokenValidationScheme)
    {
        return builder.AddMcp(options =>
        {
            // The MCP scheme handles discovery + challenge only; OpenIddict validates the token.
            options.ForwardAuthenticate = tokenValidationScheme;

            options.ResourceMetadata = new ProtectedResourceMetadata
            {
                ResourceName = "RecordKeeping MCP",
                ScopesSupported = { McpScope },
            };

            // The authorization server is this very host. Resolving it per-request from the
            // incoming scheme/host keeps the metadata correct across localhost, containers,
            // and production without any environment-specific configuration.
            options.Events.OnResourceMetadataRequest = context =>
            {
                var request = context.Request;
                var issuer = $"{request.Scheme}://{request.Host}";
                context.ResourceMetadata!.AuthorizationServers.Clear();
                context.ResourceMetadata.AuthorizationServers.Add(issuer);
                return Task.CompletedTask;
            };
        });
    }

    /// <summary>
    /// Maps the MCP Streamable HTTP endpoint and protects it with the MCP authorization policy.
    /// </summary>
    /// <param name="endpoints">The endpoint route builder.</param>
    /// <returns>The endpoint convention builder for the mapped MCP endpoint.</returns>
    public static IEndpointConventionBuilder MapRecordKeepingMcp(this IEndpointRouteBuilder endpoints) =>
        endpoints.MapMcp(McpEndpointPath).RequireAuthorization(McpAuthorizationPolicy);
}
