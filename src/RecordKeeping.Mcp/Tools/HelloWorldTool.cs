using System.ComponentModel;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using ModelContextProtocol.Server;

namespace RecordKeeping.Mcp.Tools;

/// <summary>
/// Minimal proof-of-connectivity MCP tool. Returns a greeting addressed to the
/// authenticated caller, demonstrating that an AI agent's OAuth access token flowed
/// all the way through OAuth discovery, login, and token validation to tool execution.
/// </summary>
[McpServerToolType]
public sealed class HelloWorldTool(IHttpContextAccessor httpContextAccessor)
{
    /// <summary>
    /// Greets the authenticated caller by name.
    /// </summary>
    /// <returns>A greeting that includes the signed-in User's display name.</returns>
    [McpServerTool(Name = "hello_world")]
    [Description("Returns a friendly greeting addressed to the authenticated user. " +
        "Use this to confirm the connection and authentication to RecordKeeping are working.")]
    public string HelloWorld()
    {
        var name = ResolveCallerName(httpContextAccessor.HttpContext?.User);
        return $"Hello, {name}! You are securely connected to RecordKeeping over MCP.";
    }

    // OpenIddict issues the User's display name in the "name" claim (see Api authorize handler).
    // Fall back through identity name then subject so the tool never throws on a sparse principal.
    private static string ResolveCallerName(ClaimsPrincipal? user) =>
        user?.FindFirst("name")?.Value
            ?? user?.Identity?.Name
            ?? user?.FindFirst("sub")?.Value
            ?? "world";
}
